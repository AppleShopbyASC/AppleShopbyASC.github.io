/* 電子書閱讀器（電腦寬度）：一次只看一頁，按「下一頁」翻頁，不用捲動。
   版面像一本書：深一點的底色上放一張白色書頁，頁首寫章名、頁尾寫頁碼，底部是翻頁列。
   - 每章依螢幕高度自動分頁。分頁是「實際排版後量」的：一個區塊一個區塊加進書頁，
     加進去後量實際底部，超出書頁就換頁，所以不會有文字被蓋住或切掉。
   - 標題（h3）和緊接的說明、第一個內容會留在同一頁；步驟清單可以在步驟之間換頁，編號接續。
   - 「用生活來想」放在圖或步驟之前：先有一個熟悉的比方，再看細節，新手比較容易進入狀況。
   - 翻到章末，右下角按鈕變成「下一章：章名」，按了才換章。鍵盤：→、PageDown 下一頁；←、PageUp 上一頁。
   - 第 1 冊會記住讀到哪一章哪一頁（localStorage），下次打開接著讀；首頁「從第一章開始看」固定從頭。
   - 視窗寬度 < 1100px 或高度 < 560px 時停用，維持「一章一頁、可往下捲」。
   - 依賴 inner.js 的 chs、PG、ENT、route()、BK、NX、onScroll、lb、panel。 */
(()=>{
BK.v='shrink22';
const dock=document.querySelector('.dock'),dnow=dock.querySelector('.now'),dnext=dock.querySelector('.nx'),dup=dock.querySelector('.up'),ibar=document.querySelector('.ibar');
const R=document.documentElement;
dnow.setAttribute('aria-live','polite'); /* 翻頁時讓螢幕閱讀器念出目前在第幾頁 */
let ITEMS=[],pageOf=new Map(),keep=null,wantLast=false,restore=null,dir='n';
/* 文字大小倍率（BK.tz，見 inner.js）：套在每個內容區塊的 zoom 上。
   章首頁（色塊、重點框）本來就是大字，不再放大，免得撐出書頁。 */
const tzOf=it=>{const v=BK.tz||1,c=it.b.classList;
 if(it.isTr||v===1||c.contains('spread')||c.contains('key')||c.contains('open-row')||(it.b.matches('.metaphor')&&it.b.parentElement&&it.b.parentElement.matches('section.ch')))return '';
 return String(v)};
const POS='mac-pos-'+(location.pathname.split('/').pop()||'index').replace('.html','');

/* 書頁下緣內距（要和 CSS 的 section.ch.cur padding-bottom 一致） */
const PAD_B=56,PAD_T=44;
/* 一個小節只比一頁多一點點時，整頁字縮到最小 84% 也要放進同一頁，不要把同一個說明拆開 */
const ZMIN=.82;

/* 章名有逗號時，逗號前後各自成一段不拆開：換行只會發生在逗號後面，
   例如「看懂 Finder，/ 檔案就不會亂」，而不是「看懂 Finder，檔案 / 就不會亂」。整句放得下時維持一行。 */
document.querySelectorAll('.ch h2').forEach(h=>{
 if(h.children.length)return;
 const t=h.textContent,i=t.indexOf('，');
 if(i<1||i>=t.length-1)return;
 h.textContent='';
 [t.slice(0,i+1),t.slice(i+1)].forEach(x=>{const sp=document.createElement('span');sp.style.display='inline-block';sp.textContent=x;h.append(sp)});
});

/* 「這一章的重點」整句拆成子句（逗號、冒號、分號、句號後），每個子句不在中間斷行；
   重點句（<strong> 標記）整段當一個子句，標記底色就不會在行尾斷成一截有一截沒有。
   再配合 CSS 的 text-wrap:balance，行長度接近，句子讀起來是一段一段，不是在詞中間硬切。 */
document.querySelectorAll('.key .kq').forEach(q=>{
 if(q.querySelector('*:not(strong)'))return;
 const nodes=[...q.childNodes],out=[];
 nodes.forEach(n=>{
  if(n.nodeType===3){
   n.nodeValue.split(/(?<=[，：；。])/).filter(Boolean).forEach(x=>{const sp=document.createElement('span');sp.className='cl';sp.textContent=x;out.push(sp)});
  }else{n.classList.add('cl');out.push(n)}
 });
 if(out.length<2)return;
 q.textContent='';out.forEach(x=>q.append(x));
});

/* 照語意斷行：短的說明文字（140 字以內）依子句拆開，每個子句包成一個 inline-block 整塊。
   整塊放得下這一行就不拆；放不下就整塊移到下一行；比一整行還長才在整塊內部換行（max-width:100%，不會溢出）。
   這樣每一行都結束在子句的結尾，不會出現「常 / 穿鞋子」「打字 / 搜尋」這種把詞組拆在兩行的斷法。
   引號、括號裡的標點不算子句結尾（「拿那雙黑色的來」不會被切開）。重點句（.kq）已有自己的處理，不重複。 */
(()=>{
 const END=/[，：；。！？]/,OPENQ=/[「『（]/,CLOSEQ=/[」』）]/;
 document.querySelectorAll('p, .d, figcaption').forEach(el=>{
  if(el.closest('.key,.pg-head,.pg-folio,nav,svg,table,summary')||el.matches('.kq,.punch,.lab,.tag,.src'))return;
  if(el.querySelector('br,svg,img,table,ol,ul,p,div,.cls'))return;
  const txt=el.textContent.trim();
  if(txt.length<10||txt.length>140)return;
  const kids=[...el.childNodes],out=[];
  let cur=document.createElement('span'),depth=0;cur.className='cls';
  const close=()=>{if(cur.childNodes.length){out.push(cur);cur=document.createElement('span');cur.className='cls'}};
  kids.forEach(n=>{
   if(n.nodeType!==3){cur.append(n);return}
   let buf='';
   for(const c of n.nodeValue){
    buf+=c;
    if(OPENQ.test(c))depth++;
    else if(CLOSEQ.test(c))depth=Math.max(0,depth-1);
    if(END.test(c)&&depth===0){cur.append(buf);buf='';close()}
   }
   if(buf)cur.append(buf);
  });
  close();
  if(out.length<2){el.replaceChildren(...kids);return}
  el.replaceChildren(...out);
 });
})();

/* 中文斷行：瀏覽器預設可以在任何兩個字中間換行（「下 / 載」「那一 / 組」），讀起來很卡。
   用 Intl.Segmenter 把文字切成詞，在詞與詞之間放 <wbr>，再配合 CSS word-break:keep-all，
   換行就只會發生在詞的邊界和標點之後。標點前不放斷點，避免標點出現在行首。 */
(()=>{
 if(typeof Intl==='undefined'||!Intl.Segmenter)return;
 const seg=new Intl.Segmenter('zh-Hant',{granularity:'word'});
 const cjk=/[\u3400-\u9fff]/;
 const KIN=/([「『][^「『」』]{1,14}[」』][。，、：；？！」』）]*|[^\s。，、：；？！」』）「『（][。，、：；？！」』）]+|[「『（]+[^\s])/g;   /* 第一種：14 字以內的整段引號，當成一個不拆的單位 */
 const LEAD=/^[。，、：；？！」』）]+/;   /* 文字節點一開頭就是收尾標點：前面一定是行內元素（按鍵、粗體標記…） */
 const SQ_A=/[」』）]/,SQ_B=/[。，、：；」』）]/;
 const OPEN_A=/[「『（]/;   /* 連續標點：前一個收尾括號擠掉半格空白（標點擠壓） */
 const root=document.querySelector('main')||document.body;
 const skip=n=>n.parentElement&&n.parentElement.closest('svg,script,style,kbd,code,textarea,input,.pg-head,.pg-folio');
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 /* 行首標點：標點前面緊接行內元素時，文字節點的標點會被瀏覽器當成可以換行的位置。
  - 前面的元素很短（按鍵標籤）：連元素帶標點一起包進不斷行群組
  - 前面的元素很長（整句粗體標記）：標點併進元素最後一個文字節點，讓後面的處理照常綁字 */
 {const w0=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),list=[];
  while(w0.nextNode())list.push(w0.currentNode);
  list.forEach(n=>{
   const m=LEAD.exec(n.nodeValue),pv=n.previousSibling;
   if(!m||!pv||pv.nodeType!==1||pv.matches('br,wbr,svg,img,script,style'))return;
   if(pv.matches('.path, .tag, .lbl, .btn, .kbd, kbd, .path-step, .path-pill, .tag-hint')||pv.closest('.path, .tag, .lbl, .btn, .kbd, kbd, .path-step, .path-pill, .tag-hint')){
    const sp=document.createElement('span');sp.style.whiteSpace='nowrap';pv.before(sp);sp.append(pv,m[0]);
    n.nodeValue=n.nodeValue.slice(m[0].length);
    return;
   }
   if(pv.textContent.length<=8){const sp=document.createElement('span');sp.style.whiteSpace='nowrap';pv.before(sp);sp.append(pv,m[0])}
   else{let t=pv;while(t.lastChild)t=t.lastChild;if(t.nodeType!==3)return;t.nodeValue+=m[0]}
   n.nodeValue=n.nodeValue.slice(m[0].length);
  });}
 const nodes=[];
 while(w.nextNode()){const n=w.currentNode;if(cjk.test(n.nodeValue)&&!skip(n))nodes.push(n)}
 nodes.forEach(n=>{
  /* 標點禁則：句號、逗號等不放行首，左引號不放行尾。Safari 在窄欄加 overflow-wrap:anywhere 時會無視禁則，
     所以把「字＋後面的標點」「左引號＋後面的字」包進 white-space:nowrap 的 <span>，不插任何字元（搜尋、複製不受影響） */
  const pieces=n.nodeValue.split(KIN);
  if(pieces.length>1||cjk.test(n.nodeValue)){
   const frag=document.createDocumentFragment();
   pieces.forEach((pc,i)=>{
    if(!pc)return;
    if(i%2){
     const isQuote=OPEN_A.test(pc[0])&&pc.length>3&&/[」』]/.test(pc);
     const sp=document.createElement('span');
     if(isQuote)sp.className='qt';else sp.style.whiteSpace='nowrap';   /* 整段引號：inline-block，放得下就不拆，放不下整塊移到下一行，比一行還長才在內部換行 */
     let buf='';
     const nextStart=(pieces[i+1]||'')[0]||'';
     [...pc].forEach((c,k,a)=>{
      if(SQ_A.test(c)&&((a[k+1]&&SQ_B.test(a[k+1]))||(k===a.length-1&&OPEN_A.test(nextStart)))){if(buf){sp.append(buf);buf=''}const q=document.createElement('span');q.className='sq';q.textContent=c;sp.append(q)}
      else buf+=c;
     });
     if(buf)sp.append(buf);
     /* 兩個 nowrap 標籤相鄰時，瀏覽器會把中間的換行機會一起吃掉（「子，」＋「「A」變成一長串整塊掉行）。
        所以明確補上換行位置：收尾標點之後本來就能斷行；左引號之前本來就能斷行 */
     const opening=OPEN_A.test(pc[0]);
     if(opening&&frag.childNodes.length)frag.append(document.createElement('wbr'));
     frag.append(sp);
     if(!opening||isQuote)frag.append(document.createElement('wbr'));
     return}
    const parts=[...seg.segment(pc)];
    parts.forEach((p,k)=>{
     frag.append(p.segment);
     const nx=parts[k+1];
     if(nx&&p.isWordLike&&nx.isWordLike)frag.append(document.createElement('wbr'));
    });
   });
   n.replaceWith(frag);
  }
 });
})();

/* flex／grid 容器（步驟卡標題 .t、FAQ 問題 summary、標籤…）會把裡面每一段文字、每個不斷行標籤、每個換行位置
   都當成獨立欄位各自排版（英文字母被垂直拆開、文字散成好幾欄）。
   所以把容器裡「連續的文字、不斷行標籤、換行位置」包成一個單元，flex 就只當成一個欄位；圖示等其他元素維持原樣 */
(()=>{
 const sel='.t,.nm,.eb,.tag,.lab,.ds,.tx,summary,label,.qa,.kick,.path,.done';
 const isRun=n=>n.nodeType===3||(n.nodeType===1&&(n.tagName==='WBR'||(n.tagName==='SPAN'&&(n.classList.contains('sq')||n.classList.contains('cls')||n.classList.contains('qt')||n.style.whiteSpace==='nowrap'))));
 document.querySelectorAll(sel).forEach(el=>{
  let run=[];
  const flush=()=>{if(run.length>1){const sp=document.createElement('span');sp.className='run';run[0].before(sp);sp.append(...run)}run=[]};
  [...el.childNodes].forEach(n=>{if(isRun(n))run.push(n);else flush()});
  flush();
 });
})();

/* 「用生活來想」要排在最前面，先給一個熟悉的比方，再看圖和步驟：
   1. 章首（還沒出現 h3 小節以前）的比方，搬到「這一章的重點」正後面；
   2. 其他段的比方，搬到該段標題與說明之後、圖或步驟之前；
   3. 左文右側欄的版型（.row.side），側欄的黃色提示搬到文字前面。 */
chs.forEach(ch=>{
 const key=ch.querySelector(':scope>.key');if(!key)return;
 for(const sec of ch.querySelectorAll(':scope>.sec')){
  if(sec.querySelector(':scope>h3'))break;
  const m=sec.querySelector(':scope>.metaphor');
  if(m){key.after(m);if(!sec.children.length)sec.remove();break}
 }
});
document.querySelectorAll('.sec').forEach(sec=>{
 const m=sec.querySelector(':scope>.metaphor');if(!m)return;
 const lead=c=>c.tagName==='H3'||c.matches('p.note')||c.matches('p.punch');
 let at=null;
 for(const c of sec.children){if(c===m)break;if(!lead(c)){at=c;break}}
 if(at)sec.insertBefore(m,at);
});
/* 章首的「重點」和「用生活來想」並排成一列，章首頁才放得下，也比上下疊兩個大框好看 */
chs.forEach(ch=>{
 const key=ch.querySelector(':scope>.key'),m=key&&key.nextElementSibling;
 if(m&&m.classList.contains('metaphor')){const w=document.createElement('div');w.className='open-row';key.before(w);w.append(key,m)}
});
/* 紅色「注意」提示往上排：放在標題與第一段說明之後、設定路徑、步驟、圖之前，新手先看到要小心什麼 */
document.querySelectorAll('.sec,.row').forEach(box=>{
 const w=[...box.children].find(c=>c.classList.contains('warn'));if(!w)return;
 const kids=[...box.children].filter(c=>c!==w);
 const lead=c=>c.tagName==='H3'||c.matches('p.note')||c.matches('p.punch');
 let i=0;while(i<kids.length&&lead(kids[i]))i++;
 if(i<kids.length&&kids[i].tagName==='P')i++;   /* 第一段說明留在最上面 */
 const at=kids[i]||null;
 if(at!==w.nextElementSibling)box.insertBefore(w,at);
});
/* 黃色提示（.metaphor）放在小節標題正下方、說明文字之前：新手先看到重點，再讀細節 */
document.querySelectorAll('.row:not(.side)').forEach(row=>{
 const m=[...row.children].find(c=>c.classList.contains('metaphor')),d=row.firstElementChild;
 if(!m||!d||d===m||d.className)return;
 const h=d.querySelector(':scope>h3');
 if(h)h.after(m);else d.prepend(m);
});
document.querySelectorAll('.row.side').forEach(row=>{
 const side=[...row.children].find(c=>c.matches('.metaphor,.warn'));
 if(side&&side!==row.firstElementChild)row.insertBefore(side,row.firstElementChild);
});
/* 小節標題上的「第 N 段」用 CSS 計數器；翻頁時沒顯示的標題不會計數，所以把每個標題的號碼固定下來 */
/* 步驟只有 2 到 4 個時，並排成卡片（2 個、3 個一列；4 個兩列兩欄），整個小節縮短，才放得進同一頁 */
document.querySelectorAll('ol.steps').forEach(ol=>{
 const n=[...ol.children].filter(x=>x.tagName==='LI').length;
 ol.dataset.n=n;
 if(n===2||n===4)ol.classList.add('g2');
 else if(n===3)ol.classList.add('g3');
});
chs.forEach(ch=>{ch.querySelectorAll('h3[id]').forEach((h,i)=>{h.style.counterSet='h '+(i+1)})});

let CONTS=[];
/* 整塊卡片（.cards）比書頁還高、又縮不下去時，才攤開成一張一張卡片，放進 SPLIT；平常維持一個整體 */
let SPLIT=new Set();
function buildItems(ch){
 const out=[];CONTS=[];
 const add=b=>{
  if(b.matches('ol.steps')){
   [...b.children].filter(x=>x.tagName==='LI').forEach((li,i)=>out.push({b:li,ol:b,idx:i,f:false,keep:false}));
   return;
  }
  /* 表格（.tbl）：多列對照表攤開成一列一列，避免一整張長表比書頁高而超出被截斷；分頁時欄名 thead 自動保留在每頁頂端 */
  if(b.matches('.tbl')){
   const trs=[...b.querySelectorAll('tbody tr')];
   if(trs.length>2){
    trs.forEach((tr,i)=>out.push({b:tr,tbl:b,idx:i,f:false,keep:false,isTr:true}));
    return;
   }
  }
  /* 容器（.sec、.row、.row 裡沒有 class 的 div；render 加減 pg-off 之後會留下空的 class=""，所以兩種都要認，否則第二次排版起整個容器變成一塊超高的區塊）攤開成一個一個區塊，才分得細、不會整包太高；
     黃色提示（.metaphor）、注意（.warn）、卡片這類有 class 的 div 是一個整體，不能拆 */
  /* 常見問題（.faq）也攤開成一題一題：整包放不下一頁時，可以在題與題之間換頁，不會被切掉 */
  if((b.matches('.sec, .row, .row>div:is(:not([class]),[class=""]), .faq')||SPLIT.has(b))&&b.children.length){CONTS.push(b);[...b.children].forEach(add);return}
  out.push({b,f:false,keep:b.tagName==='H3'||(b.matches('p.note')&&!!b.previousElementSibling&&b.previousElementSibling.tagName==='H3')});
 };
 for(const c of ch.children){
  if(c.hasAttribute('data-chrome'))continue;
  if(c.matches('nav.chend'))continue; /* 翻頁模式：換章只用底部的「下一章」，避免同一件事出現兩顆按鈕 */
  if(c.matches('nav.outline'))continue; /* 目次在翻頁模式不顯示：每頁頁首已寫章名，「章節」按鈕可跳章 */
  add(c);
 }
 return out;
}
function resetMedia(){ITEMS.forEach(it=>{if(it.tb){it.tb.forEach(c=>{c.style.paddingTop='';c.style.paddingBottom=''});it.tb=null;it.b.querySelectorAll('.icons').forEach(g=>{g.style.gap=''})}if(it.mm){it.mm.forEach(m=>{m.style.maxHeight='';m.style.objectFit='';m._floor=false;m._h0=0});it.mm=null}})}
function clearAll(){
 resetMedia();
 SPLIT.forEach(c=>{c.style.gridTemplateColumns=''});
 document.querySelectorAll('ol.steps[data-n="3"]').forEach(o=>{o.classList.add('g3');o.classList.remove('g2')});
 ITEMS.forEach(it=>{it.b.style.zoom=''});
 document.querySelectorAll('.pg-off,.pg-top').forEach(e=>e.classList.remove('pg-off','pg-top'));
 document.querySelectorAll('.steps li').forEach(li=>{li.style.counterReset=''});
 document.querySelectorAll('.tbl').forEach(t=>{t.style.zoom='';t.classList.remove('pg-off')});
 document.querySelectorAll('.tbl tr').forEach(tr=>{tr.classList.remove('pg-off')});
 chs.forEach(c=>c.classList.remove('scrollable','flip','is-open'));
 if(ENT)ENT.style.zoom='';
}
/* 書頁內容區的底線 */
function limitY(ch){return ch.getBoundingClientRect().bottom-PAD_B}

/* 章首頁（色塊 + 重點框）也跟著文字大小放大；書頁放不下時，每次縮 2.5% 直到放得下（最小回到 80%） */
function fitOpen(ch,set){
 if(!ch.classList.contains('is-open'))return;
 let z=BK.tz||1;
 if(z!==1)set.forEach(it=>{it.b.style.zoom=z});
 for(let i=0;i<24&&(ch.scrollHeight>ch.clientHeight+1||extent(set).bottom>limitY(ch));i++){
  z=Math.max(.8,+(z-.025).toFixed(3));
  set.forEach(it=>{it.b.style.zoom=z});
 }
}

/* 讓 set 裡的區塊顯示、其餘隱藏 */
function render(ch,set){
 ch.style.paddingTop='';
 resetMedia();
 ITEMS.forEach(it=>{
  it.b.style.translate='';
  if(!it.isTr)it.b.style.zoom=tzOf(it);
 });
 ch.querySelectorAll('.pg-top').forEach(e=>e.classList.remove('pg-top'));
 ITEMS.forEach(it=>it.b.classList.toggle('pg-off',!set.has(it)));
 ch.querySelectorAll('ol.steps').forEach(ol=>{
  const lis=[...ol.children].filter(x=>x.tagName==='LI');
  lis.forEach(li=>{li.style.counterReset=''});
  const first=lis.findIndex(li=>!li.classList.contains('pg-off'));
  ol.classList.toggle('pg-off',first<0);
  /* 三張一排的小圖卡片：一頁只剩 1、2 張，或文字大小是「特大」（三欄太窄、每張都比書頁高）時，
     改用 2 張卡片那套「小圖在左、文字在右」的橫排版面，卡片變寬變矮，一頁放得下更多張 */
  if(ol.dataset.n==='3'&&ol.querySelector(':scope>li>.mini')){
   const v=lis.filter(li=>!li.classList.contains('pg-off')).length,wide=(v>0&&v<=2)||(BK.tz||1)>=1.15;
   ol.classList.toggle('g2',wide);ol.classList.toggle('g3',!wide);
  }
  if(first>0)lis[first].style.counterReset='s '+first;
 });
 ch.querySelectorAll('.tbl').forEach(tbl=>{
  const trs=[...tbl.querySelectorAll('tbody tr')];
  if(trs.length){
   const hasVis=trs.some(tr=>!tr.classList.contains('pg-off'));
   tbl.classList.toggle('pg-off',!hasVis);
   tbl.style.zoom=String(BK.tz||1);
  }
 });
 [...CONTS].reverse().forEach(c=>c.classList.toggle('pg-off',![...c.children].some(x=>!x.classList.contains('pg-off'))));
 /* 被攤開的卡片組：這一頁只剩幾張，欄數就跟著變成幾欄，不留空白欄 */
 CONTS.forEach(c=>{if(!SPLIT.has(c))return;const v=[...c.children].filter(x=>!x.classList.contains('pg-off')).length;
  c.style.gridTemplateColumns=(v>0&&v<c.children.length)?'repeat('+v+',minmax(0,1fr))':''});
 const f=[...set][0];
 if(f){
  const el=f.isTr?f.tbl:(f.b.tagName==='LI'?f.ol:f.b);
  el.classList.add('pg-top');
 }
 ch.classList.toggle('is-open',[...set].some(i=>i.b.classList.contains('spread')));
}
/* 量目前顯示的區塊：最上緣與最下緣 */
function extent(set){
 let top=Infinity,bottom=-Infinity;
 set.forEach(it=>{
  if(it.isTr&&it.tbl){
   const th=it.tbl.querySelector('thead');
   if(th){
    const thr=th.getBoundingClientRect();
    top=Math.min(top,thr.top);
   }
  }
  const r=it.b.getBoundingClientRect();
  top=Math.min(top,r.top);bottom=Math.max(bottom,r.bottom);
 });
 return{top,bottom};
}

function pack(ch,slack){
 clearAll();
 ITEMS=buildItems(ch);
 const L=limitY(ch)-(slack||0),pages=[];
 const over=arr=>{const s=new Set(arr);render(ch,s);const e=extent(s);const zm=(BK.tz||1)>1?0.95:ZMIN;return(e.bottom-e.top)>(L-e.top)/zm+.5};

 /* 先分成「單元」：一個 h3 小節（標題 + 說明 + 圖 + 步驟…）是一個單元；
    章首（色塊、重點、用生活來想）是一個單元；h3 以前其餘的區塊各自一個單元。
    同一件事盡量不拆開跨頁，免得新手要翻頁才看得完同一個說明。 */
 const units=[];let curU=null,seenH3=false,inOpener=true;
 const isOpen=it=>it.b.classList.contains('spread')||it.b.classList.contains('key')||it.b.classList.contains('open-row')||(it.b.matches('.metaphor')&&it.b.parentElement===ch);
 for(const it of ITEMS){
  if(it.b.tagName==='H3'){seenH3=true;inOpener=false;curU={items:[it]};units.push(curU);continue}
  if(!seenH3){
   if(inOpener&&isOpen(it)){if(!curU||!curU.opener){curU={items:[],opener:true};units.push(curU)}curU.items.push(it);continue}
   inOpener=false;curU={items:[it]};units.push(curU);continue;
  }
  curU.items.push(it);
 }

 /* 章首（色塊 + 重點）固定自己一頁：不讓它被後面的內容擠掉，也不拆開 */
 if(units.length&&units[0].opener)pages.push(units.shift().items);
 let cur=[];
 /* 單元比一頁還高時，才一個區塊一個區塊拆；標題、說明不留在頁尾 */
 const addItemwise=items=>{
  for(const it of items){
   const trial=[...cur,it];
   if(cur.length&&over(trial)){
    const carry=[];
    while(cur.length>1&&cur[cur.length-1].keep)carry.unshift(cur.pop());
    pages.push(cur);cur=[...carry,it];
   }else cur=trial;
  }
 };
 for(const u of units){
  const trial=[...cur,...u.items];
  if(!over(trial)){cur=trial;continue}
  if(cur.length&&!over(u.items)){pages.push(cur);cur=[...u.items];continue}
  addItemwise(u.items);
 }
 if(cur.length)pages.push(cur);
 return pages.map(arr=>({set:new Set(arr),items:arr}));
}

/* 這一頁內容比書頁高一點點時，把頁裡的區塊一起縮小（最多縮到 ZMIN），讓整個小節留在同一頁 */
function fitZoom(ch,set){
 if(ch.classList.contains('is-open'))return;
 const e=extent(set),room=limitY(ch)-e.top,used=e.bottom-e.top;
 const zmin=.8;
 let cur=1;
 if(used>room+.5){
  cur=Math.max(zmin,room/used*.995);
  set.forEach(it=>{
   if(it.isTr){
    if(it.tbl)it.tbl.style.zoom=((BK.tz||1)*cur).toFixed(3);
   }else{
    it.b.style.zoom=((+tzOf(it)||1)*cur).toFixed(3);
   }
  });
 }
 /* 縮一次不一定放得下（區塊縮小後重新換行、高度不是等比例變化）：縮完再量，
    還超出就每次再縮 1.5%，直到放得下。下限 0.8 倍，保證不超出書頁、底端文字與頁碼不被截斷 */
 for(let i=0;i<30&&cur>zmin;i++){
  const x=extent(set);
  if(x.bottom<=limitY(ch)+.5)break;
  cur=Math.max(zmin,+(cur-.015).toFixed(3));
  set.forEach(it=>{
   if(it.isTr){
    if(it.tbl)it.tbl.style.zoom=((BK.tz||1)*cur).toFixed(3);
   }else{
    it.b.style.zoom=((+tzOf(it)||1)*cur).toFixed(3);
   }
  });
 }
 shrinkMedia(ch,set);
}

/* zoom 縮不動圖片：圖片寬度固定等於欄寬，等比例的高度不會跟著縮。
   縮到下限還放不下時，直接限制這一頁最高那張圖（示意圖、步驟小圖）的高度，
   用 object-fit:contain 置中等比例縮小，不變形；每次依剩下的超出量調整，量到放得下為止（最多縮到原高 55%）。 */
function shrinkMedia(ch,set){
 const lim=limitY(ch);
 if(extent(set).bottom<=lim+.5)return;
 /* 表格（按鍵對照表）：字級不動，只把每一列的上下內距逐步收緊（每次 1.5px，最少留 2px） */
 set.forEach(it=>{
  const tbl=it.tbl||(it.b.matches('.tbl')?it.b:null);
  const cells=[...(tbl?tbl:it.b).querySelectorAll('.tbl th, .tbl td')];
  if(!cells.length)return;
  let tp=parseFloat(getComputedStyle(cells[0]).paddingTop)||10;
  for(let i=0;i<8&&extent(set).bottom>lim+.5&&tp>2;i++){
   tp=Math.max(2,tp-1.5);
   cells.forEach(c=>{c.style.paddingTop=tp+'px';c.style.paddingBottom=tp+'px'});
   it.tb=cells;
  }
 });
 if(extent(set).bottom<=lim+.5)return;
 /* App 圖示卡片（圖固定 56px，不會被下面的縮圖處理到）：逐步收緊卡片上下內距與格距，每次 2px，內距最少留 6px */
 set.forEach(it=>{
  const cards=[...it.b.querySelectorAll('.icon-card')];
  if(!cards.length)return;
  const grid=cards[0].parentElement;
  let tp=parseFloat(getComputedStyle(cards[0]).paddingTop)||16;
  for(let i=0;i<8&&extent(set).bottom>lim+.5&&tp>6;i++){
   tp=Math.max(6,tp-2);
   cards.forEach(c=>{c.style.paddingTop=tp+'px';c.style.paddingBottom=Math.max(6,tp-2)+'px'});
   grid.style.gap=Math.max(6,tp-2)+'px';
   it.tb=(it.tb||[]).concat(cards);
  }
 });
 if(extent(set).bottom<=lim+.5)return;
 for(let i=0;i<8;i++){
  const ov=extent(set).bottom-lim;
  if(ov<=.5)return;
  let best=null,bh=0;
  set.forEach(it=>{
   it.b.querySelectorAll('svg,img').forEach(m=>{
    if(m.closest('.zl')||m.classList.contains('ic'))return;
    const h=m.getBoundingClientRect().height;
    if(h>bh&&h>=60&&!(it.mm&&it.mm.has(m)&&m._floor)){best=m;bh=h;best._it=it}
   });
  });
  if(!best)return;
  const it=best._it,h0=best._h0||(best._h0=bh),want=Math.max(h0*.55,bh-ov);
  if(want>=bh-.5){best._floor=true;continue}
  if(!it.mm)it.mm=new Set();
  it.mm.add(best);
  best.style.objectFit='contain';
  const lh=parseFloat(getComputedStyle(best).height);   /* SVG 沒有 offsetHeight，用算出來的樣式高度（與 style.maxHeight 同一套單位） */
  if(!(lh>0)){best._floor=true;continue}
  const mh=Math.max(40,lh*want/bh).toFixed(1)+'px';
  best.style.maxHeight=mh;
  if(want<=h0*.55+.5)best._floor=true;
  /* 同一排並排的同高圖（App 圖示卡片等）要一起縮，只縮一張，那排高度仍由另一張撐著，量起來不會變矮 */
  set.forEach(o=>o.b.querySelectorAll('svg,img').forEach(m=>{
   if(m===best||m.closest('.zl')||m.classList.contains('ic')||Math.abs(m.getBoundingClientRect().height-bh)>1.5)return;
   m.style.objectFit='contain';m.style.maxHeight=mh;m._h0=m._h0||bh;if(want<=h0*.55+.5)m._floor=true;
   if(!o.mm)o.mm=new Set();o.mm.add(m);
  }));
 }
}

/* 逐頁實際量：回傳所有頁裡「超出書頁底線」最多的量（只有一個區塊的頁不算，那是區塊本身比書頁高） */
function verify(ch,pages){
 const L=limitY(ch);let worst=0;
 pages.forEach(pg=>{
  if(pg.items.length<2&&!pg.items.some(x=>x.isTr))return;
  render(ch,pg.set);fitZoom(ch,pg.set);
  worst=Math.max(worst,extent(pg.set).bottom-L);
 });
 return worst;
}

/* 書頁的頁首（章名）與頁尾（頁碼） */
function chrome(ch){
 let h=ch.querySelector(':scope>.pg-head'),f=ch.querySelector(':scope>.pg-folio');
 if(!h){h=document.createElement('div');h.className='pg-head';h.setAttribute('data-chrome','');h.setAttribute('aria-hidden','true');ch.prepend(h)}
 if(!f){f=document.createElement('div');f.className='pg-folio';f.setAttribute('data-chrome','');f.setAttribute('aria-hidden','true');ch.append(f)}
 return{h,f};
}

function showPage(p){
 const ch=chs[PG.cur];if(!ch)return;
 const pg=BK.pages[p];if(!pg)return;
 BK.page=p;
  render(ch,pg.set);
 /* 整頁只有一組卡片（例如四個按鍵說明）時，卡片放大、字放大，把頁面填滿；放大後超出書頁就取消 */
 ch.classList.remove('roomy');
 {const v=pg.items.filter(it=>!it.f);
  if(v.length===1&&v[0].b.matches('.cards')){ch.classList.add('roomy');if(extent(pg.set).bottom>limitY(ch))ch.classList.remove('roomy')}}
 fitOpen(ch,pg.set);
 fitZoom(ch,pg.set);
 /* 單一區塊比書頁還高（極少數）時，這一頁在書頁內可往下捲 */
 /* 區塊外框的內距多出幾 px 不算：書頁底部本來就留了 56px 空白，內容仍完整可見，不需要多一條捲軸 */
 ch.classList.toggle('scrollable',extent(pg.set).bottom>limitY(ch)+10);
 /* 只有一個區塊的頁（內容很少）把它往中間挪，上下留白相近；章首頁會自己撐滿，不處理 */
 if(!ch.classList.contains('is-open')&&!ch.classList.contains('scrollable')){
  const vis=pg.items.filter(it=>!it.f),e=extent(pg.set),room=limitY(ch)-e.top,used=e.bottom-e.top;
  /* 整頁只有一個區塊，或只有幾張步驟卡時，往中間挪 */
  if((vis.length===1||vis.every(it=>it.b.tagName==='LI'))&&used<room*.85)ch.style.paddingTop=Math.round(PAD_T+(room-used)*.4)+'px';
 }
 const c=chrome(ch);
 c.h.innerHTML='<span>第 '+ch.dataset.no+' 章　'+ch.dataset.title+'</span><span>Mac 新手上手分享包</span>';
 c.f.textContent=(p+1)+' / '+BK.pages.length;
 ch.dataset.dir=dir;ch.classList.remove('flip');void ch.offsetWidth;ch.classList.add('flip');
 try{if(!ENT)localStorage.setItem(POS,JSON.stringify({c:PG.cur,p}))}catch(e){}
}

/* 目前頁的大綱高亮：頁面上最後一個有 id 的 h3 */
function markOutline(){
 const ch=chs[PG.cur];if(!ch)return;
 let h=null;ch.querySelectorAll('h3[id]').forEach(x=>{if(!x.closest('.pg-off'))h=x});
 document.querySelectorAll('.outline a').forEach(a=>{if(h&&a.getAttribute('href')==='#'+h.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
}

const want=()=>innerWidth>=1100&&innerHeight>=560;

/* 書頁高度 = 視窗 - 頂部列 - 翻頁列 - 上下留白 */
function sizeSheet(){
 const sh=innerHeight-ibar.offsetHeight-16-Math.max(dock.offsetHeight,76)-12-14;
 R.style.setProperty('--sh',sh+'px');
 R.style.setProperty('--A',(sh-PAD_B-48)+'px');
}

Object.assign(BK,{
 handle(t,ent){
  const on=want();
  R.classList.toggle('book',on&&!ent);BK.on=on&&!ent;
  /* 常見問題在翻頁模式一律展開：Safari 不理會對收合 <details> 的 CSS 強制顯示，一定要設 open；
     之後若被鍵盤收合，立刻再展開，頁面高度才不會變 */
  if(on)document.querySelectorAll('.faq details').forEach(d=>{d.open=true;if(!d._k){d._k=1;d.addEventListener('toggle',()=>{if(BK.on&&!d.open)d.open=true})}});
  if(!on){clearAll();BK.pages=[];return false}
  scrollTo({top:0,behavior:'instant'});
  sizeSheet();
  if(ent){
   clearAll();ITEMS=[];BK.pages=[{set:new Set(),items:[]}];BK.page=0;
   /* 第 2 冊入口頁以自然文字排版呈現，高度不足時允許流暢捲動，文字大小依 --tz 與 --fs 響應式排版 */
   if(ENT)ENT.style.zoom='';
   return true;
  }
  const ch=chs[PG.cur];
  /* 圖片還沒載入時高度是 0，載入後會讓排好的頁超出書頁；載入完成就重排 */
  ch.querySelectorAll('img').forEach(img=>{if(!img.complete&&!img._w){img._w=1;img.addEventListener('load',()=>route(),{once:true})}});
  /* 排好後逐頁實際量一次；有哪一頁還是超出書頁，就把可用高度再減掉超出的量，重排（最多 4 輪） */
  let pages,slack=0;
  SPLIT=new Set();
  for(let n=0;n<6;n++){
   pages=pack(ch,slack);
   /* 單獨一頁的整塊卡片縮到下限仍超出書頁：攤開成一張一張，重排 */
   const tall=pages.filter(pg=>{
    if(pg.items.length!==1||!pg.items[0].b.matches('.cards')||SPLIT.has(pg.items[0].b))return false;
    render(ch,pg.set);fitZoom(ch,pg.set);return extent(pg.set).bottom-limitY(ch)>1});
   if(tall.length){tall.forEach(pg=>SPLIT.add(pg.items[0].b));slack=0;continue}
   const ov=verify(ch,pages);
   if(ov<=1)break;
   slack+=ov+4;
  }
  BK.pages=pages;
  pageOf=new Map();
  BK.pages.forEach((pg,i)=>pg.items.forEach(it=>{pageOf.set(it.b,i);if(it.ol&&!pageOf.has(it.ol))pageOf.set(it.ol,i)}));
  let p=0;
  if(restore!==null){p=restore;restore=null}
  else if(t&&t!==ch){
   let n=t.classList.contains('sec')&&t.firstElementChild?t.firstElementChild:t;
   while(n&&n!==ch&&!pageOf.has(n))n=n.parentElement;
   if(n&&pageOf.has(n))p=pageOf.get(n);
  }else if(keep&&pageOf.has(keep))p=pageOf.get(keep);
  else if(wantLast)p=BK.pages.length-1;
  keep=null;wantLast=false;dir='n';
  showPage(Math.max(0,Math.min(p,BK.pages.length-1)));
  return true;
 },
 /* 文字大小改了：重新分頁，並盡量留在目前這一頁的內容上 */
 refit(){const pg=BK.pages[BK.page],f=pg&&pg.items[0];keep=f?f.b:null;route()},
 go(p){
  if(!BK.on||p<0||p>=BK.pages.length)return;
  dir=p>BK.page?'n':'p';
  showPage(p);scrollTo({top:0,behavior:'instant'});
  onScroll.d=0;onScroll();BK.sync();
 },
 next(){if(BK.page<BK.pages.length-1)BK.go(BK.page+1);else if(dnext.getAttribute('href'))location.href=dnext.getAttribute('href')},
 prev(){
  if(BK.page>0){BK.go(BK.page-1);return}
  if(PG.entry)return;
  if(PG.cur>0){wantLast=true;location.hash='#ch-'+PG.cur}
  else if(ENT){location.hash=''}
 },
 frac(){return BK.pages.length?BK.page/BK.pages.length:0},
 sync(){
  const ico=dup.querySelector('use'),lb=dup.querySelector('.lb');
  if(!BK.on){
   dup.setAttribute('aria-label','回到頂端');dup.title='回到頂端';ico&&ico.setAttribute('href','#v-up');if(lb)lb.textContent='回頂端';dup.disabled=false;return;
  }
  const last=BK.page>=BK.pages.length-1,n=BK.pages.length;
  dup.setAttribute('aria-label','上一頁');dup.title='上一頁（←）';ico&&ico.setAttribute('href','#v-bk');if(lb)lb.textContent='上一頁';
  dup.disabled=PG.entry||(PG.cur===0&&BK.page===0&&!ENT);
  if(PG.entry){
   dnow.innerHTML='開始：<b>最常用到的對照操作</b>';
   dnext.href='#ch-1';
   dnext.querySelector('.lb').textContent='下一章：01 先看這張速查表';
  }else{
   const s=chs[PG.cur];if(!s)return;
   dnow.innerHTML='第 '+s.dataset.no+' 章　<b>'+s.dataset.title+'</b>　<span class="pgn">本章第 '+(BK.page+1)+' / '+n+' 頁</span>';
   /* 最後一頁的按鈕直接寫出下一章叫什麼，新手不用猜按下去會到哪裡 */
   const nc=chs[PG.cur+1];
   dnext.querySelector('.lb').textContent=!last?'下一頁':(nc?'下一章：'+nc.dataset.title:NX[PG.cur].label);
  }
  markOutline();
  if(typeof updateBack==='function')updateBack();
 }
});

dnext.addEventListener('click',e=>{
 if(BK.on&&BK.page<BK.pages.length-1){e.preventDefault();BK.go(BK.page+1)}
});
addEventListener('keydown',e=>{
 if(!BK.on||e.metaKey||e.ctrlKey||e.altKey)return;
 if(!lb.hidden||!panel.hidden)return;
 const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
 if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();BK.next()}
 else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();BK.prev()}
});

/* 視窗大小變了：重新分頁，並盡量留在目前這一頁的內容上 */
let rt;
addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{
 const pg=BK.pages[BK.page],f=pg&&pg.items[0];keep=f?f.b:null;
 route();
},150)});
addEventListener('load',()=>route());

/* 第 1 冊：沒有指定章節時，接著上次讀到的地方 */
if(!location.hash&&!ENT&&want()){
 try{
  const sv=JSON.parse(localStorage.getItem(POS)||'null');
  if(sv&&Number.isInteger(sv.c)&&sv.c>=0&&sv.c<chs.length){
   restore=Math.max(0,sv.p|0);
   history.replaceState(null,'','#'+chs[sv.c].id);
  }
 }catch(e){}
}
route();
})();
