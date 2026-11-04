const chs=[...document.querySelectorAll('section.ch')],prog=document.querySelector('.prog'),cbn=document.querySelector('.chbtn .n'),panel=document.getElementById('panel'),cb=document.querySelector('.chbtn');
const dock=document.querySelector('.dock'),dnow=document.querySelector('.dock .now'),dnext=document.querySelector('.dock .nx'),NX=JSON.parse(document.getElementById('nx').textContent);
let cur=0;
const ENT=document.querySelector('.entry'),PG={cur:0,entry:false};
const bbtn=document.querySelector('.ibar .back');
function updateBack(){
 if(!bbtn)return;
 const lb=bbtn.querySelector('.lb');
 if(ENT){
  if(PG.entry){
   bbtn.href='index.html';
   bbtn.setAttribute('aria-label','回 Mac 上手包首頁');
   if(lb)lb.textContent='回上手包';
  }else{
   bbtn.href='windows.html';
   bbtn.setAttribute('aria-label','回 Windows 換 Mac 首頁');
   if(lb)lb.textContent='回首頁';
  }
 }else{
  const h=location.hash;
  const isStart=(PG.cur===0&&(!BK.on||BK.page===0)&&(!h||h==='#ch-1'));
  if(isStart){
   bbtn.href='index.html';
   bbtn.setAttribute('aria-label','回 Mac 上手包首頁');
   if(lb)lb.textContent='回上手包';
  }else{
   bbtn.href='#ch-1';
   bbtn.setAttribute('aria-label','回一開始的第一章');
   if(lb)lb.textContent='回首頁';
  }
 }
}
if(bbtn){
 bbtn.addEventListener('click',e=>{
  if(ENT){
   if(!PG.entry){
    e.preventDefault();
    try{history.pushState(null,'',window.location.pathname)}catch(err){location.hash=''}
    route();
    scrollTo({top:0,behavior:'instant'});
   }
  }else{
   const h=location.hash;
   const isStart=(PG.cur===0&&(!BK.on||BK.page===0)&&(!h||h==='#ch-1'));
   if(!isStart){
    e.preventDefault();
    try{history.pushState(null,'',window.location.pathname+'#ch-1')}catch(err){location.hash='#ch-1'}
    route();
    if(BK.on&&typeof BK.go==='function')BK.go(0);
    scrollTo({top:0,behavior:'instant'});
    updateBack();
   }
  }
 });
}
/* 書本式翻頁（電腦寬度）由 js/book.js 補上實作；沒載入或畫面太小時維持「一章一頁、可捲動」。 */
const BK={on:false,page:0,pages:[],handle(){return false},sync(){},frac(){return 0},prev(){}};
function onScroll(){const h=document.documentElement;document.querySelector('.ibar').classList.toggle('sc',h.scrollTop>4);prog.style.width=(PG.entry?0:(PG.cur+(BK.on?BK.frac():h.scrollTop/Math.max(1,h.scrollHeight-innerHeight)))/chs.length*100)+'%';
 let c=PG.cur;
 const preS=PG.entry;if(c!==cur||!onScroll.d||preS!==onScroll.p){cur=c;onScroll.d=1;onScroll.p=preS;const s=chs[c];cbn.textContent=s.dataset.no+'／'+s.dataset.total;
  document.querySelectorAll('.ci[data-i]').forEach(a=>a.setAttribute('aria-current',+a.dataset.i===c));
  const cn=document.querySelector('.ibar .cn');const pre=PG.entry;if(cn)cn.textContent=pre?'第 01 章・先看這張速查表':'第 '+s.dataset.no+' 章・'+s.dataset.title;document.querySelector('.ibar').style.setProperty('--cc',getComputedStyle(s).getPropertyValue('--cc'));
  if(pre){
   dnow.innerHTML='第 01 章　<b>先看這張速查表</b>';dnext.href='#ch-2';dnext.querySelector('.lb').textContent='下一章：02 Ctrl 換成了 Command';
   dnext.querySelector('use').setAttribute('href','#v-fw');
  }else{
   dnow.innerHTML='第 '+s.dataset.no+' 章　<b>'+s.dataset.title+'</b>';const n=NX[c];dnext.href=n.href;dnext.querySelector('.lb').textContent=n.label;
   dnext.querySelector('use').setAttribute('href',n.ext?'#v-ext':'#v-fw')
  }updateBack();}}
const hs=[...document.querySelectorAll('.ch h3[id]')];let curH=null;
function onSec(){let h=null;hs.forEach(x=>{if(x.offsetParent&&x.getBoundingClientRect().top<innerHeight*.4)h=x});if(h===curH)return;curH=h;document.querySelectorAll('.outline a').forEach(a=>{if(h&&a.getAttribute('href')==='#'+h.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}
addEventListener('scroll',()=>{onScroll();onSec()},{passive:true});
/* 分頁式閱讀：一次只顯示一章，按「下一章」才換頁，滾輪不會滑進下一章。
   網址 #ch-N 顯示第 N 章；#c1-h2、#q-xxx 這類段落錨點會先顯示它所在的章再捲到該處。 */
function route(){
 const id=decodeURIComponent(location.hash.slice(1));let t=id?document.getElementById(id):null,ci=-1,ent=false;
 if(t){const o=t.closest('section.ch');if(o)ci=chs.indexOf(o);else if(ENT&&ENT.contains(t))ent=true}
 if(ci<0&&!ent){t=null;if(ENT)ent=true;else ci=0}
 PG.entry=ent;PG.cur=Math.max(ci,0);
 const R=document.documentElement;R.classList.add('paged');R.classList.toggle('pg-entry',ent);
 chs.forEach((c,i)=>c.classList.toggle('cur',!ent&&i===PG.cur));
 onScroll.d=0;
 updateBack();
 if(!BK.handle(t,ent)){if(t&&!chs.includes(t)&&t!==ENT)t.scrollIntoView({behavior:'instant',block:'start'});else scrollTo({top:0,behavior:'instant'})}
 curH=null;onScroll();onSec();BK.sync()}
addEventListener('hashchange',route);
addEventListener('popstate',route);
route();
document.querySelectorAll('.chk input').forEach(c=>{try{c.checked=localStorage.getItem('mac-'+c.dataset.k)==='1'}catch(e){}c.addEventListener('change',()=>{try{localStorage.setItem('mac-'+c.dataset.k,c.checked?'1':'0')}catch(e){}})});
const ends=new Set();const io=new IntersectionObserver(es=>{es.forEach(e=>e.isIntersecting?ends.add(e.target):ends.delete(e.target));dock.classList.toggle('off',(ends.size>0&&!BK.on)||!panel.hidden)},{rootMargin:'0px 0px -40px 0px'});
document.querySelectorAll('.chend,.band,.recap').forEach(e=>io.observe(e));
function setPanel(open){panel.hidden=!open;cb.setAttribute('aria-expanded',open);dock.classList.toggle('off',open||(ends.size>0&&!BK.on));if(open){const q=document.getElementById('q');setTimeout(()=>q&&q.focus({preventScroll:true}),30)}else cb.focus({preventScroll:true})}
cb.addEventListener('click',()=>setPanel(panel.hidden));const dch=document.querySelector('.dock .dch');if(dch)dch.addEventListener('click',()=>setPanel(true));const idoc=document.querySelector('.ibar .doc');if(idoc){idoc.style.cursor='default';idoc.removeAttribute('title');}
panel.addEventListener('click',e=>{if(e.target===panel||e.target.closest('.pclose')||e.target.closest('.ci[href^="#"]'))setPanel(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!lb.hidden)closeLb();else if(!panel.hidden)setPanel(false)}});
const q=document.getElementById('q');function filt(){const v=q.value.trim();let n=0;document.querySelectorAll('.clist li').forEach(li=>{const hit=!v||li.dataset.t.includes(v)||li.dataset.s.includes(v);li.hidden=!hit;if(hit)n++});document.querySelector('.cempty').hidden=n>0}
q.addEventListener('input',filt);document.querySelector('.field .clr').addEventListener('click',()=>{q.value='';filt();q.focus()});
/* 文字大小：標準 100%、大 116%、特大 132%。倍率放在 --tz 與 BK.tz：
   翻頁模式由 book.js 對每個區塊套 zoom 後重新分頁（頁數會跟著增減）；第 2 冊入口與章節由 CSS 變數排版響應。
   選擇記在 localStorage（mac-tz），下次打開還在。 */
const TZV={'20px':1,'22px':1.16,'24px':1.32};
function setTz(fs,save){const v=TZV[fs]||1;BK.tz=v;document.documentElement.style.setProperty('--tz',v);document.documentElement.style.setProperty('--fs',fs);if(ENT)ENT.style.zoom='';
 document.querySelectorAll('.seg button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.fs===fs));
 if(save)try{localStorage.setItem('mac-tz',fs)}catch(e){}}
try{const sv=localStorage.getItem('mac-tz');if(sv&&TZV[sv])setTz(sv,false)}catch(e){}
document.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click',()=>{setTz(b.dataset.fs,true);if(BK.on)BK.refit()}));
const lb=document.getElementById('lb');let lastZ=null;function closeLb(){lb.hidden=true;document.body.style.overflow='';if(lastZ)lastZ.focus()}
lb.querySelector('.cls').addEventListener('click',closeLb);lb.addEventListener('click',e=>{if(e.target===lb||e.target.classList.contains('box'))closeLb()});
document.querySelectorAll('figure.dia').forEach(f=>{const src=f.querySelector(':scope>.dia-img,:scope>img');if(!src)return;const b=document.createElement('button');b.type='button';b.className='zm';b.setAttribute('aria-label','點圖放大：'+(src.getAttribute('aria-label')||src.getAttribute('alt')||'圖'));
 src.replaceWith(b);b.appendChild(src);const l=document.createElement('span');l.className='zl';l.setAttribute('aria-hidden','true');l.innerHTML='<svg class="ic"><use href="#v-zoom"/></svg>點圖放大';b.appendChild(l);
 b.addEventListener('click',()=>{lastZ=b;const c=src.cloneNode(true);lb.querySelector('.box').replaceChildren(c);lb.hidden=false;document.body.style.overflow='hidden';lb.querySelector('.cls').focus()})});
document.querySelector('.dock .up').addEventListener('click',()=>BK.on?BK.prev():scrollTo({top:0}));



