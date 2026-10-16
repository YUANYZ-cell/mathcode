"""Local source files and immutable snapshots. Never compile or run learner code."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import uuid
from .storage import ROOT, connect, now
from .code_workspace import configure

EXTENSIONS = {'.cpp', '.c', '.cc', '.cxx', '.h', '.hpp', '.py', '.txt', '.md'}
SKIP = {'.git', '.vscode', '.verification', '.学习页面', '__pycache__', 'node_modules', 'build', 'dist', '.build'}
MAX_BYTES = 2 * 1024 * 1024
RETIRED_ROOT = Path.home()/'Contacts/Desktop/大学/Y3/C++Learning'


def editable_path(path):
    """Archived materials and the retired course are never working code roots."""
    target = Path(path).resolve()
    if any(target.is_relative_to(base.resolve()) for base in (RETIRED_ROOT, ROOT/'学习资料/C++Learning')):
        raise ValueError('此目录已归档，请从“我的代码”打开并保存练习：'+str(ROOT/'我的代码'))
    return target

def managed_root(db):
    return ROOT/'我的代码' if Path(db).resolve() == (ROOT/'data/study.db').resolve() else Path(db).parent/'code'

def normalized(label):
    return re.sub(r'[^A-Z0-9]', '', label.upper())

def naming(label):
    value = normalized(label)
    if not value or len(value) > 64:
        raise ValueError('题号需要包含英文字母或数字，最多64位')
    return value

def labels(c):
    rows = c.execute("SELECT i.id,i.title,COALESCE(l.label,i.id) label FROM items i LEFT JOIN item_labels l ON l.item_id=i.id WHERE subject='cpp' AND kind='question'")
    return [dict(r) for r in rows]

def ensure_roots(db, c):
    path = managed_root(db).resolve()
    path.mkdir(parents=True, exist_ok=True)
    c.execute("INSERT INTO code_roots VALUES ('managed',?) ON CONFLICT(id) DO UPDATE SET path=excluded.path", (str(path),))
    for item in labels(c):
        c.execute('INSERT OR IGNORE INTO code_aliases VALUES (?,?)', (naming(item['label']), item['id']))

def add_root(db, path):
    target = editable_path(Path(path).expanduser())
    target = target.resolve(strict=True)
    if not target.is_dir() or target == Path(target.anchor):
        raise ValueError('请选择具体的代码文件夹')
    with connect(db) as c:
        c.execute('INSERT OR IGNORE INTO code_roots VALUES (?,?)', (str(uuid.uuid5(uuid.NAMESPACE_URL, str(target).casefold())), str(target)))
    return scan(db)

def relabel(db, item_id, label):
    label = str(label).strip()
    alias = naming(label)
    with connect(db) as c:
        item = c.execute("SELECT id,COALESCE(l.label,i.id) label FROM items i LEFT JOIN item_labels l ON l.item_id=i.id WHERE i.id=? AND subject='cpp' AND kind='question'", (item_id,)).fetchone()
        if not item:
            raise ValueError('题目不存在')
        if any(naming(r['label']) == alias and r['id'] != item_id for r in labels(c)):
            raise ValueError('该题号已被另一道题使用')
        # Former names remain aliases. Ambiguous aliases require manual binding, never guessing.
        for value in (naming(item['label']), alias):
            c.execute('INSERT OR IGNORE INTO code_aliases VALUES (?,?)', (value, item_id))
        c.execute('INSERT INTO item_labels VALUES (?,?) ON CONFLICT(item_id) DO UPDATE SET label=excluded.label', (item_id, label))
    return {'item_id': item_id, 'label': label, 'practice_name': alias}

def item_match(parts, aliases):
    for part in reversed(parts):
        stem = Path(part).stem
        candidates = {normalized(stem), normalized(re.sub(r'(?i)(?:[_ .-](?:第?\d+次?|attempt\d*|v\d+|try\d+))+$', '', stem))}
        ids = set().union(*(aliases.get(v, set()) for v in candidates))
        if len(ids) == 1:
            return ids.pop()
        if len(ids) > 1:
            return None
    return None

def scan(db):
    warnings = []
    with connect(db) as c:
        ensure_roots(db, c)
        aliases = {}
        for row in c.execute('SELECT * FROM code_aliases'):
            aliases.setdefault(row['alias'], set()).add(row['item_id'])
        valid_items = {r['id'] for r in labels(c)}
        roots = [dict(r) for r in c.execute('SELECT * FROM code_roots')]
        for root in roots:
            base = Path(root['path']).resolve()
            try:
                editable_path(base)
            except ValueError as error:
                warnings.append(str(error)); continue
            c.execute('UPDATE code_projects SET missing=1 WHERE root_id=?', (root['id'],))
            if not base.is_dir():
                warnings.append('目录暂不可用：'+str(base)); continue
            groups = {}
            seen = 0
            for directory, dirs, filenames in os.walk(base, followlinks=False):
                dirs[:] = sorted(d for d in dirs if d not in SKIP and not d.startswith('.') and not (Path(directory)/d).is_symlink() and not (Path(directory)/d).is_junction())
                folder = Path(directory)
                if not folder.resolve().is_relative_to(base):
                    dirs[:] = []; continue
                marker_folder = None
                marker_item = None
                ancestor = folder
                while ancestor.is_relative_to(base):
                    marker = ancestor/'.mathcode.json'
                    if marker.is_file() and not marker.is_symlink() and marker.stat().st_size < 8192:
                        try:
                            marker_item = json.loads(marker.read_text(encoding='utf-8'))['item_id']
                            if marker_item not in valid_items: marker_item = None
                            marker_folder = ancestor; break
                        except (ValueError, KeyError, OSError):
                            pass
                    if ancestor == base: break
                    ancestor = ancestor.parent
                for name in sorted(filenames):
                    p = folder/name
                    if p.suffix.lower() not in EXTENSIONS or p.is_symlink() or not p.resolve().is_relative_to(base): continue
                    seen += 1
                    if seen > 5000:
                        warnings.append('目录超过5000个文本文件，已限制扫描：'+str(base)); dirs[:] = []; break
                    if p.stat().st_size > MAX_BYTES:
                        warnings.append('文件超过2MB，跳过：'+str(p)); continue
                    try:
                        content = p.read_bytes()
                        try: text = content.decode('utf-8-sig')
                        except UnicodeDecodeError: text = content.decode('gb18030')
                    except (OSError, UnicodeDecodeError):
                        warnings.append('文件暂不可读：'+str(p)); continue
                    group = marker_folder or (p if folder == base else folder)
                    key = group.relative_to(base).as_posix()
                    entry = groups.setdefault(key, {'name': group.stem if group.is_file() else group.name, 'item_id': marker_item or item_match(p.relative_to(base).parts, aliases), 'files': []})
                    entry['files'].append({'path': p.relative_to(group if group.is_dir() else folder).as_posix(), 'code': text})
                if seen > 5000: break
            for relative, group in groups.items():
                prior = c.execute('SELECT * FROM code_projects WHERE root_id=? AND relative_path=?', (root['id'], relative)).fetchone()
                identity = prior['id'] if prior else str(uuid.uuid4())
                # Once bound, a project stays with that item when labels or ordering change.
                item_id = prior['item_id'] if prior else group['item_id']
                encoded = json.dumps(group['files'], ensure_ascii=False, sort_keys=True)
                sha = hashlib.sha256(encoded.encode()).hexdigest()
                previous = c.execute('SELECT sha256 FROM code_versions WHERE project_id=? ORDER BY id DESC LIMIT 1', (identity,)).fetchone()
                stamp = now()
                c.execute('INSERT INTO code_projects VALUES (?,?,?,?,?,0,?) ON CONFLICT(id) DO UPDATE SET missing=0,name=excluded.name', (identity, root['id'], relative, group['name'], item_id, stamp))
                if not previous or previous[0] != sha:
                    c.execute('INSERT INTO code_versions(project_id,sha256,files,created_at) VALUES (?,?,?,?)', (identity, sha, encoded, stamp))
                    c.execute('UPDATE code_projects SET updated_at=? WHERE id=?', (stamp, identity))
        projects = [dict(r) for r in c.execute('''SELECT p.*,r.path root_path,COALESCE(l.label,i.id) label,i.title,
            (SELECT COUNT(*) FROM code_versions v WHERE v.project_id=p.id) versions
            FROM code_projects p JOIN code_roots r ON r.id=p.root_id LEFT JOIN items i ON i.id=p.item_id
            LEFT JOIN item_labels l ON l.item_id=i.id ORDER BY p.updated_at DESC,p.name''')]
        for p in projects:
            p['path'] = str(Path(p['root_path'])/p['relative_path'])
            # Keep real paths and project identities stable, including existing attempts.
            if p['item_id'] and re.fullmatch(r'第\d+次', p['name']):
                p['name'] = f"{p['label']} · {p['title']} · {p['name']}练习"
        return {'projects': projects, 'roots': roots, 'managed_root': str(managed_root(db)), 'warnings': warnings, 'items': labels(c)}

def detail(db, project_id, version=None):
    with connect(db) as c:
        project = c.execute('SELECT * FROM code_projects WHERE id=?', (project_id,)).fetchone()
        if not project: raise ValueError('练习不存在')
        row = c.execute('SELECT * FROM code_versions WHERE project_id=?'+(' AND id=?' if version else '')+' ORDER BY id DESC LIMIT 1', (project_id, version) if version else (project_id,)).fetchone()
        if not row: raise ValueError('版本不存在')
        versions = [dict(v) for v in c.execute('SELECT id,created_at FROM code_versions WHERE project_id=? ORDER BY id DESC', (project_id,))]
        return {'project': dict(project), 'version': row['id'], 'files': json.loads(row['files']), 'versions': versions}

def bind(db, project_id, item_id):
    with connect(db) as c:
        if item_id and not c.execute("SELECT 1 FROM items WHERE id=? AND subject='cpp' AND kind='question'", (item_id,)).fetchone():
            raise ValueError('题目不存在')
        if not c.execute('SELECT 1 FROM code_projects WHERE id=?', (project_id,)).fetchone(): raise ValueError('练习不存在')
        c.execute('UPDATE code_projects SET item_id=? WHERE id=?', (item_id or None, project_id))
    return {'bound': True}

def create(db, item_id=None, name=''):
    base = managed_root(db).resolve()
    with connect(db) as c:
        ensure_roots(db, c)
        if item_id:
            item = next((r for r in labels(c) if r['id'] == item_id), None)
            if not item: raise ValueError('题目不存在')
            parent = base/naming(item['label'])
            parent.mkdir(exist_ok=True)
            number = 1
            while (parent/f'第{number:02d}次').exists(): number += 1
            target = parent/f'第{number:02d}次'
        else:
            name = str(name).strip()
            if not re.fullmatch(r'[\w\u4e00-\u9fff .-]{1,64}', name) or name in ('.','..') or name.endswith(('.', ' ')):
                raise ValueError('项目名称可用中文、字母、数字、空格、下划线和短横线')
            target = base/name
        if not target.resolve().is_relative_to(base): raise ValueError('路径无效')
        target.mkdir(exist_ok=False)
        configure(base)
        if item_id:
            (target/'.mathcode.json').write_text(json.dumps({'item_id': item_id}, ensure_ascii=False, indent=2), encoding='utf-8')
        (target/'main.cpp').write_text('#include <iostream>\n\nint main() {\n    // 在这里开始你的练习\n    return 0;\n}\n', encoding='utf-8')
    result = scan(db)
    project = next(p for p in result['projects'] if Path(p['path']) == target)
    return project

def open_path(db, project_id=None, action='vscode', relative_path=None):
    base=managed_root(db).resolve()
    if action == 'materials':
        path = ROOT/'学习资料/C++Learning/开始学习.html'
    elif relative_path is not None:
        aliases = base/'.mathcode-paths.json'
        if aliases.is_file():
            relative_path = json.loads(aliases.read_text(encoding='utf-8')).get(relative_path, relative_path)
        path = (base/relative_path).resolve()
        if not path.is_relative_to(base) or not path.is_file() or path.suffix.lower() not in EXTENSIONS:
            raise ValueError('请打开“我的代码”中的练习文件')
    elif project_id:
        with connect(db) as c:
            row = c.execute('SELECT r.path,p.relative_path FROM code_projects p JOIN code_roots r ON r.id=p.root_id WHERE p.id=?', (project_id,)).fetchone()
            if not row: raise ValueError('练习不存在')
            base = Path(row['path']).resolve()
            path = (base/row['relative_path']).resolve()
            if not path.is_relative_to(base): raise ValueError('路径超出代码目录')
    else:
        path = managed_root(db)
    if action != 'materials':
        editable_path(base)
        editable_path(path)
    if not path.exists(): raise ValueError('文件已移动或目录不存在')
    if action == 'vscode':
        executable = Path(os.environ.get('LOCALAPPDATA',''))/'Programs/Microsoft VS Code/Code.exe'
        if not executable.is_file(): raise ValueError('未找到 VS Code，请手动打开代码目录')
        args=[str(executable),'--reuse-window']
        workspace = base/'我的代码.code-workspace'
        context = workspace if workspace.is_file() else base
        if base == managed_root(db).resolve() and workspace.is_file():
            args.append(str(workspace))
            active = path if path.is_file() else next(iter(sorted(path.glob('*.cpp'))), None)
            if active: args.append(str(active))
        elif path.is_file():
            args.extend([str(context),str(path)])
        elif not (path/'.vscode').is_dir() and (base/'.vscode').is_dir():
            args.append(str(context))
            active=next(iter(sorted(path.glob('*.cpp'))),None)
            if active:args.append(str(active))
        else:args.append(str(context if path == base else path))
        subprocess.Popen(args, creationflags=subprocess.CREATE_NO_WINDOW)
    elif action in ('folder','materials'):
        os.startfile(str(path if path.is_dir() or action == 'materials' else path.parent))
    else: raise ValueError('打开方式无效')
    return {'opened': str(path)}
