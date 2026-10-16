"""One editor configuration and one active-file executable for all exercises."""
from pathlib import Path
import json
import sys
from .storage import ROOT


def configure(base, force=False):
    base = Path(base)
    config = base/'.vscode'
    config.mkdir(exist_ok=True)
    if not force and (config/'tasks.json').exists():
        return
    compiler = Path.home()/'.local/w64devkit/bin/g++.exe'
    debugger = compiler.with_name('gdb.exe')
    python = Path(sys.executable)
    if python.name.lower() == 'pythonw.exe':
        python = python.with_name('python.exe')
    def read(name, default):
        path = config/name
        return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else default
    def write(name, value):
        (config/name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    task_label = 'C++: Build active file (GCC C++20)'
    sensor_label = 'C++: Build sensor project'
    run_label = 'C++: Build and run active file'
    build_script = str(ROOT/'scripts/build_cpp.py')
    tasks = read('tasks.json', {'version':'2.0.0', 'tasks':[]})
    tasks['tasks'] = [t for t in tasks['tasks'] if t.get('label') not in (task_label, sensor_label, run_label)]
    tasks['tasks'].insert(0, {
        'label':task_label, 'type':'process', 'command':str(python),
        'args':[build_script, '--compiler', str(compiler), '--output', '${workspaceFolder}/.build/active.exe', '${file}'],
        'options':{'cwd':'${fileDirname}'}, 'problemMatcher':['$gcc'],
        'group':{'kind':'build', 'isDefault':True}})
    tasks['tasks'].append({
        'label':run_label, 'type':'process', 'command':str(python),
        'args':[str(ROOT/'scripts/run_cpp.py'), '--compiler', str(compiler),
                '--output', '${workspaceFolder}/.build/run-active.exe', '${file}'],
        'options':{'cwd':'${fileDirname}'}, 'problemMatcher':['$gcc'],
        'presentation':{'reveal':'always', 'focus':True}})
    launch = read('launch.json', {'version':'0.2.0', 'configurations':[]})
    active_name = 'C++: Debug active file (GDB)'
    sensor_name = 'C++: Debug sensor project (main.cpp)'
    launch['configurations'] = [t for t in launch['configurations'] if t.get('name') not in (active_name, sensor_name)]
    active = {'name':active_name, 'type':'cppdbg', 'request':'launch',
              'program':'${workspaceFolder}/.build/active.exe', 'args':[], 'stopAtEntry':False,
              'cwd':'${fileDirname}', 'environment':[], 'externalConsole':False,
              'MIMode':'gdb', 'miDebuggerPath':str(debugger), 'preLaunchTask':task_label,
              'setupCommands':[{'description':'Enable GDB pretty-printing', 'text':'-enable-pretty-printing', 'ignoreFailures':True}]}
    launch['configurations'].insert(0, active)
    sensor = '原有练习/05_Advanced_Class_MultiFile/02_MultiFile'
    if (base/sensor/'sensor.cpp').exists():
        tasks['tasks'].append({
            'label':sensor_label, 'type':'process', 'command':str(python),
            'args':[build_script, '--compiler', str(compiler), '--output', '${workspaceFolder}/.build/sensor.exe',
                    '${workspaceFolder}/'+sensor+'/main.cpp', '${workspaceFolder}/'+sensor+'/sensor.cpp'],
            'options':{'cwd':'${workspaceFolder}/'+sensor}, 'problemMatcher':['$gcc'], 'group':'build'})
        launch['configurations'].append({**active, 'name':sensor_name, 'program':'${workspaceFolder}/.build/sensor.exe',
                                         'cwd':'${workspaceFolder}/'+sensor, 'preLaunchTask':sensor_label})
    write('tasks.json', tasks)
    write('launch.json', launch)
    if not (config/'c_cpp_properties.json').exists():
        write('c_cpp_properties.json', {'configurations':[{'name':'Win32-GCC', 'includePath':['${workspaceFolder}/**'],
              'defines':[], 'compilerPath':str(compiler), 'cppStandard':'c++20', 'intelliSenseMode':'windows-gcc-x64'}], 'version':4})
    workspace = read('../我的代码.code-workspace', {'folders':[{'path':'.'}], 'settings':{}})
    workspace['settings'].setdefault('files.encoding','utf8')
    workspace['settings'].update({'code-runner.runInTerminal':True,
                                 'code-runner.saveFileBeforeRun':True,
                                 'code-runner.fileDirectoryAsCwd':True})
    def ps_literal(value):
        return "'" + str(value).replace("'", "''") + "'"
    runner = '& ' + ps_literal(python) + ' ' + ps_literal(ROOT/'scripts/run_cpp.py')
    runner += ' --compiler ' + ps_literal(compiler)
    runner += ' --output ' + ps_literal(base/'.build/runner.exe') + " '$fullFileName'"
    workspace['settings'].setdefault('code-runner.executorMap', {})['cpp'] = runner
    workspace['settings'].setdefault('files.exclude',{}).update({'**/.build':True, '**/.mathcode.json':True, '**/.mathcode-paths.json':True})
    write('../我的代码.code-workspace', workspace)
