from __future__ import annotations
import argparse
from datetime import datetime
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlparse,parse_qs,unquote
from study.storage import ROOT,LOCK,connect,initialize,backup,restore,validate_db

APP='math-code-study'
API_VERSION=1

def fingerprint():
    import hashlib
    h=hashlib.sha256()
    for name in ('start.py','study/storage.py','study/importer.py','study/practice.py'):
        h.update((ROOT/name).read_bytes())
    return h.hexdigest()

def make_server(db,port=8778,idle=180):
    db=Path(db).resolve()
    initialize(db)
    token=secrets.token_urlsafe(32)
    source_fingerprint=fingerprint()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):
            pass
        def send(self,obj,status=200):
            blob=json.dumps(obj,ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(blob)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.end_headers()
            self.wfile.write(blob)
        def host_valid(self):
            return self.headers.get('Host')==f'127.0.0.1:{self.server.server_port}'
        def do_GET(self):
            if not self.host_valid():
                return self.send({'error':'Invalid host'},403)
            self.server.last_activity=time.monotonic()
            try:
                url=urlparse(self.path)
                path=unquote(url.path)
                args={k:v[0] for k,v in parse_qs(url.query).items()}
                if path=='/api/health':
                    return self.send({'ok':True,'app':APP,'api_version':API_VERSION,'root':str(ROOT),'database':str(db),'pid':__import__('os').getpid(),'fingerprint':source_fingerprint})
                with LOCK,connect(db) as c:
                    if path=='/api/state':
                        return self.send({'token':token,'counts':[dict(x) for x in c.execute('SELECT subject,kind,COUNT(*) count FROM items GROUP BY subject,kind')],
                            'sources':c.execute('SELECT COUNT(*) FROM sources').fetchone()[0],
                            'records':c.execute('SELECT COUNT(*) FROM records').fetchone()[0],'schema':2})
                    if path=='/api/lessons':
                        from study.lessons import catalog
                        return self.send(catalog(c))
                    if path=='/api/items':
                        rows=[dict(r) for r in c.execute('SELECT id,subject,kind,title,section,topic,number,source_id,search_text FROM items ORDER BY rowid')]
                        for key in ('subject','kind','section','topic'):
                            if args.get(key): rows=[r for r in rows if r[key]==args[key]]
                        from study.practice import labels,naming
                        names={r['id']:r['label'] for r in labels(c)}
                        for r in rows:
                            r['label']=names.get(r['id'],r['id'])
                            r['search_text']+=' '+r['label']+' '+naming(r['label'])
                        needle=args.get('q','').strip().casefold()
                        import re
                        exact=[r for r in rows if r['id'].casefold()==needle or r['label'].casefold()==needle or (needle and naming(r['label']).casefold()==re.sub(r'[^a-z0-9]','',needle)) or (re.fullmatch(r'[a-z]\d{2}',needle) and r['number'].casefold()==needle)]
                        words=needle.split()
                        rows=exact or [r for r in rows if all(w in r['search_text'].casefold() for w in words)]
                        for r in rows:r.pop('search_text')
                        return self.send({'items':rows,'count':len(rows)})
                    if path.startswith('/api/item/'):
                        identity=path[len('/api/item/'):]
                        row=c.execute('SELECT * FROM items WHERE id=?',(identity,)).fetchone()
                        if not row:return self.send({'error':'题目不存在'},404)
                        result=dict(row)
                        result['payload']=json.loads(result['payload'])
                        record=c.execute('SELECT * FROM records WHERE item_id=?',(identity,)).fetchone()
                        result['record']=dict(record) if record else None
                        from study.practice import labels,naming
                        result['label']=next((r['label'] for r in labels(c) if r['id']==identity),identity)
                        result['practice_name']=naming(result['label'])
                        return self.send(result)
                    if path=='/api/code':
                        from study.practice import scan
                        return self.send(scan(db))
                    if path.startswith('/api/code/'):
                        from study.practice import detail
                        return self.send(detail(db,path[len('/api/code/'):],args.get('version')))
                    if path=='/api/sources':
                        return self.send({'sources':[dict(r) for r in c.execute('SELECT id,name,subject,section,role,canonical_path,sha256,pages,asset,url FROM sources ORDER BY rowid')]})
                    if path.startswith('/api/source/'):
                        row=c.execute('SELECT * FROM sources WHERE id=?',(path[len('/api/source/'):],)).fetchone()
                        if not row:return self.send({'error':'资料不存在'},404)
                        result=dict(row);result['page_assets']=json.loads(result['page_assets'])
                        return self.send(result)
                    if path=='/api/imports':
                        imports=[dict(r) for r in c.execute('SELECT * FROM imports ORDER BY id DESC LIMIT 50')]
                        for r in imports:r['details']=json.loads(r['details'])
                        backups=ROOT/'backups' if db==ROOT/'data/study.db' else db.parent.parent/'backups'
                        return self.send({'imports':imports,'backups':[str(p) for p in sorted(backups.glob('*/manifest.json'),reverse=True)],'database':str(db)})
                if path.startswith('/assets/'):
                    file=(db.parent/'assets'/path[len('/assets/'):]).resolve()
                    base=(db.parent/'assets').resolve()
                else:
                    file=(ROOT/'app'/('index.html' if path=='/' else path.lstrip('/'))).resolve()
                    base=(ROOT/'app').resolve()
                if not file.is_relative_to(base) or not file.is_file():
                    return self.send({'error':'文件不存在'},404)
                content=file.read_bytes()
                self.send_response(200)
                self.send_header('Content-Type',mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
                self.send_header('Content-Length',str(len(content)))
                self.send_header('X-Content-Type-Options','nosniff')
                self.send_header('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
                self.end_headers();self.wfile.write(content)
            except (BrokenPipeError,ConnectionResetError):
                pass
            except Exception as e:
                self.send({'error':str(e)},500)
        def do_POST(self):
            self.server.last_activity=time.monotonic()
            if not self.host_valid() or self.headers.get('Origin') not in (None,f'http://127.0.0.1:{self.server.server_port}') or self.headers.get('X-Study-Token')!=token:
                return self.send({'error':'请求未授权，请重新打开App'},403)
            if 'application/json' not in self.headers.get('Content-Type',''):
                return self.send({'error':'需要JSON'},415)
            try:
                length=int(self.headers.get('Content-Length','0'))
                if length>1024*1024:raise ValueError('记录内容过长')
                body=json.loads(self.rfile.read(length) or b'{}')
                with LOCK:
                    if self.path.startswith('/api/code/') or self.path=='/api/item-label':
                        from study import practice
                        if self.path=='/api/code/create': return self.send(practice.create(db,body.get('item_id'),body.get('name','')))
                        if self.path=='/api/code/root': return self.send(practice.add_root(db,body['path']))
                        if self.path=='/api/code/bind': return self.send(practice.bind(db,body['project_id'],body.get('item_id')))
                        if self.path=='/api/code/open': return self.send(practice.open_path(db,body.get('project_id'),body.get('action','vscode'),body.get('relative_path')))
                        if self.path=='/api/item-label': return self.send(practice.relabel(db,body['item_id'],body['label']))
                        return self.send({'error':'未知代码操作'},404)
                    if self.path=='/api/record':
                        identity=body['item_id']
                        with connect(db) as c:
                            row=c.execute('SELECT subject,kind FROM items WHERE id=?',(identity,)).fetchone()
                            if not row or row['subject']!='cpp' or row['kind']!='question':raise ValueError('只为C++练习保存个人记录')
                            if body['status'] not in ('未记录','思考中','已运行','待复习','已完成'):raise ValueError('状态无效')
                            for k in ('notes','result'):
                                if not isinstance(body[k],str) or len(body[k])>200000:raise ValueError('记录内容无效')
                            prev=c.execute('SELECT updated_at FROM records WHERE item_id=?',(identity,)).fetchone()
                            if prev and prev[0]!=body.get('updated_at'):
                                return self.send({'error':'记录已在另一个窗口变更，请重新打开题目后保存'},409)
                            from study.storage import now
                            stamp=now()
                            c.execute('INSERT INTO records VALUES (?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET notes=excluded.notes,result=excluded.result,status=excluded.status,updated_at=excluded.updated_at',
                                      (identity,body['notes'],body['result'],body['status'],stamp))
                        return self.send({'saved':True,'updated_at':stamp})
                    if self.path=='/api/import':
                        from study.importer import import_library
                        return self.send(import_library(db,body.get('manifest'),body.get('index')))
                    backup_root=ROOT/'backups' if db==ROOT/'data/study.db' else db.parent.parent/'backups'
                    stamp=datetime.now().strftime('%Y%m%d-%H%M%S-%f')
                    if self.path=='/api/backup':
                        return self.send(backup(db,backup_root/('manual-'+stamp)))
                    if self.path=='/api/restore':
                        path=Path(body['directory']).resolve()
                        if not path.is_relative_to(backup_root.resolve()):raise ValueError('请先把备份文件夹放入本项目backups目录')
                        return self.send(restore(db,path,backup_root/('pre-restore-'+stamp)))
                    return self.send({'error':'未知操作'},404)
            except (ValueError,KeyError,FileNotFoundError) as e:
                self.send({'error':str(e)},400)
            except Exception as e:
                self.send({'error':str(e)},500)
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    server.daemon_threads=True
    server.last_activity=time.monotonic()
    if idle:
        def monitor():
            while True:
                time.sleep(min(10,idle))
                if time.monotonic()-server.last_activity>idle:
                    server.shutdown();return
        threading.Thread(target=monitor,daemon=True).start()
    return server

def main():
    p=argparse.ArgumentParser()
    p.add_argument('command',nargs='?',default='serve',choices=['serve','init','migrate','import','backup','restore','check'])
    p.add_argument('--database',type=Path,default=ROOT/'data/study.db')
    p.add_argument('--port',type=int,default=8778)
    p.add_argument('--idle-timeout',type=int,default=180)
    p.add_argument('--manifest',type=Path)
    p.add_argument('--index',type=Path)
    p.add_argument('--directory',type=Path)
    args=p.parse_args()
    if args.command in ('init','migrate'):result=initialize(args.database)
    elif args.command=='import':
        from study.importer import import_library
        result=import_library(args.database,args.manifest,args.index)
    elif args.command=='backup':result=backup(args.database,args.directory or ROOT/'backups'/datetime.now().strftime('manual-%Y%m%d-%H%M%S-%f'))
    elif args.command=='restore':result=restore(args.database,args.directory,ROOT/'backups'/datetime.now().strftime('pre-restore-%Y%m%d-%H%M%S-%f'))
    elif args.command=='check':validate_db(args.database);result={'integrity':'ok'}
    else:
        server=make_server(args.database,args.port,args.idle_timeout)
        try:server.serve_forever()
        finally:server.server_close()
        return
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
