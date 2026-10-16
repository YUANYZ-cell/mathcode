from pathlib import Path
import json,sys,tempfile,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from study.storage import initialize,connect,backup,restore,check_backup,ROOT
from study import practice as p
from study.importer import import_library

class PracticeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=ROOT/'.local');self.work=Path(self.temp.name);self.db=self.work/'data/study.db'
        initialize(self.db)
        with connect(self.db) as c:
            for identity in ('C-S1-01','C-S1-02'):
                c.execute('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?)',(identity,'cpp','question','Test '+identity,'Test','变量','1',None,'{}',identity,'initial'))
        self.root=p.managed_root(self.db);p.scan(self.db)
    def tearDown(self):self.temp.cleanup()
    def test_multiple_attempts_files_output_and_snapshots(self):
        first=p.create(self.db,'C-S1-01');second=p.create(self.db,'C-S1-01')
        self.assertNotEqual(first['id'],second['id']);self.assertIn('CS101',first['path'])
        folder=Path(first['path']);(folder/'main.cpp').write_text('int main(){return 42;}',encoding='utf-8');(folder/'result.txt').write_text('42\n',encoding='utf-8')
        p.scan(self.db);data=p.detail(self.db,first['id']);self.assertEqual(len(data['versions']),2)
        self.assertEqual({f['path'] for f in data['files']},{'main.cpp','result.txt'})
        old=p.detail(self.db,first['id'],data['versions'][-1]['id']);self.assertNotIn('42',old['files'][0]['code'])
        p.scan(self.db);self.assertEqual(len(p.detail(self.db,first['id'])['versions']),2)
        (folder/'main.cpp').unlink();(folder/'result.txt').unlink();p.scan(self.db)
        project=next(v for v in p.scan(self.db)['projects'] if v['id']==first['id']);self.assertTrue(project['missing'])
        self.assertEqual(len(p.detail(self.db,first['id'])['files']),2)
    def test_filename_auto_match_manual_bind_and_relabel(self):
        for name in ('CS101.cpp','CS101_2.cpp','unrelated.cpp'):(self.root/name).write_text('hello',encoding='utf-8')
        projects=p.scan(self.db)['projects'];known=[x for x in projects if x['item_id']=='C-S1-01'];self.assertEqual(len(known),2)
        unrelated=next(x for x in projects if x['name']=='unrelated');self.assertIsNone(unrelated['item_id'])
        p.bind(self.db,unrelated['id'],'C-S1-02');p.relabel(self.db,'C-S1-01','C-S1-09')
        self.assertTrue(all(x['label']=='C-S1-09' for x in p.scan(self.db)['projects'] if x['id'] in {v['id'] for v in known}))
        (self.root/'CS101_3.cpp').write_text('old alias',encoding='utf-8');p.scan(self.db)
        self.assertEqual(next(x for x in p.scan(self.db)['projects'] if x['name']=='CS101_3')['item_id'],'C-S1-01')
        with self.assertRaises(ValueError):p.relabel(self.db,'C-S1-02','CS109')
        p.relabel(self.db,'C-S1-02','CS101')
        (self.root/'CS101_4.cpp').write_text('ambiguous alias',encoding='utf-8')
        result=p.scan(self.db)['projects'];self.assertIsNone(next(x for x in result if x['name']=='CS101_4')['item_id'])
        self.assertEqual(next(x for x in result if x['id']==known[0]['id'])['item_id'],'C-S1-01')
    def test_incremental_insert_stable_id_and_label(self):
        manifest=self.work/'new.json'
        def write(label,title):
            manifest.write_text(json.dumps({'extra_questions':[{'id':'exercise-fixed-uuid','label':label,'title':title,'question_md':'Write a loop'}]}),encoding='utf-8')
        write('CS900','A new question');r=import_library(self.db,manifest);self.assertEqual(r['items_new'],1)
        project=p.create(self.db,'exercise-fixed-uuid');write('CS901','Updated title');r=import_library(self.db,manifest);self.assertEqual(r['items_new'],0)
        current=next(v for v in p.scan(self.db)['projects'] if v['id']==project['id']);self.assertEqual(current['label'],'CS901');self.assertEqual(current['item_id'],'exercise-fixed-uuid')
    def test_backup_restores_current_code_and_history(self):
        project=p.create(self.db,'C-S1-01');code=Path(project['path'])/'main.cpp';original=code.read_text(encoding='utf-8')
        saved=self.work/'backup';backup(self.db,saved);check_backup(saved)
        code.write_text('changed',encoding='utf-8');p.scan(self.db);restore(self.db,saved,self.work/'pre-restore')
        self.assertEqual(code.read_text(encoding='utf-8'),original)
        self.assertEqual(len(p.detail(self.db,project['id'])['versions']),1)
        self.assertTrue((self.work/'pre-restore/code/CS101/第01次/main.cpp').is_file())
    def test_path_and_read_boundaries(self):
        for name in ('../escape','C:\\escape','..'):
            with self.assertRaises(ValueError):p.create(self.db,name=name)
        project=p.create(self.db,'C-S1-01');folder=Path(project['path']);(folder/'secret.exe').write_bytes(b'MZ');(folder/'large.cpp').write_bytes(b'x'*(p.MAX_BYTES+1))
        result=p.scan(self.db);self.assertTrue(result['warnings']);self.assertEqual(len(p.detail(self.db,project['id'])['files']),1)
        with connect(self.db) as c:c.execute('UPDATE code_projects SET relative_path=? WHERE id=?',('../../outside',project['id']))
        with self.assertRaises(ValueError):p.open_path(self.db,project['id'])
        with patch('study.practice.subprocess.Popen') as launch:
            p.open_path(self.db,action='vscode');args=launch.call_args.args[0];self.assertEqual(args[-1],str(self.root/'我的代码.code-workspace'));self.assertIn('Code.exe',args[0])
        (self.root/'CS101.cpp').write_text('int main(){}',encoding='utf-8')
        source=next(v for v in p.scan(self.db)['projects'] if v['relative_path']=='CS101.cpp')
        with patch('study.practice.subprocess.Popen') as launch:
            p.open_path(self.db,source['id']);self.assertEqual(launch.call_args.args[0][-2:],[str(self.root/'我的代码.code-workspace'),source['path']])
    def test_managed_root_rebases_when_database_moves(self):
        with connect(self.db) as c:c.execute("UPDATE code_roots SET path='C:/old-machine/code' WHERE id='managed'")
        result=p.scan(self.db);self.assertEqual(result['roots'][0]['path'],str(self.root.resolve()))

    def test_retired_roots_are_not_reopened_or_scanned(self):
        retired=self.work/'retired-course';retired.mkdir()
        (retired/'CS101.cpp').write_text('old code',encoding='utf-8')
        with patch.object(p,'RETIRED_ROOT',retired):
            with self.assertRaisesRegex(ValueError,'已归档'):p.add_root(self.db,str(retired))
            # A backup can contain a previously linked root; preserve its history
            # without reading or opening the retired directory again.
            with connect(self.db) as c:
                c.execute('INSERT INTO code_roots VALUES (?,?)',('retired',str(retired)))
                c.execute('INSERT INTO code_projects VALUES (?,?,?,?,?,0,?)',('old-project','retired','CS101.cpp','old',None,'initial'))
            result=p.scan(self.db)
            self.assertTrue(any('已归档' in w for w in result['warnings']))
            with connect(self.db) as c:self.assertEqual(c.execute("SELECT COUNT(*) FROM code_versions WHERE project_id='old-project'").fetchone()[0],0)
            with patch('study.practice.subprocess.Popen') as launch:
                with self.assertRaisesRegex(ValueError,'已归档'):p.open_path(self.db,'old-project')
                launch.assert_not_called()
        with self.assertRaisesRegex(ValueError,'已归档'):p.add_root(self.db,str(ROOT/'学习资料/C++Learning'))

    def test_open_file_uses_the_managed_workspace(self):
        workspace=self.root/'我的代码.code-workspace';workspace.write_text('{"folders":[{"path":"."}]}',encoding='utf-8')
        (self.root/'CS101.cpp').write_text('int main(){}',encoding='utf-8')
        project=next(x for x in p.scan(self.db)['projects'] if x['relative_path']=='CS101.cpp')
        with patch('study.practice.subprocess.Popen') as launch:
            p.open_path(self.db,project['id'])
            self.assertEqual(launch.call_args.args[0][-2:],[str(workspace),project['path']])
        with patch('study.practice.subprocess.Popen') as launch:
            p.open_path(self.db,relative_path='CS101.cpp')
            self.assertEqual(launch.call_args.args[0][-2:],[str(workspace),project['path']])
        for name in ('../outside.cpp',str(ROOT/'学习资料/C++Learning/练习题/CS108.cpp'),'missing.cpp'):
            with self.assertRaises(ValueError):p.open_path(self.db,relative_path=name)

    def test_attempt_display_names_follow_binding_without_moving_files(self):
        first=p.create(self.db,'C-S1-01');second=p.create(self.db,'C-S1-01')
        self.assertEqual(first['name'],'C-S1-01 · Test C-S1-01 · 第01次练习')
        self.assertIn('第02次练习',second['name'])
        before=p.detail(self.db,first['id'])
        p.relabel(self.db,'C-S1-01','C-NEW-01')
        current=next(x for x in p.scan(self.db)['projects'] if x['id']==first['id'])
        self.assertIn('C-NEW-01',current['name']);self.assertEqual(current['path'],first['path'])
        self.assertEqual(p.detail(self.db,first['id'])['versions'],before['versions'])
        daily=p.create(self.db,name='日常项目')
        self.assertEqual(daily['name'],'日常项目')

    def test_lesson_import_and_source_references_are_repeatable(self):
        source=self.work/'lesson.md';source.write_text('Reference text',encoding='utf-8')
        manifest=self.work/'lessons.json'
        bundle={'extra_sources':[{'canonical_path':str(source),'subject':'cpp','section':'Course','role':'Notes'}],
                'extra_lessons':[{'id':'lesson-stable','title':'Lesson','question_md':'Theory',
                                  'source_refs':[{'path':str(source),'page':0}]}]}
        manifest.write_text(json.dumps(bundle),encoding='utf-8')
        self.assertEqual(import_library(self.db,manifest)['items_new'],1)
        self.assertEqual(import_library(self.db,manifest)['items_unchanged'],1)
        with connect(self.db) as c:
            item=c.execute("SELECT * FROM items WHERE id='lesson-stable'").fetchone()
            self.assertEqual(item['kind'],'lesson')
            self.assertEqual(json.loads(item['payload'])['references'][0]['source_id'],item['source_id'])
        bundle['extra_lessons'][0]['source_refs'][0]['page']=2
        manifest.write_text(json.dumps(bundle),encoding='utf-8')
        with self.assertRaises(ValueError):import_library(self.db,manifest)
        with connect(self.db) as c:self.assertEqual(c.execute("SELECT payload FROM items WHERE id='lesson-stable'").fetchone()[0],item['payload'])

    def test_changed_question_index_requires_visual_review(self):
        folder=self.work/'different-source/练习题';folder.mkdir(parents=True)
        (folder/'EEEE1044题目清单.json').write_text('[]',encoding='utf-8')
        (folder/'EEEE1044参考答案.json').write_text('{}',encoding='utf-8')
        manifest=self.work/'different.json'
        manifest.write_text(json.dumps({'cpp':{'root':str(folder.parent)}}),encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'重新核对题图显示规则'):import_library(self.db,manifest)
        with connect(self.db) as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM items').fetchone()[0],2)

if __name__=='__main__':unittest.main(verbosity=2)
