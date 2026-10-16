"""Read-only, heading-level navigation over the current imported courseware."""
import json
import re

CATEGORIES = [
    ('start', '开始与工具', '程序骨架、头文件、命名空间与 VS Code'),
    ('types', '变量与类型', '声明、初始化、常量与类型转换'),
    ('expressions', '表达式与运算', '算术、比较、逻辑与自增'),
    ('io', '输入与输出', 'cout、cin、getline 与格式控制'),
    ('branch', '条件与分支', 'if / else、else if 与 switch'),
    ('loop', '循环与跳转', 'while、do-while、for、break 与 continue'),
    ('functions', '函数与作用域', '声明、调用、参数、重载与递归'),
    ('collections', '数组与字符串', '下标、二维数组、string 与 vector'),
    ('pointers', '指针与引用', '地址、解引用、const 与生命周期'),
    ('files', '结构体与文件', 'struct、记录、文件读取与写入'),
    ('classes', '类与多文件', '封装、构造、复制与头文件'),
    ('advanced', '继承与标准库', '多态、异常、模板、STL 与智能指针'),
    ('review', '课程与综合练习', '学习路线、考核、软件设计与复习'),
]


def headings(text):
    """Ignore headings inside fenced examples, including four-backtick fences."""
    result = []
    fence = None
    offset = 0
    for line in text.splitlines(keepends=True):
        marker = re.match(r'^\s*(`{3,}|~{3,})', line)
        if marker:
            token = marker[1]
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
        elif fence is None:
            match = re.match(r'^## (.+?)\s*#*\s*$', line)
            if match:
                result.append((offset, match[1]))
        offset += len(line)
    return result


def category(identity, title):
    # Narrow subjects take priority over names incidentally mentioned in a heading.
    if identity.startswith('E2067-L'):
        return {'00': 'review', '01': 'io', '02': 'loop', '03': 'functions',
                '04': 'collections', '05': 'pointers', '06': 'classes',
                '07': 'advanced', '08': 'review'}[identity[-2:]]
    chapter = identity.split('-', 1)[-1][:2]
    fixed = {'00': 'start', '03': 'pointers', '04': 'files', '05': 'classes',
             '06': 'classes', '07': 'advanced', '08': 'review', '09': 'review'}
    if chapter in fixed:
        return fixed[chapter]
    if chapter == '01':
        for prefix, key in [('一', 'start'), ('二', 'types'), ('三', 'expressions'),
                            ('四', 'io'), ('五', 'branch'), ('六', 'loop'),
                            ('七', 'collections'), ('八', 'functions')]:
            if title.startswith(prefix + ' ·'):
                return key
    for pattern, key in [
        (r'if|else|switch|case|条件表达式', 'branch'),
        (r'while|for|break|continue|嵌套循环', 'loop'),
        (r'数组|矩阵|range-for', 'collections'),
        (r'函数|参数|递归|作用域|重载|static 局部', 'functions'),
        (r'cin|cout|getline|setw|precision|输入|输出|箱子费用', 'io'),
        (r'char|string|字符', 'collections'),
        (r'类型|声明|初始化|赋值|sizeof|cast', 'types'),
        (r'const|运算|\+\+|复合', 'expressions'),
    ]:
        if re.search(pattern, title, re.I):
            return key
    return 'review'


def catalog(connection):
    entries = []
    for row in connection.execute("SELECT id,title,section,payload FROM items WHERE subject='cpp' AND kind='lesson' ORDER BY rowid"):
        identity, title, section, payload = row
        text = json.loads(payload).get('question_md', '')
        parts = headings(text)
        # The short supplements form complete worked lessons; keep their examples
        # and execution explanations together, rather than exposing generic headings.
        if identity.startswith('E2067-L') or not parts:
            entries.append(dict(key=identity + ':all', item_id=identity, heading=None,
                                title=title, document=title, section=section,
                                category=category(identity, title)))
            continue
        for index, (_, heading) in enumerate(parts):
            if re.search(r'学习地图|本章地图|本章衔接|来源与覆盖索引|图片与操作依据|从你正在做', heading):
                continue
            short = re.sub(r'^[一二三四五六七八九十]+ · ', '', heading)
            entries.append(dict(key=f'{identity}:{index}', item_id=identity, heading=index,
                                title=short, document=title, section=section,
                                category=category(identity, heading)))
    return dict(categories=[dict(id=k, title=t, description=d) for k, t, d in CATEGORIES], entries=entries)
