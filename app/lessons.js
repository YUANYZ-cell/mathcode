'use strict';
// Courseware navigation uses existing item IDs. It never writes learning data.
window.LessonLibrary=(()=>{
  let index={categories:[],entries:[]},view='topics',selected=null,style='using',sidebarScrollTop=0;
  try{style=localStorage.getItem('lesson-code-style')==='explicit'?'explicit':'using';}catch{}
  const active=()=>state.mode==='cpp'&&state.kind==='lesson';
  const clean=s=>String(s).toLowerCase().replace(/std::|[\s/、:：·_\-]/g,'');
  const standardNames=new Set('cout cin cerr endl fixed setprecision setw setfill left right showpoint defaultfloat boolalpha noboolalpha string getline vector array map find sort move make_unique unique_ptr numeric_limits streamsize ws ifstream ofstream istringstream invalid_argument runtime_error ios'.split(' '));
  // Mask comments and literals before editing identifiers, including raw strings.
  const protectedTokens=/(R"([^ ()\\\t\r\n]{0,16})\([\s\S]*?\)\2"|#[ \t]*include[ \t]*<[^>\n]+>|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
  function mapCode(code,fn){let last=0,out='';for(const m of code.matchAll(protectedTokens)){out+=fn(code.slice(last,m.index))+m[0];last=m.index+m[0].length;}return out+fn(code.slice(last));}
  function variant(code,target){
    if(target==='using'){
      let changed=false,hasUsing=false;
      mapCode(code,s=>{if(/\busing\s+namespace\s+std\s*;/.test(s))hasUsing=true;return s;});
      let result=mapCode(code,s=>s.replace(/\bstd\s*::\s*(?=[A-Za-z_])/g,()=>{changed=true;return '';}));
      if(changed&&!hasUsing){
        const includes=[...result.matchAll(/^[ \t]*#\s*include[^\n]*(?:\n|$)/gm)];
        const at=includes.length?includes.at(-1).index+includes.at(-1)[0].length:0;
        result=result.slice(0,at)+(at&&result[at-1]!=='\n'?'\n':'')+'using namespace std;\n'+result.slice(at);
      }
      return result;
    }
    let hasUsing=false;
    mapCode(code,s=>{if(/\busing\s+namespace\s+std\s*;/.test(s))hasUsing=true;return s;});
    if(!hasUsing)return code;
    return mapCode(code,s=>s.replace(/\busing\s+namespace\s+std\s*;[ \t]*\n?/g,'').replace(/\b[A-Za-z_]\w*\b/g,(word,at,text)=>standardNames.has(word)&&!/(?:\.|->|::)\s*$/.test(text.slice(0,at))?'std::'+word:word));
  }
  function recipe(id,title,category,description,body,expected,notes,headers=['iostream']){
    return {key:'syntax:'+id,id,title,category,description,expected,notes,section:'常用语法速查',document:'常用语法速查',item_id:null,
      code:headers.map(h=>'#include <'+h+'>').join('\n')+'\n\n'+(body.includes('int main(')?body:'int main() {\n'+body.split('\n').map(l=>'    '+l).join('\n')+'\n    return 0;\n}')+'\n'};
  }
  const recipes=[
    recipe('main','main / #include / using namespace','start','先认清完整 C++ 程序的固定骨架。','std::cout << "Hello" << \'\\n\';','Hello\n','头文件提供声明；using namespace std; 让标准库名字可省略 std::。main 是入口，return 0 表示正常结束。'),
    recipe('variables','变量 / const / static_cast','types','声明、赋值与转换分开理解。','const int count = 2;\nint total = 5;\ndouble average = static_cast<double>(total) / count;\nstd::cout << average << \'\\n\';','2.5\n','先把 total 转成 double，再做除法。const 变量初始化后不能再赋值。'),
    recipe('if','if / else','branch','两条路径中只执行一条。','int score = 65;\nif (score >= 60) {\n    std::cout << "Pass\\n";\n} else {\n    std::cout << "Fail\\n";\n}','Pass\n','先算条件，真走 if，假走 else。条件后不要误加分号；两边用花括号包住各自语句。'),
    recipe('elseif','if / else if / else','branch','多个条件按从上到下的顺序判断。','int score = 75;\nif (score >= 80) {\n    std::cout << "A\\n";\n} else if (score >= 60) {\n    std::cout << "B\\n";\n} else {\n    std::cout << "C\\n";\n}','B\n','命中第一条为真的路径后，跳过后面的分支。判断范围时先处理高分段。'),
    recipe('switch','switch / case / default','branch','按整数或字符的具体值选择分支。','int choice = 2;\nswitch (choice) {\ncase 1:\n    std::cout << "Start\\n";\n    break;\ncase 2:\n    std::cout << "Stop\\n";\n    break;\ndefault:\n    std::cout << "Unknown\\n";\n}','Stop\n','case 后面是常量。break 离开 switch；漏写会继续执行下一 case。string 不能直接作为 switch 的条件。'),
    recipe('while','while 循环','loop','先检查条件，适合不知道重复次数的任务。','int n = 1;\nwhile (n <= 3) {\n    std::cout << n << \'\\n\';\n    ++n;\n}','1\n2\n3\n','顺序是条件 → 循环体 → 再检查。必须让条件有机会变为假；初始条件为假时一次也不执行。'),
    recipe('dowhile','do-while 循环','loop','先执行一次，再决定是否重复。','int n = 1;\ndo {\n    std::cout << n << \'\\n\';\n    ++n;\n} while (n <= 3);','1\n2\n3\n','do 后是循环体；while (...) 后的分号必不可少。循环体至少执行一次。'),
    recipe('for','for 循环','loop','已知次数时把初值、条件、更新放在一行。','for (int i = 0; i < 3; ++i) {\n    std::cout << i << \'\\n\';\n}','0\n1\n2\n','初始化只做一次；之后重复 条件 → 循环体 → 更新。0 到 2 一共三次，i < 3 与 i <= 3 不同。'),
    recipe('jump','break / continue','loop','退出整个循环，或跳过当前这一轮。','for (int i = 1; i <= 5; ++i) {\n    if (i == 2) { continue; }\n    if (i == 4) { break; }\n    std::cout << i << \'\\n\';\n}','1\n3\n','continue 跳过本轮后续语句；for 仍会执行更新。break 只退出最近的一层循环或 switch。'),
    recipe('nested','嵌套 for / 二维数组','collections','外层逐行，内层逐列。','int grid[2][2] = {{1, 2}, {3, 4}};\nfor (int row = 0; row < 2; ++row) {\n    for (int col = 0; col < 2; ++col) {\n        std::cout << grid[row][col] << \' \';\n    }\n    std::cout << \'\\n\';\n}','1 2 \n3 4 \n','每次外层迭代都会完整运行一轮内层。下标从 0 开始，换行放在内层结束之后。'),
    recipe('io','cin >> / cout <<','io','用提取和插入运算符读写数据。','int age = 0;\nif (std::cin >> age) {\n    std::cout << "Age: " << age << \'\\n\';\n}','Age: 20\n','运行时输入 20 再回车。cin >> 跳过前导空白，输入失败时不进入 if；cout 不会自动加空格或换行。'),
    recipe('getline','getline / ws / string','io','读整行文字，允许中间有空格。','std::string name;\nstd::getline(std::cin >> std::ws, name);\nstd::cout << "Hello, " << name << \'\\n\';','Hello, Ada Lovelace\n','输入 Ada Lovelace 再回车。ws 会吞掉前导空白与残留换行；需要保留空行或开头空格时不要加 ws。',['iostream','string']),
    recipe('format','fixed / setprecision / setw','io','分别控制小数位数与下一项宽度。','double price = 12.5;\nstd::cout << std::fixed << std::setprecision(2);\nstd::cout << std::setw(8) << price << \'\\n\';','   12.50\n','fixed 搭配 setprecision(2) 显示两位小数。setw(8) 只影响紧接着的一项，不会截断较长数字。',['iostream','iomanip']),
    recipe('function','函数 / 参数 / return','functions','把一个任务封装为可调用的函数。','int add(int a, int b) {\n    return a + b;\n}\n\nint main() {\n    int result = add(2, 3);\n    std::cout << result << \'\\n\';\n    return 0;\n}','5\n','add 定义在调用之前。调用时 2 和 3 复制给参数 a 和 b；return 把结果交还调用处。'),
    recipe('reference','引用 & / 指针 * / nullptr','pointers','引用是别名，指针保存地址。','int value = 3;\nint& alias = value;\nalias = 4;\nint* ptr = &value;\nif (ptr != nullptr) {\n    *ptr = 5;\n}\nstd::cout << value << \'\\n\';','5\n','int& 声明引用；&value 取地址；*ptr 解引用。三次操作针对同一对象，引用初始化后不能改绑。'),
    recipe('vector','vector / 范围 for','collections','用容器保存一组数据，再逐个访问。','std::vector<int> values = {2, 4, 6};\nvalues.push_back(8);\nfor (int value : values) {\n    std::cout << value << \' \';\n}\nstd::cout << \'\\n\';','2 4 6 8 \n','范围 for 依次取得每个元素；int value 是副本。要修改原元素时写 int& value。vector 是 C++ 标准库类型。',['iostream','vector']),
    recipe('struct','struct / 成员访问','files','把一条记录的不同字段放在一起。','struct Sensor {\n    int id;\n    double value;\n};\n\nint main() {\n    Sensor s{1, 12.5};\n    std::cout << s.id << \' \' << s.value << \'\\n\';\n    return 0;\n}','1 12.5\n','类型定义右花括号后需要分号；对象用点访问成员。C++ 的 struct 也能有成员函数，默认访问权限为 public。'),
    recipe('class','class / public / private / 构造函数','classes','用类保护对象状态，通过公开接口操作。','class Counter {\nprivate:\n    int value;\npublic:\n    explicit Counter(int start) : value(start) {}\n    void increment() { ++value; }\n    int get() const { return value; }\n};\n\nint main() {\n    Counter counter(3);\n    counter.increment();\n    std::cout << counter.get() << \'\\n\';\n    return 0;\n}','4\n','class 默认 private；public 是外部可用接口。构造函数与类同名、没有返回类型；: value(start) 是成员初始化列表。'),
    recipe('destructor','析构函数 / 生命周期 / RAII','classes','对象离开作用域时自动执行析构函数。','class Trace {\npublic:\n    Trace() { std::cout << "Begin\\n"; }\n    ~Trace() { std::cout << "End\\n"; }\n};\n\nint main() {\n    {\n        Trace object;\n        std::cout << "Work\\n";\n    }\n    return 0;\n}','Begin\nWork\nEnd\n','~类名() 是析构函数，没有返回类型和参数。内层花括号结束时 object 被销毁；RAII 用这种时机自动释放资源。'),
    recipe('virtual','继承 / virtual / override / 多态','advanced','通过基类接口调用派生类的实现。','class Device {\npublic:\n    virtual int read() const { return 0; }\n    virtual ~Device() = default;\n};\nclass Sensor : public Device {\npublic:\n    int read() const override { return 42; }\n};\n\nint main() {\n    Sensor sensor;\n    const Device& device = sensor;\n    std::cout << device.read() << \'\\n\';\n    return 0;\n}','42\n','public 继承表达类型关系。virtual 让调用按真实对象类型选择实现；override 检查是否正确覆盖，基类虚析构支持经基类指针安全销毁。'),
    recipe('exception','try / throw / catch','advanced','把异常报告交给匹配的处理分支。','try {\n    throw std::invalid_argument("Invalid input");\n} catch (const std::invalid_argument& error) {\n    std::cout << error.what() << \'\\n\';\n}','Invalid input\n','throw 后正常路径被中断，控制流进入匹配的 catch。按 const 引用捕获标准异常，避免不必要的复制。',['iostream','stdexcept']),
    recipe('template','template / typename','advanced','把类型作为函数模板的参数。','template <typename T>\nT larger(T a, T b) {\n    return a > b ? a : b;\n}\n\nint main() {\n    std::cout << larger(2, 5) << \'\\n\';\n    std::cout << larger(2.5, 1.5) << \'\\n\';\n    return 0;\n}','5\n2.5\n','编译器根据实参推导 T；这里分别生成 int 和 double 的版本。同次调用的两个参数需要匹配同一个 T。'),
    recipe('algorithm','STL / sort / 迭代器','advanced','容器保存数据，算法通过迭代器处理范围。','std::vector<int> values = {3, 1, 2};\nstd::sort(values.begin(), values.end());\nfor (int value : values) {\n    std::cout << value << \' \';\n}\nstd::cout << \'\\n\';','1 2 3 \n','sort 处理 [begin, end) 左闭右开的范围；end 指向末尾之后，不能解引用。',['iostream','vector','algorithm']),
    recipe('files','ifstream / ofstream / 文件读写','files','打开文件后先检查状态，再处理数据。','{\n    std::ofstream out("sample.txt");\n    if (!out) { return 1; }\n    out << 42 << \'\\n\';\n}\nstd::ifstream in("sample.txt");\nint value = 0;\nwhile (in >> value) {\n    std::cout << value << \'\\n\';\n}','42\n','在当前运行文件夹创建或覆盖 sample.txt。内层作用域结束时输出流关闭；while (in >> value) 只在成功读到数据时进入循环。',['iostream','fstream']),
    recipe('array','一维数组 / 下标 / sizeof','collections','固定数量的同类型元素按下标访问。','int values[3] = {10, 20, 30};\nfor (int i = 0; i < 3; ++i) {\n    std::cout << values[i] << \' \';\n}\nstd::cout << \'\\n\';','10 20 30 \n','合法下标是 0、1、2。sizeof(values) 是整个数组的字节数；数组传进函数后通常退化成指针，不能再用同一方法求长度。'),
    recipe('conditional','比较 / && / || / ! / ?:','expressions','用逻辑条件组合判断，再选择表达式结果。','int score = 75;\nbool valid = score >= 0 && score <= 100;\nstd::cout << (valid && score >= 60 ? "Pass" : "Fail") << \'\\n\';','Pass\n','== 比较，= 赋值。&& 要两边都真，|| 只需一边真；两者短路求值。条件 ? 真时的值 : 假时的值 是表达式。'),
    recipe('enum','enum class / 枚举','types','用有名字的有限取值代替随意的数字。','enum class State { Idle, Running };\nState state = State::Running;\nif (state == State::Running) {\n    std::cout << "Running\\n";\n}','Running\n','enum class 是 C++ 的有作用域枚举，取值写 State::Running。这里的 State:: 不能因为 using namespace std; 而省略。'),
    recipe('recursion','递归 / 基本情况','functions','函数调用自身，每次向终止条件靠近。','int factorial(int n) {\n    if (n <= 1) { return 1; }\n    return n * factorial(n - 1);\n}\n\nint main() {\n    std::cout << factorial(4) << \'\\n\';\n    return 0;\n}','24\n','调用逐层到 n=1，再逐层返回。这个示例只讨论小的非负整数；实际输入需检查范围，避免整数溢出。'),
    recipe('newdelete','new / delete / 动态数组','pointers','成对管理动态分配与释放。','int* values = new int[3]{};\nvalues[1] = 7;\nstd::cout << values[0] << \' \' << values[1] << \'\\n\';\ndelete[] values;\nvalues = nullptr;','0 7\n','{} 把 int 元素初始化为 0。new[] 配 delete[]，普通 new 配 delete；释放后不能再访问对象。一般容器需求优先用 vector。'),
    recipe('this','this / const 成员函数','classes','this 指向当前对象，用于区分成员与同名参数。','class Counter {\n    int value = 0;\npublic:\n    void set(int value) { this->value = value; }\n    int get() const { return value; }\n};\n\nint main() {\n    Counter counter;\n    counter.set(9);\n    std::cout << counter.get() << \'\\n\';\n    return 0;\n}','9\n','this->value 指成员，右边 value 指参数。get() 后的 const 表示不通过 this 修改普通成员，允许 const 对象调用。'),
    recipe('copy','拷贝构造 / 拷贝赋值 / = default','classes','创建副本与给已有对象赋值是不同操作。','class Counter {\n    int value;\npublic:\n    explicit Counter(int n) : value(n) {}\n    Counter(const Counter&) = default;\n    Counter& operator=(const Counter&) = default;\n    int get() const { return value; }\n};\n\nint main() {\n    Counter a(3);\n    Counter b = a;\n    Counter c(0);\n    c = b;\n    std::cout << b.get() << \' \' << c.get() << \'\\n\';\n    return 0;\n}','3 3\n','b = a 出现在 b 的初始化中，调用拷贝构造；c = b 是给已存在对象拷贝赋值。拥有裸指针资源的类不能直接照搬默认浅拷贝。'),
    recipe('overload','函数重载 / 构造函数重载','classes','同名函数由参数列表区分。','class Counter {\n    int value;\npublic:\n    Counter() : value(0) {}\n    explicit Counter(int n) : value(n) {}\n    int get() const { return value; }\n};\nint twice(int n) { return n * 2; }\ndouble twice(double n) { return n * 2; }\n\nint main() {\n    Counter a;\n    Counter b(3);\n    std::cout << a.get() << \' \' << b.get() << \'\\n\';\n    std::cout << twice(2) << \' \' << twice(2.5) << \'\\n\';\n    return 0;\n}','0 3\n4 5\n','无参构造和带 int 的构造是两个重载。普通函数也可重载；只改变返回类型不能构成重载。'),
    recipe('operator','operator / 运算符重载','classes','为自定义类型定义运算符的具体含义。','class Amount {\n    int value;\npublic:\n    explicit Amount(int n) : value(n) {}\n    Amount operator+(const Amount& other) const {\n        return Amount(value + other.value);\n    }\n    int get() const { return value; }\n};\n\nint main() {\n    Amount a(2), b(3);\n    Amount total = a + b;\n    std::cout << total.get() << \'\\n\';\n    return 0;\n}','5\n','a + b 调用 a.operator+(b)。不能改变运算符优先级，也不能凭空发明新的运算符。'),
    recipe('friend','friend / 友元函数','classes','明确允许一个非成员函数访问私有成员。','class Box {\n    int value = 7;\n    friend int read(const Box& box);\n};\nint read(const Box& box) { return box.value; }\n\nint main() {\n    Box box;\n    std::cout << read(box) << \'\\n\';\n    return 0;\n}','7\n','friend 声明授予访问权限；read 仍是普通函数，不用 box.read() 调用。友元关系不会自动继承或传递。'),
    recipe('static','static 成员 / 类名::成员','classes','静态成员属于类，所有对象共用。','class Counter {\npublic:\n    static int count;\n    Counter() { ++count; }\n};\nint Counter::count = 0;\n\nint main() {\n    Counter a, b;\n    std::cout << Counter::count << \'\\n\';\n    return 0;\n}','2\n','本例在类外定义静态数据成员。Counter:: 指所属的类，与 std:: 所指的命名空间不同，不能混用。'),
    recipe('abstract','纯虚函数 / 抽象类 / protected','advanced','用抽象基类规定派生类必须提供的接口。','class Device {\nprotected:\n    int offset = 1;\npublic:\n    virtual int read() const = 0;\n    virtual ~Device() = default;\n};\nclass Sensor : public Device {\npublic:\n    int read() const override { return 41 + offset; }\n};\n\nint main() {\n    Sensor sensor;\n    const Device& device = sensor;\n    std::cout << device.read() << \'\\n\';\n    return 0;\n}','42\n','= 0 声明纯虚函数，Device 不能直接创建对象。protected 允许派生类成员访问；外部调用者不能直接访问 offset。'),
  ];
  LessonTeaching.register(recipes);
  const alias={classes:'class public private constructor destructor 构造 析构 封装',advanced:'inheritance virtual override polymorphism exception template typename STL 继承 多态 异常 模板',functions:'function return void recursion 函数 递归',pointers:'pointer reference nullptr 指针 引用',collections:'array string vector 数组 字符串',branch:'分支 条件',loop:'循环'};
  function matches(entry,q){const text=clean([entry.title,entry.description||'',entry.document,entry.id||'',alias[entry.category]||''].join(' '));return q.trim().split(/\s+/).filter(Boolean).every(w=>text.includes(clean(w)));}
  function candidates(){if(view==='syntax')return recipes;const section=$('#section-filter').value;return [...(section?[]:recipes),...index.entries.filter(e=>!section||e.section===section)];}
  function filtered(){const category=$('#topic-filter').value,q=$('#search').value;return candidates().filter(e=>(!category||e.category===category)&&matches(e,q));}
  async function load(){const data=await api('/api/lessons');if(!active())return;index=data;selected=null;view='topics';$('#section-filter').options[0].text='全部讲义来源';$('#section-filter').setAttribute('aria-label','按讲义来源筛选');$('#search').placeholder='搜索语法或知识点，例如 class、for、getline';$('#topic-filter').innerHTML='<option value="">全部学习主题</option>'+index.categories.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('');}
  function controls(){return `<div class="lesson-toolbar"><div class="lesson-views" role="group" aria-label="课件目录视图"><button data-lesson-view="topics" aria-pressed="${view==='topics'}">按顺序学习</button><button data-lesson-view="syntax" aria-pressed="${view==='syntax'}">语法速查</button><button data-lesson-view="documents" aria-pressed="${view==='documents'}">完整讲义</button></div><label>代码写法 <select class="lesson-code-style" aria-label="课件代码写法"><option value="using" ${style==='using'?'selected':''}>课堂写法 · using namespace std;</option><option value="explicit" ${style==='explicit'?'selected':''}>显式写法 · std::</option></select></label></div>`;}
  // Follow the existing beginner course order; classroom walkthroughs and
  // EEEE2067 supplements support it. A source-only filter can be studied alone.
  function learningOrder(entries){
    const lessons=entries.filter(e=>e.item_id);
    const core=lessons.filter(e=>!e.item_id.startsWith('LESSON-02_')&&!e.item_id.startsWith('E2067-L'));
    return {core:core.length?core:lessons,extra:core.length?lessons.filter(e=>!core.includes(e)):[]};
  }
  function lessonRows(entries){return `<ol class="lesson-sequence">${entries.map((e,n)=>`<li><button class="lesson-row" data-lesson-key="${esc(e.key)}"><span class="lesson-number">${String(n+1).padStart(2,'0')}</span><span class="lesson-row-copy"><strong>${esc(e.title)}</strong><small>${esc(e.document)}</small></span><span class="lesson-row-action">阅读 <span aria-hidden="true">→</span></span></button></li>`).join('')}</ol>`;}
  function topicContent(entries){
    if(!entries.length)return '';
    const {core,extra}=learningOrder(entries),quick=entries.filter(e=>!e.item_id);
    const first=core[0];
    return `<section class="lesson-group learning-topic">${first?`<div class="lesson-start"><div><span class="lesson-kicker">从这里开始 · 第 1 / ${core.length} 节</span><h3>${esc(first.title)}</h3><p>先按下面的顺序读懂概念与示例，再看补充讲解。</p></div><button class="primary-button" data-lesson-start="${esc(first.key)}">开始学习 →</button></div><h3 class="lesson-list-title">学习顺序 <small>${core.length} 节</small></h3>${lessonRows(core)}`:''}${LessonTeaching.exerciseList(entries[0].category)}${extra.length?`<details class="lesson-resources"><summary>补充讲解 <small>${extra.length} 节 · 学完上面的内容再看</small></summary>${lessonRows(extra)}</details>`:''}${quick.length?`<details class="lesson-resources"><summary>语法速查 <small>${quick.length} 种写法 · 忘记写法时再查</small></summary><div class="lesson-reference-list">${quick.map(e=>`<button class="lesson-reference syntax-entry" data-lesson-key="${esc(e.key)}"><strong>${esc(e.title)}</strong><span>${esc(e.description)}</span><small>查看写法 →</small></button>`).join('')}</div></details>`:''}</section>`;
  }
  function bindControls(container){container.querySelectorAll('[data-lesson-view]').forEach(b=>b.onclick=()=>{view=b.dataset.lessonView;selected=null;state.catalogPage=1;filter();});container.querySelectorAll('.lesson-code-style').forEach(s=>s.onchange=()=>{style=s.value;try{localStorage.setItem('lesson-code-style',style);}catch{}document.querySelectorAll('.lesson-code-style').forEach(el=>el.value=style);applyStyle($('#reader'));});}
  function rememberSidebar(){
    const sidebar=$('#question-nav .library-sections');
    // Hidden reader-time renders have no scroll geometry; retain the last visible position.
    if(sidebar?.getClientRects().length)sidebarScrollTop=sidebar.scrollTop;
  }
  function restoreSidebar(){
    const sidebar=$('#question-nav .library-sections');
    if(sidebar?.getClientRects().length)sidebar.scrollTop=sidebarScrollTop;
  }
  function filter(){
    const entries=filtered(),ids=new Set(entries.map(e=>e.item_id).filter(Boolean));
    state.items=state.all.filter(i=>ids.has(i.id));state.lessonEntries=entries;state.catalogPage=1;
    $('#section-filter').disabled=view==='syntax';
    $('#result-count').textContent=view==='documents'?`${state.items.length} 份课件`:view==='syntax'?`${entries.length} 种写法`:`${entries.filter(e=>e.item_id).length} 节讲义`;
    render();showLibrary();restoreSidebar();$('#empty').hidden=entries.length!==0;
  }
  function render(){
    const nav=$('#question-nav'),entries=state.lessonEntries||filtered(),cat=$('#topic-filter').value;
    rememberSidebar();
    const focusedCategory=nav.querySelector('.library-sections')?.contains(document.activeElement)?document.activeElement.dataset.lessonCategory:undefined;
    nav.classList.add('lesson-catalog');
    const counts=key=>candidates().filter(e=>!key||e.category===key).length;
    const sidebar=`<aside class="library-sections"><div class="library-caption">学习目录</div><button data-lesson-category="" class="${cat?'':'active'}"><span>全部主题</span><small>${index.categories.length}</small></button>${index.categories.map((c,n)=>`<button data-lesson-category="${c.id}" class="lesson-category ${cat===c.id?'active':''}"><span class="lesson-category-heading"><span><small>${String(n+1).padStart(2,'0')}</small> ${esc(c.title)}</span><small>${view==='topics'?learningOrder(candidates().filter(e=>e.category===c.id)).core.length+' 节':counts(c.id)}</small></span><span class="lesson-category-summary">${esc(c.description)}</span></button>`).join('')}<p class="library-help">第一次学，从第 01 个主题开始。<br>进入主题后，按小节顺序往下读。</p></aside>`;
    const card=e=>`<button class="lesson-entry ${e.item_id?'':'syntax-entry'}" data-lesson-key="${esc(e.key)}"><strong>${esc(e.title)}</strong><span>${esc(e.description||e.document)}</span><small>${e.item_id?'讲义小节':'固定写法 · 完整示例'} ↗</small></button>`;
    let content;
    if(view==='syntax'){
      content=index.categories.map(c=>{const list=entries.filter(e=>e.category===c.id);return list.length?`<section class="lesson-group syntax-group"><h3>${esc(c.title)} <small>${list.length} 种写法</small></h3><p>${esc(c.description)}</p><div class="lesson-entry-grid">${list.map(card).join('')}</div></section>`:'';}).join('');
    }else if(view==='topics'){
      const overview=!cat&&!$('#search').value.trim();
      if(overview){
        const first=index.categories.map(c=>learningOrder(entries.filter(e=>e.category===c.id)).core[0]).find(Boolean);
        content=`${first?`<div class="lesson-start"><div><span class="lesson-kicker">第一次学习</span><h3>从「${esc(index.categories.find(c=>c.id===first.category).title)}」开始</h3><p>按目录顺序学习；每个主题都有明确的小节顺序。</p></div><button class="primary-button" data-lesson-start="${esc(first.key)}">开始第 1 节 →</button></div>`:''}<section class="lesson-group"><h3>学习目录</h3><div class="lesson-chapters">${index.categories.map((c,n)=>{const total=learningOrder(entries.filter(e=>e.category===c.id)).core.length;return total?`<button class="category-entry lesson-chapter" data-lesson-category="${c.id}"><span class="lesson-number">${String(n+1).padStart(2,'0')}</span><span class="lesson-row-copy"><strong>${esc(c.title)}</strong><span>${esc(c.description)}</span></span><small>${total} 节</small><span class="lesson-row-action">进入学习 →</span></button>`:'';}).join('')}</div></section>`;
      }else if($('#search').value.trim()){
        content=`<section class="lesson-group"><h3>搜索结果 <small>${entries.length} 项</small></h3><p>讲义小节用于学习；语法示例用于查写法。</p>${lessonRows(entries.filter(e=>e.item_id))}<div class="lesson-entry-grid">${entries.filter(e=>!e.item_id).map(card).join('')}</div></section>`;
      }else{
        content=topicContent(entries);
      }
    }else{
      content=`<div class="exercise-grid">${state.items.map(i=>`<button class="library-card" data-lesson-document="${esc(i.id)}"><div class="card-meta">${esc(i.label||i.id)}</div><h3>${esc(i.title)}</h3><div class="card-topic">${index.entries.filter(e=>e.item_id===i.id).length} 个知识点入口</div><div class="card-source">${esc(i.section)}</div></button>`).join('')}</div>`;
    }
    const topic=index.categories.find(c=>c.id===cat);
    nav.innerHTML=sidebar+`<div class="library-content">${controls()}<div class="library-intro"><div><h2>${view==='topics'?esc(topic?.title||'C++ 学习路线'):view==='syntax'?'常用语法速查':'整份讲义'}</h2><p>${view==='topics'&&topic?esc(topic.description):'基础语法 → 数据与函数 → 类与对象 → C++ 进阶'}</p></div></div>${content||'<p class="lesson-no-results">没有匹配内容。可清除搜索或切换到其他主题。</p>'}</div>`;
    restoreSidebar();
    if(focusedCategory!==undefined&&!nav.hidden)[...nav.querySelectorAll('.library-sections [data-lesson-category]')].find(b=>b.dataset.lessonCategory===focusedCategory)?.focus({preventScroll:true});
    bindControls(nav);
    nav.querySelectorAll('[data-lesson-category]').forEach(b=>b.onclick=()=>{$('#topic-filter').value=b.dataset.lessonCategory;state.catalogScrollTop=0;filter();});
    nav.querySelectorAll('[data-lesson-key]').forEach(b=>b.onclick=()=>open(b.dataset.lessonKey));
    nav.querySelectorAll('[data-lesson-start]').forEach(b=>b.onclick=()=>{const key=b.dataset.lessonStart,entry=index.entries.find(e=>e.key===key);$('#topic-filter').value=entry.category;filter();open(key);});
    nav.querySelectorAll('[data-lesson-document]').forEach(b=>b.onclick=()=>{rememberSidebar();selected=null;state.catalogOriginKey='doc:'+b.dataset.lessonDocument;openItem(b.dataset.lessonDocument);});
  }
  function slice(text,heading){if(heading===null||heading===undefined)return text;const tokens=marked.lexer(text);let n=-1,from=-1,to=text.length,offset=0;for(const t of tokens){if(t.type==='heading'&&t.depth===2){n++;if(n===heading)from=offset;else if(n===heading+1){to=offset;break;}}offset+=t.raw.length;}return from<0?text:text.slice(from,to);}
  function content(item){return active()&&selected?.item_id===item.id?slice(item.payload.question_md,selected.heading):item.payload.question_md;}
  function applyStyle(container){if(!active()||!container)return;container.querySelectorAll('pre code.language-cpp').forEach(code=>{if(code.dataset.original===undefined)code.dataset.original=code.textContent;code.textContent=variant(code.dataset.original,style);Prism.highlightElement(code);});}
  function readerTools(container){
    if(!active())return;
    if(state.current&&selected?.item_id!==state.current.id)selected=null;
    const panel=document.createElement('div');panel.className='lesson-reader-tools';
    panel.innerHTML=`${controls()}<p>“课堂写法”在使用标准库时声明 <code>using namespace std;</code>，代码中可写 <code>cout</code>、<code>string</code>；“显式写法”写 <code>std::cout</code>、<code>std::string</code>。两者都需要头文件。if、for、class 等语言关键字不加 std::。</p>${selected?.item_id?`<button class="text-button" id="lesson-full">阅读所属完整讲义：${esc(selected.document)} ↗</button>`:''}`;
    container.querySelector('h2')?.after(panel);bindControls(panel);
    panel.querySelectorAll('[data-lesson-view]').forEach(b=>b.onclick=()=>{view=b.dataset.lessonView;selected=null;filter();});
    $('#lesson-full')?.addEventListener('click',()=>{const id=selected.item_id;selected=null;openItem(id,false);});
    if(!selected&&state.current){
      const list=index.entries.filter(e=>e.item_id===state.current.id&&e.heading!==null);
      if(list.length){const toc=document.createElement('details');toc.className='lesson-toc';toc.innerHTML=`<summary>本讲知识点 · ${list.length} 个小节</summary><div>${list.map(e=>`<button data-lesson-key="${esc(e.key)}">${esc(e.title)}</button>`).join('')}</div>`;panel.after(toc);toc.querySelectorAll('button').forEach(b=>b.onclick=()=>open(b.dataset.lessonKey));}
    }
    if(selected?.item_id)container.querySelector('h2').textContent=selected.title;
    if(selected?.item_id)enhance(container.querySelector('.question-prompt'));
    LessonTeaching.explainHeaders(container);
    applyStyle(container);
    $('#reading-back').textContent='← 返回课件目录';$('#catalog-button').textContent='课件目录 ↗';$('#previous').textContent='← 上一份讲义';$('#next').textContent='下一份讲义 →';
    if(selected?.item_id&&view==='topics'){
      const {core,extra}=learningOrder(candidates().filter(e=>e.category===selected.category));
      const primary=core.some(e=>e.key===selected.key),list=primary?core:extra,n=list.findIndex(e=>e.key===selected.key);
      if(n>=0){
        // Section-specific material stays visible; shared exercises occur only after the last core section.
        if(primary&&n===list.length-1)container.insertAdjacentHTML('beforeend',LessonTeaching.exerciseList(selected.category));
        const steps=document.createElement('nav');steps.className='lesson-reading-steps';steps.setAttribute('aria-label','小节学习顺序');
        steps.innerHTML=`<p>${esc(index.categories.find(c=>c.id===selected.category)?.title)} · ${primary?'基础学习':'补充讲解'} · 第 ${n+1} / ${list.length} 节</p><div><button class="secondary-button" data-lesson-step="${n>0?esc(list[n-1].key):''}" ${n===0?'disabled':''}>← 上一节</button>${n+1<list.length?`<button class="primary-button" data-lesson-step="${esc(list[n+1].key)}">下一节：${esc(list[n+1].title)} →</button>`:'<button class="primary-button" data-lesson-return>返回本主题 →</button>'}</div>`;
        container.append(steps);steps.querySelectorAll('[data-lesson-step]').forEach(b=>b.onclick=()=>open(b.dataset.lessonStep));
        steps.querySelector('[data-lesson-return]')?.addEventListener('click',showCatalog);
        $('#reading-footer').hidden=true;
      }
    }
  }
  async function open(key){
    const entry=[...recipes,...index.entries].find(e=>e.key===key);if(!entry)return;
    rememberSidebar();
    selected=entry;state.catalogOriginKey=key;
    if(entry.item_id){await openItem(entry.item_id);return;}
    state.catalogScrollTop=$('main').scrollTop;state.seq++;state.current=null;showReader();
    $('#reader').innerHTML=`<div class="question-meta"><span>常用语法速查 · ${esc(index.categories.find(c=>c.id===entry.category)?.title)}</span><span class="chip">完整单文件示例</span></div><h2>${esc(entry.title)}</h2>${LessonTeaching.html(LessonTeaching.guides[entry.id])}<details><summary>进阶说明与易错点</summary><p>${esc(entry.notes)}</p></details>`;
    enhance($('#reader'));readerTools($('#reader'));$('#reader').setAttribute('aria-busy','false');$('#reading-footer').hidden=true;$('#reader').scrollIntoView({block:'start'});
  }
  function reset(){selected=null;sidebarScrollTop=0;$('#section-filter').disabled=false;$('#section-filter').setAttribute('aria-label','按周次或章节筛选');$('#search').placeholder='搜索题目、知识点或题号';$('#question-nav').classList.remove('lesson-catalog');$('#reading-back').textContent='← 返回上一级 · 题目目录';$('#catalog-button').textContent='题目目录 ↗';$('#previous').textContent='← 上一题';$('#next').textContent='下一题 →';}
  function restoreFocus(){restoreSidebar();const key=state.catalogOriginKey;const el=[...document.querySelectorAll('[data-lesson-key],[data-lesson-document]')].find(b=>b.dataset.lessonKey===key||'doc:'+b.dataset.lessonDocument===key);const details=el?.closest('details');if(details)details.open=true;el?.focus({preventScroll:true});}
  return {active,load,filter,render,content,readerTools,reset,restoreFocus,variant,recipes,slice,open,clearSelection:()=>selected=null};
})();
