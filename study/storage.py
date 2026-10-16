from __future__ import annotations
import contextlib
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import threading
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = 2
LOCK = threading.RLock()

def now():
    return datetime.now(timezone.utc).isoformat()

def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()

@contextlib.contextmanager
def connect(db):
    c = sqlite3.connect(db, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    try:
        with c:
            yield c
    finally:
        c.close()

def initialize(db):
    db = Path(db)
    db.parent.mkdir(parents=True, exist_ok=True)
    with connect(db) as c:
        version = c.execute('PRAGMA user_version').fetchone()[0]
        if version > SCHEMA_VERSION:
            raise ValueError('数据库版本高于应用，不能降级打开')
        if not version:
            c.executescript('''
            BEGIN;
            CREATE TABLE sources(id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL,
                section TEXT NOT NULL, role TEXT NOT NULL, canonical_path TEXT NOT NULL,
                sha256 TEXT NOT NULL, asset TEXT NOT NULL, pages INTEGER NOT NULL DEFAULT 0,
                page_assets TEXT NOT NULL DEFAULT '[]', body TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '');
            CREATE TABLE items(id TEXT PRIMARY KEY, subject TEXT NOT NULL, kind TEXT NOT NULL,
                title TEXT NOT NULL, section TEXT NOT NULL, topic TEXT NOT NULL, number TEXT NOT NULL,
                source_id TEXT REFERENCES sources(id), payload TEXT NOT NULL, search_text TEXT NOT NULL,
                content_hash TEXT NOT NULL);
            CREATE INDEX item_browse ON items(subject,kind,section,topic);
            CREATE TABLE records(item_id TEXT PRIMARY KEY REFERENCES items(id), notes TEXT NOT NULL,
                result TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE imports(id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
                status TEXT NOT NULL, manifest TEXT NOT NULL, details TEXT NOT NULL);
            PRAGMA user_version=1;
            COMMIT;
            ''')
        if version < 2:
            c.executescript('''
            BEGIN;
            CREATE TABLE IF NOT EXISTS item_labels(item_id TEXT PRIMARY KEY REFERENCES items(id), label TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS code_aliases(alias TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES items(id), PRIMARY KEY(alias,item_id));
            CREATE TABLE IF NOT EXISTS code_roots(id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE);
            CREATE TABLE IF NOT EXISTS code_projects(id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES code_roots(id),
                relative_path TEXT NOT NULL, name TEXT NOT NULL, item_id TEXT REFERENCES items(id), missing INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL, UNIQUE(root_id,relative_path));
            CREATE TABLE IF NOT EXISTS code_versions(id INTEGER PRIMARY KEY, project_id TEXT NOT NULL REFERENCES code_projects(id),
                sha256 TEXT NOT NULL, files TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS code_history ON code_versions(project_id,id);
            PRAGMA user_version=2;
            COMMIT;
            ''')
        c.execute('PRAGMA journal_mode=WAL')
    return {'schema_version': SCHEMA_VERSION, 'database': str(db)}

def put_asset(data_dir, path):
    path = Path(path)
    h = digest(path)
    name = h + path.suffix.lower()
    dest = Path(data_dir) / 'assets' / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        tmp = dest.with_suffix(dest.suffix + '.tmp')
        shutil.copyfile(path, tmp)
        if digest(tmp) != h:
            raise ValueError('文件在读取过程中变化：' + str(path))
        os.replace(tmp, dest)
    elif digest(dest) != h:
        raise ValueError('离线资产校验失败：' + name)
    return name

def validate_db(path):
    with connect(path) as c:
        if c.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('SQLite完整性校验失败')
        if c.execute('PRAGMA foreign_key_check').fetchone():
            raise ValueError('SQLite外键校验失败')
        if c.execute('PRAGMA user_version').fetchone()[0] != SCHEMA_VERSION:
            raise ValueError('不兼容的数据库版本')
        for table in ('sources','items','records','imports','item_labels','code_aliases','code_roots','code_projects','code_versions'):
            c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()

def backup(db, directory):
    with LOCK:
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=False)
        with connect(db) as src, contextlib.closing(sqlite3.connect(directory / 'study.db')) as dst:
            src.backup(dst)
            dst.execute('PRAGMA journal_mode=DELETE')
        validate_db(directory / 'study.db')
        assets = Path(db).parent / 'assets'
        if assets.exists():
            shutil.copytree(assets, directory / 'assets')
        from .practice import managed_root
        code = managed_root(db)
        if code.exists():
            shutil.copytree(code, directory / 'code', ignore=shutil.ignore_patterns('*.exe','*.o','*.obj','.git','__pycache__'))
        entries = [{'path': str(p.relative_to(directory)).replace('\\','/'), 'sha256': digest(p), 'bytes': p.stat().st_size}
                   for p in directory.rglob('*') if p.is_file()]
        manifest = {'format':1,'created_at':now(),'schema_version':SCHEMA_VERSION,'files':entries}
        (directory / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        return {'directory':str(directory),'files':len(entries),'records_included':True}

def check_backup(directory):
    directory = Path(directory).resolve()
    m = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    if m.get('format') != 1 or m.get('schema_version') not in (1, SCHEMA_VERSION):
        raise ValueError('备份格式不兼容')
    listed = set()
    for e in m['files']:
        p = (directory / e['path']).resolve()
        if not p.is_relative_to(directory) or not p.is_file() or digest(p) != e['sha256']:
            raise ValueError('备份哈希校验失败：' + e['path'])
        listed.add(p)
    if directory / 'study.db' not in listed:
        raise ValueError('备份缺少数据库')
    # Validate legacy backups without modifying their frozen database.
    if m['schema_version'] == SCHEMA_VERSION:
        validate_db(directory / 'study.db')
    else:
        with connect(directory / 'study.db') as c:
            if c.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or c.execute('PRAGMA foreign_key_check').fetchone():
                raise ValueError('旧版备份数据库损坏')
    with connect(directory / 'study.db') as c:
        for s in c.execute('SELECT asset,page_assets FROM sources'):
            for name in [s['asset'], *json.loads(s['page_assets'])]:
                if (directory / 'assets' / name).resolve() not in listed:
                    raise ValueError('备份缺少来源资产：' + name)
        for row in c.execute('SELECT payload FROM items'):
            payload = json.loads(row[0])
            for key in ('question_images','answer_images'):
                for img in payload.get(key,[]):
                    name = img['asset'] if isinstance(img,dict) else img
                    if (directory / 'assets' / name).resolve() not in listed:
                        raise ValueError('备份缺少题图：' + name)
    return m

def restore(db, directory, recovery_dir):
    with LOCK:
        check_backup(directory)
        # SQLite backup API preserves atomicity with existing readers and WAL.
        old = backup(db, recovery_dir)
        src_assets = Path(directory) / 'assets'
        dst_assets = Path(db).parent / 'assets'
        dst_assets.mkdir(parents=True,exist_ok=True)
        if src_assets.exists():
            for p in src_assets.iterdir():
                target=dst_assets / p.name
                if not target.exists() or digest(target)!=digest(p):
                    tmp=target.with_suffix(target.suffix+'.restore-tmp')
                    shutil.copyfile(p,tmp)
                    os.replace(tmp,target)
        with contextlib.closing(sqlite3.connect(Path(directory) / 'study.db')) as src, connect(db) as dst:
            src.backup(dst)
        initialize(db)
        from .practice import managed_root
        code = Path(directory) / 'code'
        if code.exists():
            # Pre-restore backup above preserves the current code before replacing matching files.
            shutil.copytree(code, managed_root(db), dirs_exist_ok=True)
        validate_db(db)
        return {'restored':str(directory),'recovery':old['directory']}
