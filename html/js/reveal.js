(()=>{const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
function count(el){const t=+el.dataset.n;if(rm||!t)return;let s0=null;const f=ts=>{if(!s0)s0=ts;const p=Math.min(1,(ts-s0)/800);el.textContent=String(Math.max(0,Math.round(t*(1-Math.pow(1-p,3))))).padStart(2,'0');if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add('in');io.unobserve(e.target);e.target.querySelectorAll('.cnt').forEach(count)}),{rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('.rv').forEach(e=>io.observe(e));})();
