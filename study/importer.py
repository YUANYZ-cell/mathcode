from __future__ import annotations
import hashlib
import json
from pathlib import Path
import re
import tempfile
from .storage import ROOT,LOCK,connect,initialize,now,digest,put_asset,backup
from .question_policy import prepare_question

TOPICS={'program':'程序与变量','operator':'表达式与运算','condition':'分支与判断','loop':'循环','array':'数组','function':'函数','pointer':'指针','string':'字符串','structure':'结构体','file':'文件','class':'类与对象'}

def sid(subject,path):
    return subject+'-'+hashlib.sha256(str(Path(path).resolve()).casefold().encode()).hexdigest()[:20]

def import_library(db, manifest=None, index=None):
    """Prepare every input before one transaction. Personal records are never updated."""
    with LOCK:
        initialize(db)
        db=Path(db)
        data=db.parent
        manifest=Path(manifest or ROOT/'资料准备/首批资料来源清单.json')
        explicit_index=index is not None
        index=Path(index or ROOT/'资料准备/math_question_index.json')
        started=now()
        try:
            m=json.loads(manifest.read_text(encoding='utf-8-sig'))
            if explicit_index and not index.is_file():
                raise ValueError('指定的数学索引不存在')
            sources={}
            items=[]
            old={}
            with connect(db) as c:
                old={s['id']:dict(s) for s in c.execute('SELECT * FROM sources')}
            def source(path,subject,section,role,url='',expected=None,render=True):
                path=Path(path).resolve()
                identity=next((r['id'] for r in old.values() if r['subject']==subject and Path(r['canonical_path']).resolve()==path),sid(subject,path))
                if identity in sources:
                    return identity
                sha=digest(path)
                if expected and sha!=expected:
                    raise ValueError('来源已变化，需更新清单并重新核对：'+str(path))
                for existing in sources.values():
                    if existing['subject']==subject and existing['sha256']==sha:
                        return existing['id']
                asset=put_asset(data,path)
                pages=[]
                body=''
                total=0
                if path.suffix.lower()=='.pdf':
                    import fitz
                    with fitz.open(path) as pdf:
                        total=len(pdf)
                        body='\n'.join(p.get_text() for p in pdf)
                        prior=old.get(identity,{})
                        if prior.get('sha256')==sha and len(json.loads(prior.get('page_assets','[]')))==total:
                            pages=json.loads(prior['page_assets'])
                            if not all((data/'assets'/n).is_file() for n in pages):
                                pages=[]
                        if render and not pages:
                            for page in pdf:
                                pages.append(image_bytes(page.get_pixmap(matrix=fitz.Matrix(1.8,1.8)).tobytes('png'),data))
                elif path.suffix.lower() in ('.md','.txt','.json'):
                    body=path.read_text(encoding='utf-8-sig')
                sources[identity]={'id':identity,'name':path.name,'subject':subject,'section':section,'role':role,
                    'canonical_path':str(path),'sha256':sha,'asset':asset,'pages':total,
                    'page_assets':json.dumps(pages),'body':body,'url':url}
                return identity
            def add(identity,subject,kind,title,section,topic,number,source_id,payload,search=''):
                if subject=='cpp' and kind=='question':
                    kind,title,payload=prepare_question(title,payload)
                encoded=json.dumps(payload,ensure_ascii=False,sort_keys=True)
                items.append({'id':identity,'subject':subject,'kind':kind,'title':title,'section':section,'topic':topic,
                              'number':str(number),'source_id':source_id,'payload':encoded,
                              'search_text':' '.join([identity,title,section,topic,search]),
                              'content_hash':hashlib.sha256((encoded+title+section+topic+str(source_id)).encode()).hexdigest()})
            math={}
            for f in m.get('math_files',[]):
                if f.get('role')=='课程合影附件' or Path(f['canonical_path']).suffix.lower()!='.pdf':
                    continue
                identity=source(f['canonical_path'],'math',f['section'],f['role'],f.get('download_url',''),f.get('sha256'))
                math[f['name']]=identity
            if index.exists() and math:
                idx=json.loads(index.read_text(encoding='utf-8-sig'))
                for q in idx['items']:
                    payload={'question_images':[],'answer_images':[],'question_md':q.get('question_md',q.get('question_prompt','')),
                             'answer_md':q.get('answer_md',''),'answer_provenance':q.get('answer_provenance','学校原资料'),
                             'convention':q.get('convention',''),'verification':q.get('verification',''),
                             'notes':q.get('notes',''),'question_prompt_provenance':q.get('question_prompt_origin',''),'references':[]}
                    for key,output in [('question','question_images'),('answer','answer_images')]:
                        for ref in q.get(key,[]):
                            srcid=math[ref['file']]
                            src=sources[srcid]
                            if ref.get('source_sha256')!=src['sha256']:
                                raise ValueError('数学原件已变化或索引缺少哈希，需重新核对逐题索引：'+q['id'])
                            pnum=int(ref['page'])
                            if pnum<1 or pnum>src['pages']:
                                raise ValueError('页码越界：'+q['id'])
                            image=page_crop(src['canonical_path'],pnum,ref.get('rect'),data)
                            payload[output].append({'asset':image,'source_id':srcid,'page':pnum,'name':ref['file']})
                            payload['references'].append({'source_id':srcid,'page':pnum,'role':key})
                    if not payload['question_images'] and not payload['question_md']:
                        raise ValueError('题干为空：'+q['id'])
                    first=(q.get('question') or q.get('answer'))[0]
                    add(q['id'],'math','question',q['title'],q['section'],q['topic'],q.get('number',q['id']),math[first['file']],payload,q.get('search_text','')+' '+str(q.get('convention',''))+' '+str(q.get('notes','')))
            cpp_root=Path(m.get('cpp',{}).get('root',''))
            if m.get('cpp'):
                qpath=cpp_root/'练习题/EEEE1044题目清单.json'
                apath=cpp_root/'练习题/EEEE1044参考答案.json'
                qs=json.loads(qpath.read_text(encoding='utf-8-sig'))
                answers=json.loads(apath.read_text(encoding='utf-8-sig'))
                qsid=source(qpath,'cpp','EEEE1044','结构化题目')
                asid=source(apath,'cpp','EEEE1044','自编参考答案')
                pdfs={p.name:p for p in (cpp_root/'参考资料').rglob('*.pdf')}
                policy_path = ROOT/'资料准备/cpp_visual_policy.json'
                if not policy_path.exists():
                    raise ValueError('公开版未附带私人题图策略，需重新核对题图显示规则')
                policy=json.loads(policy_path.read_text(encoding='utf-8'))
                if policy.get('question_index_sha256')!=digest(qpath):
                    raise ValueError('C++原题清单已变化，需重新核对题图显示规则')
                for q in qs:
                    a=answers[q['id']]
                    origin=qsid
                    if q['source'] in pdfs:
                        origin=source(pdfs[q['source']],'cpp','EEEE1044','学校练习原件')
                    imgs=[]
                    visual=policy['items'].get(q['id'],{})
                    for n,im in enumerate(q.get('images',[]),1):
                        if n not in visual.get('image_numbers',[]): continue
                        ip=(cpp_root/im).resolve()
                        if not ip.is_relative_to(cpp_root.resolve()):
                            raise ValueError('题图超出C++来源目录')
                        image_page=re.search(r'-p(\d+)\.[^.]+$',ip.name)
                        page=int(image_page[1]) if image_page else q['page']
                        imgs.append({'asset':put_asset(data,ip),'source_id':origin,'page':page,'name':q['source']})
                    section='EEEE1044 · Seminar '+q['id'].split('-')[1][1:]
                    payload={'question_md':q['original'],'question_format':'plain','question_images':imgs,'visual_reason':visual.get('reason',''),'answer_provenance':a['provenance'],
                             'answer_md':a['explanation'],'programs':a.get('programs',[]),
                             'references':[{'source_id':origin,'page':q['page'],'role':'question'}, {'source_id':asid,'page':0,'role':'answer'}]}
                    add(q['id'],'cpp','question',q['title'],section,TOPICS.get(q['topic'],q['topic']),q['number'],origin,payload,q['original'])
                companion_paths=sorted(set(x['source'] for x in m['cpp']['companion_index']))
                companion_count=0
                for path in companion_paths:
                    p=Path(path)
                    identity=source(p,'cpp','配套练习','自编章节练习')
                    text=p.read_text(encoding='utf-8-sig')
                    matches=list(re.finditer(r'^## ([A-Z]\d{2})\s*[·.]\s*(.+)$',text,re.M))
                    for i,mat in enumerate(matches):
                        content=text[mat.end():matches[i+1].start() if i+1<len(matches) else len(text)].strip()
                        blocks=re.findall(r'<details>.*?</details>',content,re.S)
                        answer='\n\n'.join(re.sub(r'</?(?:details|summary)[^>]*>','',b) for b in blocks)
                        question=re.sub(r'<details>.*?</details>','',content,flags=re.S).strip()
                        payload={'question_md':question,'answer_md':answer,'answer_provenance':'原有自编配套练习与参考答案；非学校官方答案。',
                                 'question_images':[],'programs':[],'references':[{'source_id':identity,'page':0,'role':'question'}]}
                        add('CPP-'+mat[1],'cpp','question',mat[2],'配套练习 · '+p.stem[3:],p.stem[3:],mat[1],identity,payload,question)
                        companion_count+=1
                if len(qs)!=176 or companion_count!=44:
                    raise ValueError('首批C++题量与核对清单不一致')
                for p in sorted((cpp_root/'课件').glob('*.md')):
                    identity=source(p,'cpp','课件','学习课件')
                    body=rewrite_markdown_images(p.read_text(encoding='utf-8-sig'),p,data,cpp_root)
                    sources[identity]['body']=body
                    add('LESSON-'+p.stem,'cpp','lesson',p.stem[3:],'课件',p.stem[3:],'',identity,
                        {'question_md':body,'question_images':[],'references':[{'source_id':identity,'page':0,'role':'question'}]},body)
                # Raw supporting references, never learner code, generated HTML or backup copies.
                for p in sorted((cpp_root/'参考资料').rglob('*'),key=lambda p:('原始资料' not in p.parts,len(p.parts),str(p))):
                    if p.is_file() and p.suffix.lower() in ('.pdf','.docx','.pptx'):
                        if any(x in str(p.relative_to(cpp_root)).lower() for x in ('备份','backup','题目原页')):
                            continue
                        name=p.name.lower()
                        role='Coursework' if 'coursework' in name or re.search(r'\bcw\d',name) else '实验资料' if any(x in name for x in ('lab','实验')) else '试卷' if any(x in name for x in ('exam','paper','试卷')) else '课堂讲义' if 'lecture' in name else '学校参考答案' if 'solution' in name else '课堂与参考资料'
                        identity=source(p,'cpp','参考资料',role)
            # Optional future Moodle sources and manually verified question bundles.
            extra_source_ids={}
            for s in m.get('extra_sources',[]):
                extra_source_ids[str(Path(s['canonical_path']).resolve())]=source(s['canonical_path'],s.get('subject','math'),s['section'],s['role'],s.get('url',''),s.get('sha256'))
            # Stable ids are independent from display labels. New bundles need no renumbering.
            for kind,q in [('question',q) for q in m.get('extra_questions',[])]+[('lesson',q) for q in m.get('extra_lessons',[])]:
                if not q.get('id') or q.get('subject','cpp')!='cpp':
                    raise ValueError('新增C++题需要固定id')
                if not q.get('question_md','').strip(): raise ValueError('新增题干为空')
                refs=[]
                for ref in q.get('source_refs',[]):
                    srcid=extra_source_ids[str(Path(ref['path']).resolve())]
                    page=int(ref.get('page',0))
                    if page<0 or page>sources[srcid]['pages']: raise ValueError('补充资料引用页码越界')
                    refs.append({'source_id':srcid,'page':page,'role':ref.get('role','question')})
                add(q['id'],'cpp',kind,q['title'],q.get('section','自定义练习'),q.get('topic','综合练习'),q.get('number',q['id']),refs[0]['source_id'] if refs else None,
                    {'question_md':q['question_md'],'answer_md':q.get('answer_md',''),'answer_provenance':q.get('answer_provenance','用户补充'),'question_images':[],'references':refs},q['question_md'])
            if len({i['id'] for i in items})!=len(items):
                raise ValueError('导入索引包含重复题号')
            counts={'items_new':0,'items_changed':0,'items_unchanged':0,'sources_new':0,'sources_changed':0,'sources_unchanged':0,'sources_deduplicated':0}
            if db.exists():
                with connect(db) as c:
                    populated=c.execute('SELECT COUNT(*) FROM items').fetchone()[0]
                    old_items={r['id']:r['content_hash'] for r in c.execute('SELECT id,content_hash FROM items')}
                selected_hashes={(s['subject'],s['sha256']) for s in sources.values()}
                duplicates=[s for s in old.values() if s['id'] not in sources and (s['subject'],s['sha256']) in selected_hashes]
                changed=bool(duplicates) or any(old_items.get(i['id'])!=i['content_hash'] for i in items) or any(any(old.get(s['id'],{}).get(k)!=v for k,v in s.items()) for s in sources.values())
                if populated and changed:
                    from datetime import datetime
                    backup(db,data.parent/'backups'/('pre-import-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')))
            with connect(db) as c:
                for s in sources.values():
                    prev=c.execute('SELECT sha256 FROM sources WHERE id=?',(s['id'],)).fetchone()
                    counts['sources_new' if not prev else 'sources_unchanged' if prev[0]==s['sha256'] else 'sources_changed']+=1
                    cols=list(s)
                    c.execute(f"INSERT INTO sources ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)}) ON CONFLICT(id) DO UPDATE SET "+','.join(k+'=excluded.'+k for k in cols if k!='id'),list(s.values()))
                for i in items:
                    prev=c.execute('SELECT content_hash FROM items WHERE id=?',(i['id'],)).fetchone()
                    counts['items_new' if not prev else 'items_unchanged' if prev[0]==i['content_hash'] else 'items_changed']+=1
                    cols=list(i)
                    c.execute(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)}) ON CONFLICT(id) DO UPDATE SET "+','.join(k+'=excluded.'+k for k in cols if k!='id'),list(i.values()))
                from .practice import labels,naming
                known={r['id']:r['label'] for r in labels(c)}
                for q in m.get('extra_questions',[]):
                    if q.get('label') and q['id'] in known:
                        alias=naming(q['label'])
                        if any(naming(v)==alias and k!=q['id'] for k,v in known.items()): raise ValueError('新增题号与已有题目冲突')
                        for value in (known[q['id']],q['label']):
                            c.execute('INSERT OR IGNORE INTO code_aliases VALUES (?,?)',(naming(value),q['id']))
                        c.execute('INSERT INTO item_labels VALUES (?,?) ON CONFLICT(item_id) DO UPDATE SET label=excluded.label',(q['id'],q['label']))
                        known[q['id']]=q['label']
                referenced=set()
                for row in c.execute('SELECT source_id,payload FROM items'):
                    referenced.add(row['source_id'])
                    p=json.loads(row['payload'])
                    referenced.update(ref.get('source_id') for ref in p.get('references',[]))
                    for key in ('question_images','answer_images'):
                        referenced.update(im.get('source_id') for im in p.get(key,[]) if isinstance(im,dict))
                for prior in duplicates:
                    if prior['id'] not in referenced:
                        c.execute('DELETE FROM sources WHERE id=?',(prior['id'],))
                        counts['sources_deduplicated']+=1
                c.execute('INSERT INTO imports(started_at,finished_at,status,manifest,details) VALUES (?,?,?,?,?)',
                          (started,now(),'success',str(manifest),json.dumps(counts)))
            return counts
        except Exception as error:
            with connect(db) as c:
                c.execute('INSERT INTO imports(started_at,finished_at,status,manifest,details) VALUES (?,?,?,?,?)',
                          (started,now(),'failed',str(manifest),json.dumps({'error':str(error)},ensure_ascii=False)))
            raise

def image_bytes(blob,data):
    h=hashlib.sha256(blob).hexdigest()
    name=h+'.png'
    dest=Path(data)/'assets'/name
    dest.parent.mkdir(parents=True,exist_ok=True)
    if not dest.exists():
        dest.write_bytes(blob)
    elif digest(dest)!=h:
        raise ValueError('离线题图已损坏：'+name)
    return name

def page_crop(path,page,rect,data):
    import fitz
    with fitz.open(path) as pdf:
        p=pdf[page-1]
        clip=fitz.Rect(rect) if rect else p.rect
        if clip.is_empty or not p.rect.contains(clip):
            raise ValueError('裁片坐标超出原页：'+str(path))
        return image_bytes(p.get_pixmap(matrix=fitz.Matrix(2,2),clip=clip).tobytes('png'),data)

def rewrite_markdown_images(text,path,data,root):
    def local_image(ref):
        if ref.startswith(('http:','https:','data:','/assets/')):
            return ref
        p=(path.parent/ref).resolve()
        if p.is_relative_to(root.resolve()) and p.is_file() and p.suffix.lower() in ('.png','.jpg','.jpeg','.webp','.svg','.gif'):
            return '/assets/'+put_asset(data,p)
        return ref
    def replace(m):
        ref=m[2].split(' ')[0].strip('<>')
        if ref.startswith(('http:','https:','data:')):
            return m[0]
        p=(path.parent/ref).resolve()
        if not p.is_relative_to(root.resolve()) or not p.is_file():
            return m[0]
        return '!['+m[1]+'](/assets/'+put_asset(data,p)+')'
    text=re.sub(r'!\[([^\]]*)\]\(([^)]+)\)',replace,text)
    return re.sub(r'''((?:src|href)=["'])([^"']+)(["'])''',lambda m:m[1]+local_image(m[2])+m[3],text)
