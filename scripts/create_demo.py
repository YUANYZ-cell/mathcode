"""Create original public-demo content without reading personal course data."""
from pathlib import Path
import hashlib, json, sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from study.storage import ROOT, initialize, connect

db = ROOT / 'data/study.db'
initialize(db)
lesson = '''# C++ 入门演示

## 四 · 输入与输出

`iostream` 提供控制台输入输出。`main` 是程序入口，`cout` 将结果显示到终端。

```cpp
#include <iostream>
using namespace std;

int main() {
    int width = 3;
    int height = 4;
    cout << width * height << endl;
    return 0;
}
```

程序先保存宽和高，再计算乘积，最终输出 12。先预测输出，再运行验证。

## 小练习

把宽和高改为从键盘输入，然后输出矩形面积。自己选择一组输入并记录预测与实际结果。
'''
examples = [
    ('L-01-demo', 'cpp', 'lesson', 'C++ 入门：矩形面积', lesson),
    ('C-S1-01', 'cpp', 'question', '读取两个整数并计算矩形面积', '输入两个正整数作为宽和高，输出它们的乘积。请自行选择测试输入，先记录预测，再运行验证。'),
    ('math-demo-01', 'math', 'question', '等差数列求和', '求 1 到 10 的所有整数之和，并说明你使用的计算方法。'),
]
with connect(db) as c:
    for identity, subject, kind, title, body in examples:
        payload = json.dumps({'question_md': body, 'question_format': 'markdown', 'question_images': [], 'answer_images': [], 'references': []}, ensure_ascii=False)
        c.execute('INSERT OR IGNORE INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?)', (identity,subject,kind,title,'演示内容','输入与输出','1',None,payload,title+' '+body,hashlib.sha256(payload.encode()).hexdigest()))
print('Original demo content is ready. Existing records were preserved.')
