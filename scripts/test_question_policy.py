"""Classification regression: instruction-only imports never become exercises."""
from pathlib import Path
import copy
import json
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from study.importer import import_library
from study.question_policy import prepare_question
from study.storage import ROOT, connect, initialize, validate_db
from study import practice
from audit_question_bank import audit


class QuestionPolicyTests(unittest.TestCase):
    @unittest.skipUnless((ROOT/'学习资料/C++Learning/练习题/EEEE1044题目清单.json').exists(), 'Private course fixture is not distributed')
    def test_reviewed_source_and_optional_pattern_are_distinguished(self):
        questions = json.loads((ROOT/'学习资料/C++Learning/练习题/EEEE1044题目清单.json').read_text(encoding='utf-8-sig'))
        guidance, cleaned = [], []
        for q in questions:
            before = {'question_md': q['original'], 'answer_md': 'unrelated answer',
                      'programs': [{'code': 'unrelated code'}],
                      'references': [{'role': 'question', 'page': q['page']}, {'role': 'answer'}]}
            snapshot = copy.deepcopy(before)
            kind, title, after = prepare_question(q['title'], before)
            self.assertEqual(before, snapshot)
            if kind == 'guidance':
                guidance.append(q['id'])
                self.assertNotIn('programs', after)
                self.assertNotIn('answer_md', after)
                self.assertFalse(any(r['role']=='answer' for r in after['references']))
            elif after != before:
                cleaned.append(q['id'])
                self.assertEqual(after['answer_md'], before['answer_md'])
                self.assertEqual(after['programs'], before['programs'])
                self.assertNotIn('If you have finished', after['question_md'])
                if q['id']=='C-S3-30':
                    self.assertIn('modifying the program for Q6', after['question_md'])
                    self.assertIn('* * * *', after['question_md'])
            self.assertEqual(prepare_question(title, after), (kind, title, after))
        self.assertEqual(guidance, ['C-S2-01', 'C-S3-01', 'C-S4-01', 'C-S5-01'])
        self.assertEqual(cleaned, ['C-S1-40', 'C-S2-31', 'C-S3-30', 'C-S4-28', 'C-S5-16', 'C-S6-A', 'C-S7-08'])

    def test_real_short_or_referenced_questions_stay_questions(self):
        for text in ('Use switch-case to solve Question 26.',
                     'Explain the function of each line in the Hello World! project.',
                     'Review the code below and explain its output: int x=2;',
                     'Solve all the self-practice questions, case studies and example codes provided in the lecture note. Then write a function sum(a,b).'):
            payload = {'question_md': text, 'answer_md': 'answer'}
            self.assertEqual(prepare_question('Exercise', payload), ('question', 'Exercise', payload))

    def test_import_reclassifies_preserves_records_and_blocks_practice(self):
        text = '1. Solve all the self-practice questions, case studies and example codes provided in the lecture\nnote.'
        with tempfile.TemporaryDirectory(dir=ROOT/'.local') as tmp:
            work = Path(tmp); db = work/'data/study.db'; initialize(db)
            manifest = work/'manifest.json'
            manifest.write_text(json.dumps({'extra_questions': [
                {'id': 'notice', 'label': 'NOTICE01', 'title': 'Wrong exercise', 'question_md': text, 'answer_md': 'Invented answer'},
                {'id': 'real', 'title': 'Concrete task', 'question_md': 'Write a function that returns the sum of two integers.'}
            ]}), encoding='utf-8')
            with connect(db) as c:
                c.execute('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                          ('notice','cpp','question','old','test','test','1',None,'{}','old','old'))
                c.execute('INSERT INTO records VALUES (?,?,?,?,?)', ('notice','my notes','my result','思考中','before'))
                c.execute('INSERT INTO code_aliases VALUES (?,?)', ('NOTICE01','notice'))
            import_library(db, manifest)
            with connect(db) as c:
                self.assertEqual(c.execute("SELECT kind FROM items WHERE id='notice'").fetchone()[0], 'guidance')
                self.assertEqual(c.execute("SELECT notes FROM records WHERE item_id='notice'").fetchone()[0], 'my notes')
                self.assertEqual(c.execute("SELECT count(*) FROM code_aliases WHERE item_id='notice'").fetchone()[0], 1)
                self.assertEqual([r['id'] for r in practice.labels(c)], ['real'])
            with self.assertRaises(ValueError): practice.create(db, 'notice')
            result = import_library(db, manifest)
            self.assertEqual(result['items_changed'], 0)
            self.assertEqual(result['items_new'], 0)
            validate_db(db)

    def test_targeted_migration_keeps_existing_code_and_is_repeatable(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.local') as tmp:
            db = Path(tmp)/'data/study.db'; initialize(db)
            payload = {'question_md': 'Solve all the self-practice questions, case studies and example codes provided in the lecture note.',
                       'answer_md': 'unrelated answer', 'programs': [{'code': 'unrelated code'}]}
            with connect(db) as c:
                c.execute('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                          ('notice','cpp','question','old','test','test','1',None,json.dumps(payload),'old','old'))
                c.execute('INSERT INTO records VALUES (?,?,?,?,?)', ('notice','my notes','my result','思考中','before'))
            project = practice.create(db, 'notice')
            before = practice.detail(db, project['id'])
            report = audit(db, apply=True)
            self.assertTrue(report['applied'])
            self.assertTrue(report['personal_tables_preserved'])
            self.assertTrue(report['unrelated_items_unchanged'])
            after = practice.detail(db, project['id'])
            self.assertEqual(before['files'], after['files'])
            self.assertEqual(before['versions'], after['versions'])
            self.assertEqual(before['project']['relative_path'], after['project']['relative_path'])
            self.assertEqual(audit(db, apply=True)['changes'], [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
