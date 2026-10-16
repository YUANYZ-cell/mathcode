'use strict';
// Authored teaching content. School materials and learner code remain separate.
window.LessonTeaching=(()=>{
  const guides={};
  const headerHelp={
    iostream:'标准库的屏幕和键盘工具。cout 把数据送到屏幕，cin 从键盘取数据；<< 表示送出，>> 表示读入。',
    string:'标准库的文字工具。string 是能保存一整段文字的类型，getline 可以读取带空格的一整行；不是安装包。',
    iomanip:'标准库的输出格式工具。fixed 配合 setprecision(n) 控制小数位数；setw(n) 控制下一项的最小宽度，不改变原始数值。',
    vector:'标准库的可变长度数组。vector<int> 表示一组整数，push_back 在末尾增加一个数；尖括号指定元素类型。',
    fstream:'标准库的文件工具。ofstream 向文件写，ifstream 从文件读。文件名是磁盘上的名字，流变量是程序里负责读写的对象。',
    stdexcept:'标准库的异常类型。invalid_argument 表示参数不合要求，what() 取得错误文字。它不负责自动判断输入是否正确。',
    algorithm:'标准库的数据处理算法。sort 把一段元素排序；begin() 是范围开头，end() 是末尾之后的位置。',
    limits:'查询数值类型的限制。numeric_limits<T>::max()给出T能表示的最大值；用于cin.ignore时常作为可丢弃字符数量的上限。',
    memory:'智能指针工具。unique_ptr独占管理一个动态对象，离开作用域时自动释放；make_unique创建并交给它管理。先学指针和对象生命期再使用。',
    map:'按键查找值的关联容器。map<Key,Value>指定键和值的类型；下标操作在键不存在时可能插入新元素。',
    array:'固定长度的标准库数组。array<T,N>指定元素类型T和数量N；下标从0开始，不能越界。',
    utility:'通用辅助工具。move表示允许移动一个对象的资源，它本身不搬运数据；要结合接收它的构造或赋值操作理解。',
    sstream:'在内存中的文字上使用流式读写。istringstream把一段string当输入来源；它不直接打开磁盘文件。',
    cmath:'数学函数工具，例如sqrt求平方根、pow求幂、fmod求浮点余数。调用时给实参并使用返回值；输入范围由具体函数决定。',
    cctype:'字符分类与转换，例如isdigit判断数字字符、toupper转换大写。不是string整体转换工具。',
    cstdlib:'通用工具，例如rand生成伪随机整数、srand设置种子。它们不保证密码学安全，初学时先理解返回值和范围。',
    ctime:'时间工具，time可取得当前时间信息；常与随机数种子示例配合使用。',
    cstddef:'标准类型定义，例如size_t表示大小或数量、nullptr_t表示空指针字面量的类型。',
    cassert:'调试断言assert：检查程序员预期的条件。它不是用户输入验证，也不能替代正常错误处理。'
  };
  const skeleton=[['int main() {','程序从 main 的第一条语句开始执行；花括号包住入口函数的内容。'],['return 0;','结束程序并向操作系统报告正常结束；不会在屏幕打印 0。']];
  function program(body,headers=['iostream']){
    return headers.map(h=>'#include <'+h+'>').join('\n')+'\nusing namespace std;\n\nint main() {\n'+body.split('\n').map(l=>'    '+l).join('\n')+'\n    return 0;\n}\n';
  }
  function add(id,goal,prerequisites,code,expected,trace,modify,prompt,hint,edits,answerExpected,options={}){
    const answer=edits.reduce((s,[from,to])=>{if(!s.includes(from))throw Error(id+': missing replacement '+from);return s.replace(from,to);},code);
    guides[id]={id,goal,prerequisites,code,expected,trace,modify,stdin:options.stdin||'',
      practice:{id:'BP-'+id.toUpperCase(),prompt,hint,code:answer,stdin:options.answerInput??options.stdin??'',expected:answerExpected,
        fixtures:options.fixtures||{},written:options.answerWritten||{},},written:options.written||{}};
  }
  add('main','让电脑在屏幕显示一句话；先只学输出。','会新建并保存 main.cpp。',program('cout << "Hello" << \'\\n\'; // 把 Hello 送到屏幕，再换行。'),'Hello\n',
    ['进入 main，此时没有输入操作。','cout 送出 Hello；引号是代码语法，不会被打印。','换行，然后 return 0 结束。'],
    '只把 Hello 改成 Hi，运行后观察哪一部分变了。','独立编写一个完整程序，分两行输出 Ready 和 Go。不需要键盘输入。','可以写两条 cout；每行末尾需要换行。',[[ 'cout << "Hello" << \'\\n\';','cout << "Ready\\nGo\\n";']], 'Ready\nGo\n');
  add('variables','保存总数，再算平均数；看清整数与小数的差别。','会输出，知道除法 /。',program('const int count = 2; // count 保存数量 2；const 表示不能再改。\nint total = 5; // total 保存总数 5。\ndouble average = static_cast<double>(total) / count; // 先把 5 转成 5.0，再除以 2。\ncout << average << \'\\n\'; // 输出保存好的平均数。'),'2.5\n',
    ['count=2，total=5。','转换只产生一个临时的 5.0，total 本身仍是 int。','5.0/2 得到 2.5，存入 average，最后输出。'],
    '暂时去掉 static_cast<double>(...)，改成 total / count，预测结果并解释为什么是 2。','保存总数 7 和数量 2，用 double 算出平均数并输出。数量用 const，不能把结果写成固定文字。','先转换再除；把整数除法的结果存进 double 并不能补回已经丢掉的小数。',[[ 'int total = 5;','int total = 7;']], '3.5\n');
  add('if','根据一个条件决定输出哪句话。','变量、>= 比较；>= 表示大于或等于。',program('int score = 65; // 保存要判断的成绩。\nif (score >= 60) { // 检查成绩是否达到 60。\n    cout << "Pass\\n"; // 条件为真时，只执行这一条路径。\n} else { // 条件为假时，走另一条路径。\n    cout << "Fail\\n"; // 不及格时输出 Fail。\n}'),'Pass\n',
    ['score=65。','65>=60 为真，进入 if。','输出 Pass；else 整块跳过。'], '只把 score 改成 59，先预测再运行。','把成绩设为 60，使用 if/else 判断是否达到 60，分别输出 Pass 或 Fail。再自行用 59 检查另一条路径。','边界 60 应走及格路径，使用 >=。',[[ 'score = 65','score = 60']], 'Pass\n');
  add('elseif','把一个成绩分到三个互不重复的等级。','先会 if/else。',program('int score = 75; // 准备成绩。\nif (score >= 80) { // 先检查最高分段。\n    cout << "A\\n";\n} else if (score >= 60) { // 只有上一个条件为假，才检查这里。\n    cout << "B\\n";\n} else { // 前两个条件都为假时执行。\n    cout << "C\\n";\n}'),'B\n',
    ['75>=80 为假。','继续检查 75>=60，为真，输出 B。','整条 if/else if/else 结束，不再输出 C。'],'依次试 80、60、59；每次只改成绩。','设成绩为 59；80 及以上输出 A，60 到 79 输出 B，60 以下输出 C。用同一条 if/else if/else 完成。','从最高分段开始判断；不要写三个独立的 if。',[[ 'score = 75','score = 59']], 'C\n');
  add('switch','按菜单编号选择一项操作。','整数变量；先学过 if。',program('int choice = 2; // 菜单编号。\nswitch (choice) { // 用 choice 的值匹配 case。\ncase 1: // 当编号等于 1。\n    cout << "Start\\n";\n    break; // 离开 switch。\ncase 2: // 当编号等于 2。\n    cout << "Stop\\n";\n    break;\ndefault: // 没有任何 case 匹配时执行。\n    cout << "Unknown\\n";\n}'),'Stop\n',
    ['choice=2，直接找到 case 2。','输出 Stop。','break 离开 switch，default 不执行。'],'只把 choice 改成 9，检查 default。','菜单编号设为 3；保留编号 1 输出 Start、2 输出 Stop，再添加编号 3 输出 Help，其他编号输出 Unknown。','新增 case 3 后也要 break。',[[ 'choice = 2','choice = 3'],['default:', 'case 3:\n    cout << "Help\\n";\n    break;\ndefault:']], 'Help\n');
  add('while','从 1 开始重复输出，达到上限后停止。','变量、比较、赋值。',program('int n = 1; // 记录当前轮的数字。\nwhile (n <= 3) { // 每一轮开始前检查条件。\n    cout << n << \'\\n\'; // 输出当前数字。\n    n = n + 1; // 为下一轮准备；没有这一步会一直重复。\n}'),'1\n2\n3\n',
    ['n=1，条件真，输出1，再变成2。','n=2，输出2，再变成3；n=3，输出3，再变成4。','4<=3 为假，退出循环。'],'只把初值改成 4，预测为什么没有任何输出。','使用 while 从 1 到 4 逐行输出四个整数。不能把四条输出语句写死。','保留更新语句；上限是包含 4 的。',[[ 'n <= 3','n <= 4']], '1\n2\n3\n4\n');
  add('dowhile','理解“先做一次，再检查”的重复方式。','先会 while。',program('int n = 1;\ndo { // 先进入循环体。\n    cout << n << \'\\n\';\n    n = n + 1; // 每轮加 1。\n} while (n <= 3); // 最后检查条件；这里的分号不能漏。'),'1\n2\n3\n',
    ['先输出1，n变2，条件真。','输出2、3后，n变4，条件假。','do-while 的检查发生在每轮末尾。'],'只把初值改成 4：先输出 4，然后才退出。','把初值设为 5，使用 do-while 输出当前数，再加 1；继续条件仍是 n<=3。解释为什么会输出一次。','条件第一次检查之前，循环体已经执行了。',[[ 'n = 1','n = 5']], '5\n');
  add('for','重复次数明确时，把循环的三件事写在一起。','while、变量、比较；++i 表示 i 加 1。',program('for (int i = 0; i < 3; ++i) { // 初值0；每轮前检查小于3；每轮后加1。\n    cout << i << \'\\n\'; // 输出本轮的 i。\n}'),'0\n1\n2\n',
    ['初始化 i=0，只做一次；0<3，输出0。','更新到1，检查1<3，输出1；再更新到2，输出2。','更新到3，3<3为假。总共执行三轮。'],'只把 <3 改成 <=3，预测多出哪一轮。','使用 for 从 1 到 4 逐行输出。初始化、继续条件、更新都放在 for 括号内。','同时考虑起点和终点；从1开始，到包含4为止。',[[ 'int i = 0; i < 3','int i = 1; i <= 4']], '1\n2\n3\n4\n');
  add('jump','区分跳过一轮和结束整个循环。','先会 for 和 if。',program('for (int i = 1; i <= 5; ++i) {\n    if (i == 2) { continue; } // 等于2时跳过本轮剩余语句，但仍会执行 ++i。\n    if (i == 4) { break; } // 等于4时离开整个循环。\n    cout << i << \'\\n\'; // 只有没跳过也没退出才输出。\n}'),'1\n3\n',
    ['i=1 输出1；i=2 走continue，不输出2。','i=3 输出3。','i=4 走break，后面的5也不会再处理。'],'只把 break 改成 continue，观察 5 是否出现。','从1循环到5，跳过2；到5时结束循环。逐行输出其他遇到的数字。','先用 continue 跳过2，再用 break 在5停止。',[[ 'if (i == 4)','if (i == 5)']], '1\n3\n4\n');
  add('nested','按行和列访问一个二维表。','一维数组、for；下标从0开始。',program('int grid[2][2] = {{1, 2}, {3, 4}}; // 两行两列：第0行1、2；第1行3、4。\nfor (int row = 0; row < 2; ++row) { // 外层选择行。\n    for (int col = 0; col < 2; ++col) { // 内层逐个选择这一行的列。\n        cout << grid[row][col] << \' \'; // 先行下标，再列下标。\n    }\n    cout << \'\\n\'; // 这一行输出完，再换行。\n}'),'1 2 \n3 4 \n',
    ['row=0，col依次0、1，输出1和2；换行。','row=1，col重新从0开始，输出3和4；换行。','row变2，外层结束。内层每次都重新初始化。'],'把换行挪到内层循环，预测版式为什么变成每行一个数。','保存二维数组 {{5,6},{7,8}}，用两层 for 按行输出，每个数后加一个空格，每行末尾换行。','row 控制行，col 控制列；换行写在内层循环之后。',[[ '{{1, 2}, {3, 4}}','{{5, 6}, {7, 8}}']], '5 6 \n7 8 \n');
  add('io','从键盘读一个整数，再显示它。','int 变量、cout；本例先假设输入确实是整数。',program('int age = 0; // 先准备一个整数存放位置。\ncin >> age; // 等你输入20并回车，把20存入age。\ncout << "Age: " << age << \'\\n\'; // 文字和变量值连续输出。'),'Age: 20\n',
    ['age先是0。','执行cin时等待输入；输入20后age变20。','输出文字Age:，再输出20，最后换行。'],'再运行一次，只把键盘输入改成21；代码不变。','读入一个整数年龄，将它加1，输出 Next: 后接明年的年龄。输入只包含一个有效整数。','cin >> age 后，再计算 age+1。此题不需要循环或输入失败检查。',[[ '"Age: " << age','"Next: " << age + 1']], 'Next: 21\n',{stdin:'20\n'});
  add('getline','读入带空格的姓名，不在第一个空格处停止。','cout、string 的含义；本例没有前面的 cin >>。',program('string name; // 用string保存一整段文字。\ngetline(cin, name); // 从cin读到本行回车之前，空格也会保留。\ncout << "Hello, " << name << \'\\n\'; // 使用刚刚读到的姓名。',['iostream','string']),'Hello, Ada Lovelace\n',
    ['创建空的string变量name。','输入Ada Lovelace再回车，整行进入name。','输出Hello, Ada Lovelace；不把姓名拆成两个单词。'],'只把输入改成 Li Ming，确认中间空格仍然保留。','读取一整行地点名称，允许空格；输出 Place: 后接该地点。用 New York 测试。','这里只有getline，不需要提前使用ws或ignore；混用cin>>的问题留到后续讲义。',[[ '"Hello, "','"Place: "']], 'Place: New York\n',{stdin:'Ada Lovelace\n',answerInput:'New York\n'});
  add('format','显示金额时保留两位小数，并指定宽度。','double、cout；先不同时学所有格式工具。',program('double price = 12.5; // 原始数值仍是12.5。\ncout << fixed << setprecision(2); // 后续小数使用定点格式，显示两位小数。\ncout << setw(8) << price << \'\\n\'; // 下一项最少占8列，默认在左边补空格。',['iostream','iomanip']),'   12.50\n',
    ['fixed和setprecision设置显示方式，没有输出数字。','12.50占5列；setw(8)要求8列，所以前面补3个空格。','只改变显示，不把price本身改成字符串。'],'只把 setw(8) 改成 setw(6)，数一数前导空格。','金额设为7.5，输出为两位小数，最小宽度6。数字前应补空格，不能直接输出固定字符串。','7.50占4列，宽度6会补2个空格。',[[ 'price = 12.5','price = 7.5'],['setw(8)','setw(6)']], '  7.50\n');
  add('function','把加法命名为函数，并在 main 中使用结果。','变量、加法；先不使用引用、重载或递归。',
    '#include <iostream>\nusing namespace std;\nint add(int a, int b) { // 定义add：接收两个整数，返回一个整数。\n    return a + b; // 把和交回调用的位置。\n}\nint main() {\n    int result = add(2, 3); // 调用add，把返回值存入result。\n    cout << result << \'\\n\';\n    return 0;\n}\n','5\n',
    ['先从main开始，并不会从文件最上面的add开始执行。','遇到add(2,3)，暂时进入add，a=2、b=3，返回5。','回到main，result=5，再输出。'],'只把 add(2,3) 的第二个实参改成8。','定义 add 函数返回两个整数的和；main 调用 add(4,6)，保存结果后输出。','函数定义写在main外；调用需要括号和实际参数。',[[ 'add(2, 3)','add(4, 6)']], '10\n');
  add('reference','分清别名、地址和通过地址修改值。','整数变量、赋值；先知道变量占用一处内存。',program('int value = 3;\nint& alias = value; // alias是value的另一个名字，没有复制一个新整数。\nalias = 4; // 用别名修改，同一个value变成4。\nint* ptr = &value; // ptr保存value的地址；&value表示取地址。\n*ptr = 5; // 根据地址找到value，再把它改成5。\ncout << value << \'\\n\';'),'5\n',
    ['value=3；alias和value指同一个整数。','alias=4后，value也是4。','ptr指向value，*ptr=5后，value变5。这里ptr已指向有效对象。'],'只把 *ptr=5 改成 *ptr=9，观察最后的value。','创建整数value=10，为它建立引用和指针；先通过引用改成12，再通过指针改成15，输出value。','声明中的int&和表达式中的&value含义不同；*ptr表示指向的对象。',[[ 'value = 3','value = 10'],['alias = 4','alias = 12'],['*ptr = 5','*ptr = 15']], '15\n');
  add('vector','保存会增加长度的一组整数。','数组或一组数、for；先不学迭代器。',program('vector<int> values = {2, 4, 6}; // 创建一个保存int的vector，初始有三个元素。\nvalues.push_back(8); // 调用容器的成员函数，在末尾增加8。\nfor (int i = 0; i < 4; ++i) { // 本例添加后正好四个元素，下标0到3。\n    cout << values[i] << \' \'; // 按下标读取一个元素。\n}\ncout << \'\\n\';',['iostream','vector']),'2 4 6 8 \n',
    ['创建后是[2,4,6]，长度3。','push_back后是[2,4,6,8]，长度4。','循环依次读values[0]到values[3]。这个固定上限只适用于本例。'],'只把 push_back(8) 改成 push_back(10)，长度会不会改变？','vector初始保存1、3、5；在末尾追加7，用循环输出四个元素，每个数后有一个空格，最后换行。','需要<vector>；push_back是对具体容器values调用的。',[[ '{2, 4, 6}','{1, 3, 5}'],['push_back(8)','push_back(7)']], '1 3 5 7 \n');
  add('struct','把同一个传感器的编号和数值放在一条记录里。','int、double、变量；先不需要学习类。',
    '#include <iostream>\nusing namespace std;\nstruct Sensor { // 定义记录的类型，尚未创建具体记录。\n    int id; // 成员：编号。\n    double value; // 成员：测量值。\n}; // 类型定义结束要有分号。\nint main() {\n    Sensor s; // 按Sensor类型创建一条名为s的记录。\n    s.id = 1; // 点号表示访问这条记录的成员。\n    s.value = 12.5;\n    cout << s.id << \' \' << s.value << \'\\n\';\n    return 0;\n}\n','1 12.5\n',
    ['先定义Sensor的成员有哪些。','main中创建s，然后分别写入id=1、value=12.5。','点号取出这条记录的两个成员，再输出。'],'再创建第二条记录t，检查修改t是否会改变s。','定义Sensor结构体，包含整数id和小数value；创建记录，赋值为2和8.5，再输出两项，中间一个空格。','Sensor是类型；s是对象；s.id才是这一条记录的编号。',[[ 's.id = 1','s.id = 2'],['s.value = 12.5','s.value = 8.5']], '2 8.5\n');
  add('class','用公开函数读写类中保存的计数。','结构体、函数；第一次看类先不使用explicit和初始化列表。',
    '#include <iostream>\nusing namespace std;\nclass Counter { // 定义计数器类型。\nprivate: // 下面的成员只允许类内部访问。\n    int value = 0; // 每个对象各自保存一个计数。\npublic: // 下面的函数允许外部调用。\n    void set(int n) { value = n; } // 把参数n存进成员value。\n    void increment() { value = value + 1; } // 当前对象的计数加1。\n    int get() { return value; } // 把计数值交给调用者。\n};\nint main() {\n    Counter counter; // 创建一个具体计数器，初值0。\n    counter.set(3); // 调用公开函数，把计数设为3。\n    counter.increment(); // 当前计数变4。\n    cout << counter.get() << \'\\n\'; // get返回4，再交给cout。\n    return 0;\n}\n','4\n',
    ['counter创建后value=0。','set(3)后value=3；increment()后value=4。','get()返回4；外部不能直接写counter.value。'],'只把 set(3) 改成 set(8)，先预测输出。','使用Counter类的公开接口，把初值设为8，调用两次increment，再输出计数。不能直接访问private成员。','用对象.函数名()调用；两次调用会依次改变同一对象。',[[ 'counter.set(3)','counter.set(8)'],['counter.increment();','counter.increment();\n    counter.increment();']], '10\n');
  add('destructor','观察对象创建与销毁的时刻。','类、构造函数、花括号作用域。',
    '#include <iostream>\nusing namespace std;\nclass Trace {\npublic:\n    Trace() { cout << "Begin\\n"; } // 构造函数：创建对象时自动调用。\n    ~Trace() { cout << "End\\n"; } // 析构函数：对象生命结束时自动调用。\n};\nint main() {\n    { // 开始一个内层作用域。\n        Trace object; // 创建object，立即输出Begin。\n        cout << "Work\\n";\n    } // 离开内层作用域，object销毁，输出End。\n    return 0;\n}\n','Begin\nWork\nEnd\n',
    ['创建object，先调用Trace()。','执行main中的输出Work。','到内层右花括号，自动调用~Trace()，输出End。RAII就是利用这种确定的生命期管理资源。'],'在内层右花括号后输出 After，判断它在 End 前还是后。','在对象销毁后，再输出 After。其余创建、工作、销毁顺序保持。','After的cout写在内层花括号外、return之前。',[[ '    return 0;','    cout << "After\\n";\n    return 0;']], 'Begin\nWork\nEnd\nAfter\n');
  add('virtual','通过共同的基类接口调用真实对象的方法。','先学会类、继承、引用和const成员函数；这是进阶课。',
    '#include <iostream>\nusing namespace std;\nclass Device { // 基类提供统一接口。\npublic:\n    virtual int read() const { return 0; } // virtual允许根据真实对象类型选择实现。\n    virtual ~Device() = default; // 使用编译器生成的虚析构。\n};\nclass Sensor : public Device { // Sensor继承Device的公开接口。\npublic:\n    int read() const override { return 42; } // override要求确实覆盖基类同名函数。\n};\nint main() {\n    Sensor sensor; // 真实对象是Sensor。\n    const Device& device = sensor; // 用基类引用看同一个对象，没有复制。\n    cout << device.read() << \'\\n\'; // 虚调用选择Sensor::read。\n    return 0;\n}\n','42\n',
    ['创建Sensor对象。','device是绑定到sensor的Device引用。','read是虚函数，真实对象是Sensor，所以返回42，不是基类的0。'],'只把Sensor返回的42改成7，基类代码不改。','保留Device基类，让Sensor覆盖read并返回7。通过Device引用调用read，再输出结果。','直接sensor.read()不能验证多态；要通过基类引用调用。',[[ 'return 42;','return 7;']], '7\n');
  add('exception','抛出错误后，跳到相应的处理位置。','函数、引用、const；先学会普通if错误处理。',program('try { // 这里放可能报告异常的操作。\n    throw invalid_argument("Invalid input"); // 创建并抛出错误，离开正常路径。\n} catch (const invalid_argument& error) { // 接住这种错误；error是错误对象的只读引用。\n    cout << error.what() << \'\\n\'; // what()取得错误文字。\n}',['iostream','stdexcept']),'Invalid input\n',
    ['进入try。','throw触发异常，寻找匹配的catch。','catch接到invalid_argument，what()返回Invalid input，随后输出。'],'只改错误文字，处理方式不变。','在try中抛出invalid_argument，信息为Bad age；在catch中取得并输出该信息。不要直接cout固定错误文字代替异常。','需要<stdexcept>；按const引用捕获，使用error.what()。',[[ '"Invalid input"','"Bad age"']], 'Bad age\n');
  add('template','同一个“比较两个数”的步骤用于不同类型。','先会普通函数、if/else、返回值；模板是进阶课。',
    '#include <iostream>\nusing namespace std;\ntemplate <typename T> // T是暂时代表类型的名字。\nT larger(T a, T b) { // 两个参数和返回值使用同一种T。\n    if (a > b) { return a; } // a更大时返回a。\n    return b; // 否则返回b；相等时返回b也正确。\n}\nint main() {\n    cout << larger(2, 5) << \'\\n\'; // 两个int，编译器推导T为int。\n    cout << larger(2.5, 1.5) << \'\\n\'; // 两个double，T为double。\n    return 0;\n}\n','5\n2.5\n',
    ['larger(2,5)使用整数版本，2>5为假，返回5。','larger(2.5,1.5)使用小数版本，比较为真，返回2.5。','T不是变量，也不是需要安装的库；模板是C++语言功能。'],'只把第一次调用改成larger(9,3)，小数调用不变。','编写larger函数模板，分别比较整数9和3、小数1.2和4.8；逐行输出较大值。','同一次调用用同类型实参；先写普通if比较，不需要?:。',[[ 'larger(2, 5)','larger(9, 3)'],['larger(2.5, 1.5)','larger(1.2, 4.8)']], '9\n4.8\n');
  add('algorithm','使用标准库排序，不自己编写排序过程。','先会vector、成员函数；再理解范围的起止。',program('vector<int> values = {3, 1, 2}; // 容器负责保存数据。\nsort(values.begin(), values.end()); // 算法在原容器里升序排序；end是末尾之后。\nfor (int value : values) { // 范围for：每轮取下一个元素的副本。\n    cout << value << \' \';\n}\ncout << \'\\n\';',['iostream','vector','algorithm']),'1 2 3 \n',
    ['最初的排列是3、1、2。','sort处理[begin,end)，原容器变成1、2、3。','范围for依次取1、2、3并输出；不能读取*end()。'],'把初始数据改成3、3、1，预测重复值会不会消失。','vector保存9、2、5，调用sort升序排序，再输出所有元素，每项后一个空格，最后换行。','容器来自<vector>，sort来自<algorithm>，两者都需要显式包含头文件。',[[ '{3, 1, 2}','{9, 2, 5}']], '2 5 9 \n');
  add('files','把一个数写入txt，关闭后再读回来。','变量、if、cout；先只处理一个整数，不混入struct或循环。',program('ofstream out("sample.txt"); // 在运行工作目录打开sample.txt；默认覆盖已有内容。\nif (!out) { return 1; } // 打开失败就停止；!表示“状态不是成功”。\nout << 42 << \'\\n\'; // 写进文件，不是显示到屏幕。\nout.close(); // 明确结束写入，再开始读取。\nifstream in("sample.txt"); // 从同一个运行目录打开文件。\nif (!in) { return 1; } // 读文件也要检查打开是否成功。\nint value = 0;\nif (!(in >> value)) { return 1; } // 读到整数才继续；坏数据不能当成功。\nin.close(); // 本例读完就关闭。\ncout << value << \'\\n\'; // 最后才在屏幕显示读回的数。',['iostream','fstream']),'42\n',
    ['out打开sample.txt；如果已有同名文件，其内容会被清空。只在自己的练习目录运行。','把42和换行写入磁盘文件，再close。','in重新打开，读回42，关闭，然后屏幕输出42。'],'只把写入的42改成17，检查屏幕和sample.txt是否都改变。','把整数17和换行写入你本次练习目录的sample.txt，关闭后读取该整数并输出。检查打开和读取是否成功。不要操作已有重要txt文件。','写入用ofstream，读取用ifstream；相对路径跟随运行工作目录；先关闭写文件再读。',[[ 'out << 42','out << 17']], '17\n',{written:{'sample.txt':'42\n'},answerWritten:{'sample.txt':'17\n'}});
  add('array','用下标读出固定数量的整数。','变量和for；数组下标从0开始。',program('int values[3] = {10, 20, 30}; // 创建三个int元素。\nfor (int i = 0; i < 3; ++i) { // 合法下标只有0、1、2。\n    cout << values[i] << \' \'; // 取出当前下标对应的值。\n}\ncout << \'\\n\';'),'10 20 30 \n',
    ['values[0]=10，values[1]=20，values[2]=30。','i从0到2，依次访问三个元素。','i变3后退出，绝不访问values[3]。sizeof的字节问题留到原讲义。'],'只把values[1]改成99，预测只会改变哪一个输出。','创建数组保存4、8、12，用for依次输出三个元素，每项后一个空格，最后换行。','数组长度3不代表最后一个下标是3。',[[ '{10, 20, 30}','{4, 8, 12}']], '4 8 12 \n');
  add('conditional','先计算一个真假值，再决定是否及格。','比较、bool、if/else；本课不把逻辑式和?:挤在一行。',program('int score = 75;\nbool valid = score >= 0 && score <= 100; // &&要求两个范围条件都为真。\nif (valid && score >= 60) { // 合法并且达到60才算通过。\n    cout << "Pass\\n";\n} else {\n    cout << "Fail\\n";\n}'),'Pass\n',
    ['75>=0为真，75<=100也为真，所以valid=true。','valid和score>=60都真。','执行Pass路径；&&表示“并且”，不是两个字符各算一次。'],'只把score改成101，解释虽然大于60却不通过的原因。','把成绩设为101；只有成绩在0到100内并达到60时输出Pass，其余输出Fail。用bool保存范围判断。','先判断范围再判断分数；不要只检查score>=60。',[[ 'score = 75','score = 101']], 'Fail\n');
  add('enum','给有限的状态取名字，减少记数字的负担。','变量、if、==；enum class是语言功能。',program('enum class State { Idle, Running }; // 定义只允许这两种命名状态的类型。\nState state = State::Running; // 声明State变量，取值是Running。\nif (state == State::Running) { // ::说明Running属于State。\n    cout << "Running\\n";\n}'),'Running\n',
    ['State是类型，Idle和Running是它的枚举值。','state取Running。','比较相等，输出Running。State::不能因using namespace std而省略。'],'把state改成State::Idle，观察原程序为什么不输出。','状态设为Idle，判断是否为Idle；是则输出Idle。使用enum class，不能用字符串代替状态。','变量赋值和比较两处都使用State::Idle。',[[ 'State::Running','State::Idle'],['state == State::Running','state == State::Idle'],['"Running\\n"','"Idle\\n"']], 'Idle\n');
  add('recursion','跟踪函数调用自身后如何逐层返回。','函数、if、乘法；先会非递归函数再学习。',
    '#include <iostream>\nusing namespace std;\nint factorial(int n) {\n    if (n <= 1) { return 1; } // 基本情况：在这里停止继续调用。\n    return n * factorial(n - 1); // 先求更小问题，再乘当前n。\n}\nint main() {\n    cout << factorial(4) << \'\\n\'; // 示例限定小的非负整数。\n    return 0;\n}\n','24\n',
    ['调用方向：f(4)等待4*f(3)，f(3)等待3*f(2)，f(2)等待2*f(1)。','f(1)命中基本情况返回1。','返回方向：f(2)=2，f(3)=6，f(4)=24；最后才输出。'],'只把factorial(4)改成factorial(3)，画出调用和返回顺序。','使用同一个递归阶乘函数计算5的阶乘并输出；保留n<=1的基本情况。仅处理本题的5。','每次参数减1；结果返回时才乘回去。本题不要求处理很大或负的输入。',[[ 'factorial(4)','factorial(5)']], '120\n');
  add('newdelete','认识动态数组的申请、使用和释放。','先会指针、数组、nullptr；普通练习优先使用vector。',program('int* values = new int[3]{}; // 动态申请三个int；{}把每个值初始化为0。\nvalues[1] = 7; // 给第二个元素赋值。\ncout << values[0] << \' \' << values[1] << \'\\n\';\ndelete[] values; // 释放new[]申请的数组，只能释放一次。\nvalues = nullptr; // 不再保留悬空地址；此后不能访问数组。'),'0 7\n',
    ['申请后是[0,0,0]。','values[1]=7后是[0,7,0]，输出前两项。','delete[]结束数组生命，随后指针置空；置空不等于释放，所以两步不能互相代替。'],'把赋值下标改成2，预测输出的前两项。','动态申请三个初始化为0的整数，把第二个设为9，输出前两项，然后释放并把指针置空。','new[]与delete[]必须配对，释放后不再访问。',[[ 'values[1] = 7','values[1] = 9']], '0 9\n');
  add('this','区分同名参数与当前对象的成员。','类、成员函数、指针；先学Counter入门。',
    '#include <iostream>\nusing namespace std;\nclass Counter {\n    int value = 0; // 这是对象自己的成员。\npublic:\n    void set(int value) { this->value = value; } // 左边是成员，右边是参数。\n    int get() const { return value; } // const承诺不通过this修改普通成员。\n};\nint main() {\n    Counter counter;\n    counter.set(9); // 参数value得到9，再写入当前counter的成员。\n    cout << counter.get() << \'\\n\';\n    return 0;\n}\n','9\n',
    ['counter.value初值0。','set(9)里参数value=9，this指向counter。','this->value=9把成员改成9，get读回9。直接value=value只会给参数自我赋值。'],'只把set(9)改成set(6)，跟踪参数与成员。','使用带同名参数的set函数，把counter的value设为6，随后通过const成员函数get输出。','使用this->value指定成员；箭头表示通过对象指针访问成员。',[[ 'counter.set(9)','counter.set(6)']], '6\n');
  add('copy','区分创建副本和给已有对象赋值。','构造函数、引用、const；这里是仅含整数的类。',
    '#include <iostream>\nusing namespace std;\nclass Counter {\n    int value;\npublic:\n    explicit Counter(int n) : value(n) {} // 构造时初始化成员；explicit限制隐式转换。\n    Counter(const Counter&) = default; // 让编译器生成逐成员拷贝构造。\n    Counter& operator=(const Counter&) = default; // 生成对已有对象的拷贝赋值。\n    int get() const { return value; }\n};\nint main() {\n    Counter a(3); // 创建a，保存3。\n    Counter b = a; // b还不存在：这是拷贝构造。\n    Counter c(0); // 先创建已有对象c。\n    c = b; // c已存在：这是拷贝赋值。\n    cout << b.get() << \' \' << c.get() << \'\\n\';\n    return 0;\n}\n','3 3\n',
    ['a的value=3。','创建b时复制a的成员，b.value=3。','c原为0，赋值后变3；输出b和c。此例没有裸指针资源，默认逐成员复制足够。'],'只把a初值改成8，预测b和c。','创建a保存8；通过拷贝构造创建b，再把b赋给已创建的c。输出b和c，中间一个空格。','b的声明与c=b发生在不同生命阶段。不要改成三次直接构造。',[[ 'Counter a(3)','Counter a(8)']], '8 8\n');
  add('overload','同名函数按参数类型或数量选择版本。','函数参数、构造函数；先逐个读两个版本。',
    '#include <iostream>\nusing namespace std;\nclass Counter {\n    int value;\npublic:\n    Counter() : value(0) {} // 不带参数时选这个构造函数。\n    explicit Counter(int n) : value(n) {} // 带整数参数时选这个。\n    int get() const { return value; }\n};\nint twice(int n) { return n * 2; } // 整数版本。\ndouble twice(double n) { return n * 2; } // 小数版本。\nint main() {\n    Counter a; // 选无参构造，值0。\n    Counter b(3); // 选int构造，值3。\n    cout << a.get() << \' \' << b.get() << \'\\n\';\n    cout << twice(2) << \' \' << twice(2.5) << \'\\n\'; // 分别选int、double版本。\n    return 0;\n}\n','0 3\n4 5\n',
    ['a无参数得0，b带3得3，先输出0 3。','twice(2)走int版本得4。','twice(2.5)走double版本得5。仅返回类型不同不构成重载。'],'只把twice(2.5)改成twice(1.25)，看小数版本。','保留两个构造函数和两个twice重载；创建默认a、初值7的b，再输出twice(4)与twice(1.25)。','4是int字面量，1.25是double字面量。',[[ 'Counter b(3)','Counter b(7)'],['twice(2) <<','twice(4) <<'],['twice(2.5)','twice(1.25)']], '0 7\n8 2.5\n');
  add('operator','让两个自定义金额对象可以相加。','类、构造、const引用、返回对象；这是进阶用法。',
    '#include <iostream>\nusing namespace std;\nclass Amount {\n    int value;\npublic:\n    explicit Amount(int n) : value(n) {} // 构造一个金额对象。\n    Amount operator+(const Amount& other) const { // 接收右侧对象，返回新的金额对象。\n        return Amount(value + other.value); // 当前对象与other的值相加，构造结果。\n    }\n    int get() const { return value; }\n};\nint main() {\n    Amount a(2), b(3);\n    Amount total = a + b; // 相当于a.operator+(b)。\n    cout << total.get() << \'\\n\';\n    return 0;\n}\n','5\n',
    ['a保存2，b保存3。','a+b进入a的operator+，other引用b。','2+3构造新Amount，total保存结果5；a、b的值未被修改。'],'只把b初值改成6，解释返回的是整数还是Amount。','创建Amount对象a=4、b=6，使用重载的+得到total，再通过get输出整数值。','operator+的返回类型是Amount，return需要构造Amount对象。',[[ 'Amount a(2), b(3)','Amount a(4), b(6)']], '10\n');
  add('friend','允许一个指定的普通函数读取私有成员。','类、private、函数、const引用；先熟悉正常公开接口。',
    '#include <iostream>\nusing namespace std;\nclass Box {\n    int value = 7; // class默认private，外部不能随意访问。\n    friend int read(const Box& box); // 指定read这个普通函数为友元。\n};\nint read(const Box& box) { return box.value; } // 因为获准，才能读取私有成员。\nint main() {\n    Box box;\n    cout << read(box) << \'\\n\'; // 普通函数调用；不是box.read()。\n    return 0;\n}\n','7\n',
    ['Box里的friend只是授予访问权限，不把read变成成员函数。','创建box，私有value=7。','普通函数read收到box的只读引用，读取并返回7。'],'只把value初值改成11，调用写法不变。','Box的私有value初始化为11，通过获准的友元read读取并输出。保持value私有。','调用是read(box)；不要把value移到public。',[[ 'value = 7','value = 11']], '11\n');
  add('static','让多个对象共用一个计数。','类、构造函数、::；与普通对象成员区别开。',
    '#include <iostream>\nusing namespace std;\nclass Counter {\npublic:\n    static int count; // 属于类的一份共享计数，不是每个对象各一份。\n    Counter() { ++count; } // 每创建一个对象，共享计数加1。\n};\nint Counter::count = 0; // 在类外定义并初始化共享计数。\nint main() {\n    Counter a, b; // 顺序创建两个对象，各自调用一次构造函数。\n    cout << Counter::count << \'\\n\'; // 用类名访问静态成员。\n    return 0;\n}\n','2\n',
    ['类外初始化count=0。','创建a后count=1，创建b后count=2。','Counter::count访问同一份共享数据，输出2；本例不统计销毁。'],'再创建第三个对象，预测共享计数。','创建三个Counter对象，让构造函数累计创建次数；输出Counter::count。不能直接把count赋为3。','增加一个对象声明，就会自动多调用一次构造函数。',[[ 'Counter a, b;','Counter a, b, c;']], '3\n');
  add('abstract','规定接口，把具体实现交给派生类。','先学会继承、virtual、override、引用；最后再学本课。',
    '#include <iostream>\nusing namespace std;\nclass Device {\nprotected:\n    int offset = 1; // 派生类可访问，外部不能直接访问。\npublic:\n    virtual int read() const = 0; // 纯虚函数：要求派生类实现，Device不能直接创建对象。\n    virtual ~Device() = default;\n};\nclass Sensor : public Device {\npublic:\n    int read() const override { return 41 + offset; } // 实现接口，使用继承的offset。\n};\nint main() {\n    Sensor sensor;\n    const Device& device = sensor; // 抽象类不能建对象，但可以作为引用类型。\n    cout << device.read() << \'\\n\';\n    return 0;\n}\n','42\n',
    ['Device规定read接口，但本身不可实例化。','创建Sensor，其中继承的offset=1。','通过Device引用调用，进入Sensor::read，41+1=42。'],'只把offset改成2，观察派生类的计算。','offset保持1，把Sensor实现改为返回10+offset；通过Device引用调用并输出。','不要创建Device对象；创建Sensor再绑定基类引用。',[[ 'return 41 + offset','return 10 + offset']], '11\n');

  function enrich(recipes){for(const r of recipes){const g=guides[r.id];if(g)Object.assign(r,{code:g.code,expected:g.expected,stdin:g.stdin});}
    const notes={io:'这里先假设输入是整数。输入失败如何处理，在原讲义的“输入检查与提前返回”继续学习。',getline:'这里只使用getline，不混用cin >>；混用时的残留换行与ws留在原讲义继续讲。',vector:'本例已知四个元素，用下标循环。长度不固定时，再学习size()或范围for。',class:'先用简单成员函数理解封装；构造函数、explicit、初始化列表在原讲义中分开学习。',files:'显式close后再读；ofstream默认覆盖同名文件。先只读写一个整数，再学习逐行读取与追加。',conditional:'先把真假判断保存为bool，再写if/else；?:等紧凑表达式在原讲义学习。'};
    for(const r of recipes)if(notes[r.id])r.notes=notes[r.id];}
  function libraryHTML(g){return `<h3>先认识本例的工具</h3><p>C++ 标准库是随编译环境提供的常用工具集合。<code>#include</code> 引入头文件中的声明；本例不需要另外下载库。<code>using namespace std;</code> 让下面能直接写 <code>cout</code> 等标准库名字；它不能替代头文件。</p><ul>${[...g.code.matchAll(/#include <([^>]+)>/g)].map(m=>`<li><code>&lt;${esc(m[1])}&gt;</code>：${esc(headerHelp[m[1]]||'本例所需的标准库声明。')}</li>`).join('')}</ul>`;}
  function explanationRows(code){return code.split('\n').map((line,i)=>{
    const at=line.indexOf(' // '),source=(at<0?line:line.slice(0,at)).trim();if(!source)return '';
    let why=at<0?'':line.slice(at+4);
    if(!why){why=skeleton.find(([s])=>source===s)?.[1]||(
      source.startsWith('#include')?'在编译之前引入上面介绍的头文件声明。':
      source==='using namespace std;'?'本作用域内可以省略标准库名字前面的std::。':
      source==='public:'?'接下来的成员可以从对象外部访问。':
      source.startsWith('cout <<')?'按从左到右的顺序输出；<<之间不会自动增加空格，\\n表示换行。':
      source==='}'?'结束当前代码块；循环会回去检查条件，函数会返回调用处。':
      source==='};'?'结束类型定义；类和结构体定义末尾需要分号。':
      /^int value(?: = \d+)?;$/.test(source)?'声明一个整数，保存当前对象或当前函数的数据；有等号时同时给初始值。':
      /^class \w+ \{$/.test(source)?'定义一个类类型，花括号内写它的数据和函数。此处尚未创建对象。':
      /^Counter counter;$/.test(source)?'创建名为counter的Counter对象，执行它的默认初始化。':
      /^Box box;$/.test(source)?'创建名为box的Box对象，成员value使用定义时的初始值。':
      /^Sensor sensor;$/.test(source)?'创建真实类型为Sensor的对象，随后可以用基类引用访问它。':
      /^int get\(\) const/.test(source)?'定义只读的成员函数get，把当前对象的value返回给调用者。':
      /^virtual ~Device/.test(source)?'声明虚析构并采用编译器的默认实现，支持通过基类接口正确结束对象生命。':
      source==='protected:'?'接下来的成员允许本类和派生类访问，外部调用者不能直接访问。':
      source.startsWith('int factorial(')?'定义接收整数n并返回整数的factorial函数；定义本身不立即执行。':
      /^int n = \d+;$/.test(source)?'创建循环计数整数n并给出起点；循环条件会读取这个值。':
      /^int score = \d+;$/.test(source)?'创建整数成绩score，接下来用它计算真假条件。':
      '结合下方执行过程，看这条语句操作的是哪个对象或变量。');}
    return `<tr><td>${i+1}</td><td><code>${esc(source)}</code></td><td>${esc(why)}</td></tr>`;
  }).join('');}
  function pathHTML(){return '<aside class="lesson-file-location"><h3>sample.txt 到底在哪？</h3><p>从平台打开 VS Code 后，选择本次练习的 <code>main.cpp</code>。本工作区的 <strong>F5（Debug active file）</strong>、<strong>运行任务 → C++: Build and run active file</strong> 和 <strong>Code Runner 的 Run Code</strong> 都配置为在这个 cpp 所在文件夹运行。若源码是 <code>我的代码/BPFILES/第01次/main.cpp</code>，本例文件就是同层的 <code>sample.txt</code>。左侧资源管理器展开这个文件夹即可查看。</p><p>这里说的是程序中的相对路径 <code>"sample.txt"</code>。手动在终端运行时，文件位置由终端的当前目录决定；先输入 <code>Get-Location</code>，必要时 <code>Set-Location -LiteralPath \'你的cpp所在文件夹\'</code>。写绝对路径或子文件夹路径会按你写的路径处理。VS Code 里“新建文本文件”则由保存对话框选择位置。</p><p>只创建文件名不会替你创建不存在的父文件夹。ofstream 默认覆盖同名文件；需要追加时另学 <code>ios::app</code>，不要拿重要文件做试验。</p></aside>';}
  function html(g,interactive=true){
    const rows=explanationRows(g.code);
    return `<section class="beginner-guide" data-guide="${g.id}"><p class="provenance">零基础带读 · 平台自编 · 一次先理解一个用法</p><h3>这次用它做什么</h3><p>${esc(g.goal)}</p><p><strong>先会这些：</strong>${esc(g.prerequisites)}</p>${libraryHTML(g)}<h3>先预测，再运行</h3><p>${g.stdin?`运行到输入语句时，在终端输入以下内容并回车：<code>${esc(g.stdin.trim())}</code>。`:'本例不需要键盘输入。'}先读代码，写下你预测的结果。完整代码单独保存为 <code>main.cpp</code>；保存后运行，不要把多个 main 拼到一起。</p><pre><code class="language-cpp">${esc(g.code)}</code></pre><h3>逐句看：这行在做什么</h3><div class="teaching-table"><table><thead><tr><th>行</th><th>代码</th><th>含义</th></tr></thead><tbody>${rows}</tbody></table></div><h3>跟着电脑走一遍</h3><ol>${g.trace.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><details class="teaching-output"><summary>运行后核对：预期输出${g.written['sample.txt']?'与文件内容':''}</summary><pre><code class="language-text">${esc(g.expected)}</code></pre>${g.written['sample.txt']?`<p>同层 sample.txt 的内容：</p><pre><code>${esc(g.written['sample.txt'])}</code></pre>`:''}</details>${g.id==='files'?pathHTML():''}<h3>只改一处，再解释结果</h3><p>${esc(g.modify)}</p><h3>本知识点专项练习 · ${esc(g.practice.id)}</h3><p>${esc(g.practice.prompt)}</p><details><summary>卡住再看提示</summary><p>${esc(g.practice.hint)}</p></details>${interactive?`<button class="primary-button" data-beginner-question="${g.practice.id}">独立做这道专项题 →</button>`:'<p>专项题可在主目录的“C++练习”中搜索上面的题号；当前回顾面板保留你的题目与草稿。</p>'}</section>`;
  }
  function explainHeaders(container){container?.querySelectorAll('pre code.language-cpp').forEach(code=>{if(code.closest('.beginner-guide')||code.parentElement.previousElementSibling?.classList.contains('library-notes'))return;const headers=[...new Set([...code.textContent.matchAll(/#include <([^>]+)>/g)].map(m=>m[1]))];if(!headers.length)return;const note=document.createElement('aside');note.className='library-notes';note.innerHTML='<strong>运行这个示例前，先认识它用到的头文件</strong><ul>'+headers.map(h=>`<li><code>&lt;${esc(h)}&gt;</code>：${esc(headerHelp[h]||'本示例使用的头文件；请先查明其中工具的用途，再阅读后面的调用。')}</li>`).join('')+'</ul>';code.parentElement.before(note);});}
  function exercises(category){return Object.values(guides).filter(g=>category==='review'?['io','function','files','class'].includes(g.id):recipeCategories[g.id]===category);}
  let recipeCategories={};
  function register(recipes){enrich(recipes);recipeCategories=Object.fromEntries(recipes.map(r=>[r.id,r.category]));}
  function exerciseList(category){const list=exercises(category);return `<section class="lesson-special-practice"><h3>本主题学完后 · 统一练习 <small>${list.length} 题</small></h3><p>读完本主题的各节讲解与示例后，在这里集中做专项题。每题只列一次；练习次数、代码和复盘分别保存，提示与答案按需展开。</p>${list.map(g=>`<button class="lesson-reference" data-beginner-question="${g.practice.id}"><strong>${esc(g.practice.id)} · ${esc(g.goal)}</strong><small>独立练习 →</small></button>`).join('')}</section>`;}
  let origin=null;
  async function openExercise(id){
    if(!safeLeave())return;
    origin={category:$('#topic-filter').value,source:$('#section-filter').value,search:$('#search').value,key:state.reading?state.catalogOriginKey:null,scroll:$('#reading-scroll').scrollTop,catalogScroll:$('main').scrollTop,view:document.querySelector((state.reading?'#reader':'#question-nav')+' [data-lesson-view][aria-pressed=true]')?.dataset.lessonView||'topics'};
    await switchKind('question');await openItem(id,false);
    if(state.current?.id!==id)return;
    const b=document.createElement('button');b.className='text-button';b.id='back-to-lesson';b.textContent='← 返回刚才的教案';$('#reader').prepend(b);
    b.onclick=async()=>{if(!safeLeave())return;const back=origin;await switchKind('lesson');document.querySelector(`#question-nav [data-lesson-view="${back.view}"]`)?.click();$('#topic-filter').value=back.category;$('#section-filter').value=back.source;$('#search').value=back.search;LessonLibrary.filter();if(back.key&&!back.key.startsWith('doc:'))await LessonLibrary.open(back.key);else if(back.key?.startsWith('doc:'))await openItem(back.key.slice(4),false);$('#reading-scroll').scrollTop=back.scroll;if(!back.key){$('main').scrollTop=back.catalogScroll;document.querySelector(`[data-beginner-question="${id}"]`)?.focus({preventScroll:true});}};
  }
  function questions(recipes){return Object.values(guides).map(g=>{const r=recipes.find(r=>r.id===g.id);return {id:g.practice.id,title:r.title+' · 独立专项',section:'零基础专项练习',topic:r.category,number:g.practice.id,question_md:`# ${r.title} · 独立专项\n\n本题为平台自编，配合现有教案使用。\n\n## 任务\n\n${g.practice.prompt}\n\n## 先修\n\n${g.prerequisites}\n\n${g.practice.stdin?'## 测试输入\n\n```text\n'+g.practice.stdin+'```\n\n':''}<details>\n<summary>卡住再看提示</summary>\n\n${g.practice.hint}\n\n</details>`,answer_provenance:'平台自编参考答案 · 经真实编译与输入输出核验后发布',answer_md:`## 解题思路\n\n${g.practice.hint}\n\n## 完整参考程序\n\n\`\`\`cpp\n${g.practice.code}\`\`\`\n\n## 自测输出\n\n\`\`\`text\n${g.practice.expected}\`\`\`\n${Object.entries(g.practice.written).map(([n,t])=>'\n文件 '+n+'：\n\n```text\n'+t+'```\n').join('')}`};});}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-beginner-question]');if(b)openExercise(b.dataset.beginnerQuestion).catch(err=>toast(err.message));});
  return {guides,register,html,explainHeaders,exerciseList,questions,pathHTML};
})();
