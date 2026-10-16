'use strict';
// Reviewed presentation boundaries. Original question payloads remain unchanged.
window.QuestionContent=(()=>{
  const tails={
    'C-S1-04':'\nA ', 'C-S1-19':'\nThis is a C ',
    'C-S1-32':'\nNumber ', 'C-S2-08':'\nInput three different integers:',
    'C-S2-12':'\nnumber ', 'C-S3-16':'\nNote: The red-color',
    'C-S3-17':'\nNote: The red-color', 'C-S3-18':'\nNote: The red-color',
    'C-S3-29':'\nCount of each grade:', 'C-S4-08':'\nNote: The red-color',
    'C-S4-12':'\nNote: The red-color', 'C-S4-22':'\nnumber=',
    'C-S4-23':'\nEnter the first point:', 'C-S5-11':'\nNote: The red-color',
    'C-S5-12':'\nNote: Overall there should be'
  };
  // These images show worked numeric output, rather than the shape to implement.
  const exampleImages=new Set(['C-S1-32','C-S3-19','C-S3-20','C-S5-02','C-S5-04','C-S5-11']);
  const inline={
    'C-S1-36':['i.e. x = 3.333333.','请先自行预测结果。'],
    'C-S7-04':['The current time is Tue Sep 12 00:10:49 2017','The time difference is 558490249 seconds'],
    'E2067-Q02':['输入 0.25 12，输出 3.00。','用 0.25 12 测试并自行预测结果。'],
    'E2067-Q07':['输入2 4 6 -1得到4；','用2 4 6 -1测试；'],
    'E2067-Q09':['输入1.5，输出2.25。','用1.5测试并自行预测结果。'],
    'E2067-Q11':['连续调用三次得到1 2 3。','连续调用三次并预测结果。'],
    'E2067-Q12':['输出2.5 10。','预测并输出两个调用的结果。'],
    'E2067-Q14':['main中数组{2,4,6}输出12。','main中对数组{2,4,6}求和并输出。'],
    'E2067-Q21':['并输出Voltage=3.3。','并按name=value格式输出。'],
    'E2067-Q22':['再读取求和得到12。','再读取求和并输出。'],
    'E2067-Q23':['调用两次increment后输出2。','调用两次increment后输出当前计数。'],
    'E2067-Q24':['分别构造-3和5并输出0 5。','分别构造-3和5并输出各自的get()结果。'],
    'E2067-Q25':['{1,2}+{3,4}输出4 6。','计算{1,2}+{3,4}并输出结果。'],
    'E2067-Q27':['通过Base引用绑定Derived再调用，应输出2。','通过Base引用绑定Derived再调用，预测并验证输出。'],
    'E2067-Q28':['10 2测试正常结果5。','10 2测试正常路径并预测结果。'],
    'E2067-Q29':['输出7 1.5。','预测并输出两个调用的结果。'],
    'E2067-Q30':['遍历输出1 2 4 4。','遍历输出排序结果。'],
    'CPP-S02':['main 创建 Sensor，用 Device& 调用并输出 7。','main 创建 Sensor，用 Device& 调用并预测输出。'],
    'CPP-S05':['输出两行 5、2.5。','分两行输出两个调用的结果。']
  };
  const ranges={
    'C-S3-17':['For example, a \nsalesperson','or a total of $650.'],
    'C-S3-26':['For example, if the entered integer is 17735','7s in this number.'],
    'C-S4-17':['For example, given the number 7631','the function should return 1367.'],
    'C-S6-A':['For example, the counting for letter A, E, H','display A E H as the favorite letters.'],
    'C-S7-08':[', for example, the \nattendee’s attendance', 'the attendance ratio is 80%.']
  };
  // PDF text order placed a printed footer before the numbered question.
  // This imported seminar series has one unnumbered cover page.
  // Only remove a leading footer when both source page and question number agree.
  function cleanPrompt(item){
    const text=String(item.payload.question_md||'');
    if(!/^C-S\d+-(?:\d+|[A-Z])$/.test(item.id)||item.payload.question_format!=='plain')return text;
    const source=(item.payload.references||[]).find(r=>r.role==='question'&&r.page>1);
    const match=/^\s*(\d{1,3})[ \t]*\r?\n(?=\s*(\d+|[A-Z])\.\s)/.exec(text),number=item.id.split('-').at(-1);
    const sameNumber=match&&(/^[A-Z]$/.test(number)?match[2]===number:Number(match[2])===Number(number));
    return source&&match&&Number(match[1])===source.page-1&&sameNumber?text.slice(match[0].length):text;
  }
  function split(item){
    const p=item.payload;
    const result={prompt:cleanPrompt(item),examples:[],images:p.question_images||[],exampleImages:[],reviewed:false};
    if(item.subject!=='cpp'||item.kind!=='question')return result;
    const marker=tails[item.id];
    if(marker){const n=result.prompt.indexOf(marker);if(n!==-1){result.examples.push(result.prompt.slice(n));result.prompt=result.prompt.slice(0,n);result.reviewed=true;}}
    // Companion self-check paragraphs are separate from the actual task and chapter requirements.
    if(item.id.startsWith('CPP-')){
      const match=/自测(?:文件)?：[^\n]*(?:\n(?!\n)[^\n]*)*/.exec(result.prompt);
      if(match){result.examples.push(match[0]);result.prompt=result.prompt.replace(match[0],'自测输入与预期结果见下方折叠区。');result.reviewed=true;}
    }
    const rule=inline[item.id];
    if(rule){
      if(item.id==='C-S7-04'){
        const start=result.prompt.indexOf(rule[0]),end=result.prompt.indexOf(rule[1]);
        if(start!==-1&&end>=start){const stop=end+rule[1].length;result.examples.push(result.prompt.slice(start,stop));result.prompt=result.prompt.slice(0,start)+'（示例见下方折叠区。）'+result.prompt.slice(stop);result.reviewed=true;}
      }else if(result.prompt.includes(rule[0])){result.examples.push(rule[0]);result.prompt=result.prompt.replace(rule[0],rule[1]);result.reviewed=true;}
    }
    const range=ranges[item.id];
    if(range){const start=result.prompt.indexOf(range[0]),end=result.prompt.indexOf(range[1],start);
      if(start!==-1&&end>=start){const stop=end+range[1].length;result.examples.push(result.prompt.slice(start,stop));result.prompt=result.prompt.slice(0,start)+'（数值示例见下方折叠区。）'+result.prompt.slice(stop);result.reviewed=true;}}
    if(exampleImages.has(item.id)&&result.images.length){result.exampleImages=result.images;result.images=[];result.reviewed=true;}
    return result;
  }
  return {split,cleanPrompt,tails,inline,ranges,exampleImages};
})();
