"""Audit reviewed instruction prose; apply only affected items, preserving IDs."""
from pathlib import Path
from datetime import datetime
import argparse
import contextlib
import hashlib
import json
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from study.question_policy import prepare_question
from study.storage import ROOT, connect, digest, validate_db


def audit(db, apply=False):
    db = Path(db).resolve()
    protected_tables = ('records', 'code_projects', 'code_versions', 'code_aliases', 'item_labels', 'code_roots')
    with connect(db) as c:
        rows = [dict(r) for r in c.execute('SELECT * FROM items ORDER BY id')]
        protected = {t: [tuple(r) for r in c.execute('SELECT * FROM '+t+' ORDER BY rowid')] for t in protected_tables}
    changes = []
    updated = []
    for row in rows:
        if row['subject'] != 'cpp' or row['kind'] != 'question':
            continue
        payload = json.loads(row['payload'])
        kind, title, result = prepare_question(row['title'], payload)
        if kind == row['kind'] and title == row['title'] and result == payload:
            continue
        changes.append({'id': row['id'], 'before_kind': row['kind'], 'after_kind': kind,
                        'action': '移出题库并解除答案代码关联' if kind=='guidance' else '分离课末说明，保留真实题目与答案',
                        'references': result.get('references', [])})
        encoded = json.dumps(result, ensure_ascii=False, sort_keys=True)
        content_hash = hashlib.sha256((encoded+title+row['section']+row['topic']+str(row['source_id'])).encode()).hexdigest()
        updated.append({**row, 'kind': kind, 'title': title, 'payload': encoded, 'content_hash': content_hash})
    report = {'cpp_questions_reviewed': sum(r['subject']=='cpp' and r['kind']=='question' for r in rows),
              'math_questions_checked': sum(r['subject']=='math' and r['kind']=='question' for r in rows),
              'changes': changes, 'applied': False}
    if apply and changes:
        folder = db.parent.parent/'.local/question-classification'/datetime.now().strftime('migration-%Y%m%d-%H%M%S-%f')
        folder.mkdir(parents=True, exist_ok=False)
        with connect(db) as src, contextlib.closing(sqlite3.connect(folder/'study.db')) as dst:
            src.backup(dst)
        entry = {'source': str(db), 'backup': str(folder/'study.db'), 'file_count': 1, 'sha256': digest(folder/'study.db')}
        (folder/'manifest.json').write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding='utf-8')
        report['backup'] = entry
        with connect(db) as c:
            # Refuse to overwrite a concurrent edit between inspection and write.
            c.execute('BEGIN IMMEDIATE')
            current = [dict(r) for r in c.execute('SELECT * FROM items ORDER BY id')]
            if current != rows:
                raise ValueError('题库在审查期间已变化，请重新审查')
            for row in updated:
                c.execute('UPDATE items SET kind=?,title=?,payload=?,content_hash=? WHERE id=?',
                          (row['kind'], row['title'], row['payload'], row['content_hash'], row['id']))
            if any(protected[t] != [tuple(r) for r in c.execute('SELECT * FROM '+t+' ORDER BY rowid')] for t in protected_tables):
                raise ValueError('个人记录或代码关联发生变化，回滚')
        report['applied'] = True
    validate_db(db)
    with connect(db) as c:
        after = [dict(r) for r in c.execute('SELECT * FROM items ORDER BY id')]
        changed_ids = {r['id'] for r in changes} if apply else set()
        report['unrelated_items_unchanged'] = [r for r in rows if r['id'] not in changed_ids] == [r for r in after if r['id'] not in changed_ids]
        report['personal_tables_preserved'] = all(protected[t] == [tuple(r) for r in c.execute('SELECT * FROM '+t+' ORDER BY rowid')] for t in protected_tables)
        report['counts'] = [dict(r) for r in c.execute('SELECT subject,kind,count(*) count FROM items GROUP BY subject,kind')]
    report['integrity'] = 'ok'
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=ROOT/'data/study.db')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = audit(args.database, args.apply)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))
