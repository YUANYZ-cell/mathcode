"""Exercise migration, opening and actual GCC/GDB behaviour in an isolated workspace."""
from pathlib import Path
import json
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from study import practice
from study.storage import ROOT, initialize, connect, digest
from scripts.organize_code import organize
from scripts.build_cpp import build


class CodeStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=ROOT/'.local')
        self.work=Path(self.temp.name)
        self.db=self.work/'data/study.db'; initialize(self.db)
        with connect(self.db) as c:
            c.execute('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                      ('C-S1-01','cpp','question','Hello','Test','变量','1',None,'{}','Hello','initial'))
        self.base=practice.managed_root(self.db); practice.scan(self.db)
    def tearDown(self):
        self.temp.cleanup()
    def test_migration_keeps_identity_binding_all_old_versions_and_source_bytes(self):
        source=self.base/'CS101.cpp';source.write_bytes(b'// version one\r\nint main(){return 0;}\r\n')
        project=practice.scan(self.db)['projects'][0]
        source.write_bytes(b'// version two\r\nint main(){return 1;}\r\n');practice.scan(self.db)
        history=practice.detail(self.db,project['id'])['versions'];sha=digest(source)
        organize(self.db,self.work/'evidence')
        current=practice.scan(self.db)['projects'];self.assertEqual(len(current),1)
        self.assertEqual(current[0]['id'],project['id']);self.assertEqual(current[0]['item_id'],'C-S1-01')
        self.assertEqual(current[0]['relative_path'],'CS101/第01次');self.assertFalse(current[0]['missing'])
        self.assertEqual(digest(self.base/'CS101/第01次/main.cpp'),sha)
        after=practice.detail(self.db,project['id'])['versions'];self.assertEqual(after[1:],history)
        self.assertIn('version one',practice.detail(self.db,project['id'],history[-1]['id'])['files'][0]['code'])
        self.assertEqual(practice.create(self.db,'C-S1-01')['relative_path'],'CS101/第02次')
        with patch('study.practice.subprocess.Popen') as launch:
            practice.open_path(self.db,relative_path='CS101.cpp')
            self.assertEqual(launch.call_args.args[0][-2:],
                             [str(self.base/'我的代码.code-workspace'),str(self.base/'CS101/第01次/main.cpp')])
        self.assertEqual(organize(self.db,self.work/'second-evidence')['moves'],[])
    def test_failed_migration_rolls_back_files_and_database(self):
        (self.base/'CS101.cpp').write_text('int main(){}',encoding='utf-8')
        (self.base/'unknown.cpp').write_text('keep me',encoding='utf-8')
        original=practice.scan(self.db)['projects']
        with self.assertRaisesRegex(ValueError,'尚未关联'):organize(self.db,self.work/'evidence')
        self.assertTrue((self.base/'CS101.cpp').is_file());self.assertTrue((self.base/'unknown.cpp').is_file())
        self.assertFalse((self.base/'CS101').exists())
        self.assertEqual(practice.scan(self.db)['projects'],original)
    def test_attempts_share_editor_and_single_cache_and_unsafe_alias_is_rejected(self):
        first=practice.create(self.db,'C-S1-01');second=practice.create(self.db,'C-S1-01')
        self.assertFalse((Path(first['path'])/'.vscode').exists())
        self.assertFalse((Path(second['path'])/'.vscode').exists())
        task=json.loads((self.base/'.vscode/tasks.json').read_text(encoding='utf-8'))['tasks'][0]
        self.assertIn('${workspaceFolder}/.build/active.exe',task['args'])
        launch=json.loads((self.base/'.vscode/launch.json').read_text(encoding='utf-8'))['configurations'][0]
        self.assertEqual(launch['program'],'${workspaceFolder}/.build/active.exe')
        with patch('study.practice.subprocess.Popen') as opened:
            practice.open_path(self.db,first['id'])
            self.assertEqual(opened.call_args.args[0][-2:],
                             [str(self.base/'我的代码.code-workspace'),str(Path(first['path'])/'main.cpp')])
        (self.base/'.mathcode-paths.json').write_text(json.dumps({'old.cpp':'../../outside.cpp'}),encoding='utf-8')
        with self.assertRaises(ValueError):practice.open_path(self.db,relative_path='old.cpp')
    def test_real_build_run_debug_locals_reuse_and_failed_build(self):
        compiler=Path.home()/'.local/w64devkit/bin/g++.exe'
        first=Path(practice.create(self.db,'C-S1-01')['path'])/'main.cpp'
        first.write_text('#include <iostream>\nint main() {\n int answer=42;\n std::cout << answer << "\\n";\n return 0;\n}\n',encoding='utf-8')
        output=self.base/'.build/active.exe'
        self.assertEqual(build(compiler,[first],output),0)
        run=subprocess.run([str(output)],capture_output=True,text=True,timeout=10)
        self.assertEqual(run.stdout.strip(),'42')
        # GDB receives an ASCII relative executable argument; cwd is the actual Chinese directory.
        debug=subprocess.run([str(compiler.with_name('gdb.exe')),'-q','-batch','-ex','break main',
             '-ex','run','-ex','next','-ex','print answer','../../.build/active.exe'],
             cwd=first.parent,capture_output=True,text=True,timeout=20)
        self.assertEqual(debug.returncode,0,debug.stderr);self.assertIn('main.cpp',debug.stdout)
        self.assertIn('= 42',debug.stdout)
        second=Path(practice.create(self.db,'C-S1-01')['path'])/'main.cpp'
        second.write_text('int main(){return 7;}\n',encoding='utf-8')
        self.assertEqual(build(compiler,[second],output),0)
        self.assertEqual(subprocess.run([str(output)],timeout=10).returncode,7)
        self.assertEqual(list(self.base.rglob('*.exe')),[output])
        second.write_text('not valid C++',encoding='utf-8')
        self.assertNotEqual(build(compiler,[second],output),0)
        self.assertFalse(output.exists());self.assertFalse(list(output.parent.glob('build-*.exe')))


if __name__=='__main__':unittest.main(verbosity=2)
