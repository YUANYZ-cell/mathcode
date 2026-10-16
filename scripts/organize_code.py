"""Back up and organize legacy loose exercises without changing project identities."""
from pathlib import Path
from datetime import datetime
import argparse
from contextlib import closing
import json
import shutil
import sqlite3
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from study.storage import ROOT, connect, digest
from study.practice import managed_root, naming, scan
from study.code_workspace import configure


def organize(db, evidence):
    db, evidence = Path(db), Path(evidence)
    base = managed_root(db).resolve()
    evidence.mkdir(parents=True, exist_ok=False)
    shutil.copytree(base, evidence/'code')
    with closing(sqlite3.connect(db)) as source, closing(sqlite3.connect(evidence/'study.db')) as destination:
        source.backup(destination)
    before = {p.relative_to(base).as_posix():{'sha256':digest(p), 'bytes':p.stat().st_size}
              for p in base.rglob('*') if p.is_file()}
    for relative, entry in before.items():
        if digest(evidence/'code'/relative) != entry['sha256']:
            raise ValueError('备份核验失败：'+relative)
    manifest = {'source':str(base), 'backup':str(evidence/'code'), 'file_count':len(before), 'files':before,
                'database':{'source':str(db), 'backup':str(evidence/'study.db'), 'sha256':digest(evidence/'study.db')}}
    (evidence/'backup-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    alias_file = base/'.mathcode-paths.json'
    aliases = json.loads(alias_file.read_text(encoding='utf-8')) if alias_file.exists() else {}
    moves = []
    removed = []
    try:
        # The write transaction excludes the live scanner throughout file relocation.
        with connect(db) as c:
            c.execute('BEGIN IMMEDIATE')
            rows = {r['relative_path']:dict(r) for r in c.execute('''SELECT p.*,COALESCE(l.label,p.item_id) label
                      FROM code_projects p LEFT JOIN item_labels l ON l.item_id=p.item_id WHERE root_id='managed' ''')}
            for source in sorted(base.glob('*.cpp')):
                relative = source.relative_to(base).as_posix()
                row = rows.get(relative)
                if not row or not row['item_id']:
                    raise ValueError('散放代码尚未关联题目，请先关联：'+relative)
                parent = base/naming(row['label'])
                number = 1
                while (parent/f'第{number:02d}次').exists(): number += 1
                target = parent/f'第{number:02d}次'
                target.mkdir(parents=True)
                destination = target/'main.cpp'
                shutil.move(str(source),destination)
                moves.append({'project_id':row['id'],'from':relative,'to':destination.relative_to(base).as_posix(),
                              'item_id':row['item_id'],'sha256':before[relative]['sha256']})
                (target/'.mathcode.json').write_text(json.dumps({'item_id':row['item_id']},ensure_ascii=False,indent=2),encoding='utf-8')
                if digest(destination) != before[relative]['sha256']: raise ValueError('源码迁移核验失败：'+relative)
                c.execute('UPDATE code_projects SET relative_path=?,name=? WHERE id=?',
                          (target.relative_to(base).as_posix(),target.name,row['id']))
                aliases[relative] = destination.relative_to(base).as_posix()
            # Only generated executables and the known copied editor files are retired.
            for marker in sorted(base.glob('*/第*/.mathcode.json')):
                folder = marker.parent
                candidates = [folder/'main.exe', *(folder/'.vscode'/n for n in ('tasks.json','launch.json','c_cpp_properties.json'))]
                for path in candidates:
                    if not path.is_file(): continue
                    relative = path.relative_to(base).as_posix()
                    if digest(path) != before[relative]['sha256']: raise ValueError('文件在整理时发生变化：'+relative)
                    removed.append(relative)
                    path.unlink()
                local_config = folder/'.vscode'
                if local_config.exists() and not any(local_config.iterdir()): local_config.rmdir()
            configure(base, force=True)
            alias_file.write_text(json.dumps(aliases,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    except Exception:
        # A failed migration restores the known originals and lets the DB transaction roll back.
        for move in reversed(moves):
            destination = base/move['to']
            shutil.move(str(destination),base/move['from'])
            (destination.parent/'.mathcode.json').unlink(missing_ok=True)
            destination.parent.rmdir()
            if not any(destination.parent.parent.iterdir()): destination.parent.parent.rmdir()
        for relative in removed:
            target = base/relative; target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(evidence/'code'/relative,target)
        for relative in before:
            if relative.startswith('.vscode/') or relative in ('我的代码.code-workspace','.mathcode-paths.json'):
                shutil.copy2(evidence/'code'/relative,base/relative)
        if '.mathcode-paths.json' not in before: alias_file.unlink(missing_ok=True)
        raise
    result = scan(db)
    for move in moves:
        project = next(p for p in result['projects'] if p['id']==move['project_id'])
        if project['missing'] or project['item_id'] != move['item_id']: raise ValueError('代码关联核验失败')
    report = {'passed':True,'moves':moves,'retired_generated_files':removed,'backup':str(evidence),
              'root_cpp_files':len(list(base.glob('*.cpp'))), 'source_bytes_unchanged':True}
    (evidence/'migration-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',type=Path,default=ROOT/'data/study.db')
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    if not args.apply: parser.error('先确认代码目录，再使用 --apply；操作前自动生成带哈希的备份')
    print(json.dumps(organize(args.database,ROOT/'.local'/('code-layout-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))),ensure_ascii=False,indent=2))
