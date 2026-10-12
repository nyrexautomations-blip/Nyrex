/* Nyrex site script: nav, scroll motion, example chats, FAQ search, pilot form. No tracking, no external calls. */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* mobile nav */
  var burger=document.querySelector('.burger');
  var nav=document.getElementById('nav');
  if(burger&&nav){
    burger.addEventListener('click',function(){
      var open=nav.classList.toggle('open');
      burger.setAttribute('aria-expanded',open?'true':'false');
    });
    nav.addEventListener('click',function(e){
      if(e.target.tagName==='A'){nav.classList.remove('open');burger.setAttribute('aria-expanded','false')}
    });
  }

  /* header shadow, reading progress bar and the mobile demo button */
  var header=document.querySelector('header.top');
  var bar=document.querySelector('.progress');
  var dock=document.querySelector('.dock');
  var ticking=false;
  function onScroll(){
    ticking=false;
    var y=window.scrollY||0;
    var max=Math.max(document.documentElement.scrollHeight-window.innerHeight,1);
    if(header) header.classList.toggle('scrolled',y>8);
    if(bar) bar.style.setProperty('--p',Math.min(y/max,1).toFixed(4));
    if(dock) dock.classList.toggle('show',y>520&&y<max-420);
  }
  onScroll();
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(onScroll)}},{passive:true});
  window.addEventListener('resize',onScroll);

  /* scroll reveal: fade and rise as content enters the screen, staggered within a group */
  try{
    clearTimeout(window.__rt);
    var targets=document.querySelectorAll('main section h2,main section .lead,.times>div,.tl-label,.facts li,.fgrid li,.demo-grid,.tabs,.tablewrap,.menu li,.rules li,.checklist li,.steps li,.flow li,.days li,.boards a,main details,.ind .head,.ind .wrap>div,.chat,.panel .split>div,.prose h2,.prose p,.prose ul,.faqgroup h2,.cta-band .row,.chips,.form,.search,.calc-grid');
    var heroSel='.board-hero,.pagehead';
    var seen=[];
    Array.prototype.forEach.call(targets,function(el){
      if(el.closest(heroSel)) return;
      var sibs=el.parentNode?Array.prototype.filter.call(el.parentNode.children,function(c){return c.classList.contains('reveal')}):[];
      el.classList.add('reveal');
      el.style.setProperty('--d',Math.min(sibs.length*0.08,0.4)+'s');
      seen.push(el);
    });
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}});
      },{threshold:0.12,rootMargin:'0px 0px -6% 0px'});
      seen.forEach(function(el){io.observe(el)});
    }else{
      seen.forEach(function(el){el.classList.add('in')});
    }
  }catch(err){document.documentElement.classList.add('reveal-all')}

  /* ---- example chats ---- */
  function play(box,script,stamp,done,loop){
    var dead=false,timers=[],i=0;
    function later(fn,ms){timers.push(setTimeout(function(){if(!dead)fn()},ms))}
    function add(who,text,animate){
      var d=document.createElement('div');
      d.className='m '+who+(animate?' pop':'');
      d.textContent=text;
      var t=document.createElement('time');
      t.textContent=stamp;
      d.appendChild(t);
      box.appendChild(d);
      /* drop messages only once they have fully scrolled out of view (content overflows upward in this layout) */
      var top=box.getBoundingClientRect().top;
      while(box.children.length>1&&box.firstChild.getBoundingClientRect().bottom<top+4){box.removeChild(box.firstChild)}
      return d;
    }
    function typing(){
      var d=document.createElement('div');
      d.className='typing';
      d.innerHTML='<span></span><span></span><span></span>';
      box.appendChild(d);
      return d;
    }
    if(reduce){script.forEach(function(s){add(s[0],s[1],false)});if(done)done();return {stop:function(){}}}
    function next(){
      if(i>=script.length){
        if(done)done();
        if(loop)later(function(){box.innerHTML='';i=0;next()},5000);
        return;
      }
      var s=script[i++];
      if(s[0]==='bot'){
        var t=typing();
        later(function(){t.remove();add('bot',s[1],true);later(next,1100)},900);
      }else{
        later(function(){add('me',s[1],true);later(next,700)},900);
      }
    }
    next();
    return {stop:function(){dead=true;timers.forEach(clearTimeout)}};
  }

  /* hero chat */
  var phone=document.querySelector('.phone[data-script]');
  if(phone){
    var hs;
    try{hs=JSON.parse(phone.getAttribute('data-script'))}catch(e){hs=null}
    if(hs) play(phone.querySelector('.msgs'),hs,phone.getAttribute('data-time')||'11:02 pm',null,true);
  }

  /* industry demo: tabs, chat, then the owner's alert */
  var dataEl=document.getElementById('demo-data');
  if(dataEl){
    var D;
    try{D=JSON.parse(dataEl.textContent)}catch(e){D=null}
    var tabs=Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
    var panel=document.getElementById('demo-panel');
    var box=document.getElementById('demo-msgs');
    var card=document.getElementById('mail-card');
    var empty=document.getElementById('mail-empty');
    var run=null;
    var show=function(k){
      var d=D[k]; if(!d) return;
      tabs.forEach(function(t){
        var on=t.getAttribute('data-k')===k;
        t.setAttribute('aria-selected',on?'true':'false');
        t.tabIndex=on?0:-1;
        if(on) panel.setAttribute('aria-labelledby',t.id);
      });
      document.getElementById('demo-name').textContent=d.name;
      document.getElementById('demo-sub').textContent=d.sub;
      document.getElementById('demo-av').textContent=d.av;
      if(run) run.stop();
      box.innerHTML='';
      card.hidden=true; empty.hidden=false;
      run=play(box,d.msgs,d.time,function(){
        document.getElementById('mail-subject').textContent=d.alert.who+': a customer needs a follow-up';
        document.getElementById('mail-customer').textContent=d.alert.customer;
        document.getElementById('mail-wrote').textContent=d.alert.wrote;
        document.getElementById('mail-reply').textContent=d.alert.reply;
        empty.hidden=true;
        card.hidden=false;
        card.style.animation='none'; void card.offsetWidth; card.style.animation='';
      },false);
    };
    if(D){
      tabs.forEach(function(t,idx){
        t.addEventListener('click',function(){show(t.getAttribute('data-k'))});
        t.addEventListener('keydown',function(e){
          var n=null;
          if(e.key==='ArrowRight') n=(idx+1)%tabs.length;
          else if(e.key==='ArrowLeft') n=(idx-1+tabs.length)%tabs.length;
          else if(e.key==='Home') n=0;
          else if(e.key==='End') n=tabs.length-1;
          if(n!==null){e.preventDefault();tabs[n].focus();show(tabs[n].getAttribute('data-k'))}
        });
      });
      var started=false;
      var start=function(){if(!started){started=true;show('salon')}};
      if('IntersectionObserver' in window){
        var dio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){start();dio.disconnect()}})},{threshold:0.3});
        dio.observe(panel);
      }else start();
    }
  }

  /* FAQ search */
  var q=document.getElementById('faq-search');
  if(q){
    var items=Array.prototype.slice.call(document.querySelectorAll('main details'));
    var groups=Array.prototype.slice.call(document.querySelectorAll('.faqgroup'));
    var none=document.getElementById('faq-none');
    q.addEventListener('input',function(){
      var v=q.value.trim().toLowerCase(),shown=0;
      items.forEach(function(d){
        var hit=!v||d.textContent.toLowerCase().indexOf(v)!==-1;
        d.hidden=!hit; if(hit) shown++;
        if(v&&hit) d.open=false;
      });
      groups.forEach(function(g){
        var any=Array.prototype.some.call(g.querySelectorAll('details'),function(d){return !d.hidden});
        g.hidden=!any;
      });
      if(none) none.hidden=shown>0;
    });
  }

  /* pilot form: opens the visitor's email app with the details filled in */
  var form=document.getElementById('pilot-form');
  if(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var f=new FormData(form);
      var g=function(k){return (f.get(k)||'').toString().trim()};
      var body='Business name: '+g('biz')+'\nType of business: '+g('type')+'\nCity: '+g('city')+'\nWhatsApp number customers message now: '+g('phone')+'\nWhat customers ask most:\n'+g('asks')+'\n';
      var url='mailto:nyrexautomations@gmail.com?subject='+encodeURIComponent('Nyrex pilot: '+(g('biz')||'new business'))+'&body='+encodeURIComponent(body);
      var st=document.getElementById('form-status');
      if(st) st.textContent='Your email app should open with these details filled in. Press send there. If nothing opened, email nyrexautomations@gmail.com.';
      window.location.href=url;
    });
  }
  /* estimator: the owner's own numbers, computed on the page, nothing is sent anywhere */
  var cDay=document.getElementById('c-day');
  if(cDay){
    var cShare=document.getElementById('c-share'),cVal=document.getElementById('c-val');
    var oDay=document.getElementById('o-day'),oShare=document.getElementById('o-share'),oVal=document.getElementById('o-val');
    var rValue=document.getElementById('r-value'),rChats=document.getElementById('r-chats'),rCust=document.getElementById('r-cust'),rSr=document.getElementById('r-sr');
    var inr=new Intl.NumberFormat('en-IN');
    var shown={v:0,c:0,u:0},raf=0,srTimer=0,first=true;
    var render=function(){
      rValue.textContent='\u20B9'+inr.format(Math.round(shown.v));
      rChats.textContent=inr.format(Math.round(shown.c));
      rCust.textContent=inr.format(Math.round(shown.u));
    };
    var calc=function(){
      var day=+cDay.value,share=+cShare.value/100,val=+cVal.value;
      oDay.textContent=day;oShare.textContent=cShare.value+'%';oVal.textContent='\u20B9'+inr.format(val);
      var chats=day*30,cust=Math.round(chats*share),value=cust*val;
      var to={v:value,c:chats,u:cust};
      clearTimeout(srTimer);
      srTimer=setTimeout(function(){rSr.textContent='About \u20B9'+inr.format(value)+' a month: '+inr.format(chats)+' chats left waiting and '+inr.format(cust)+' customers who may go elsewhere.'},600);
      if(reduce||first){first=false;shown=to;render();return}
      cancelAnimationFrame(raf);
      var from={v:shown.v,c:shown.c,u:shown.u},t0=null,dur=550;
      var step=function(ts){
        if(t0===null)t0=ts;
        var k=Math.min((ts-t0)/dur,1),e=1-Math.pow(1-k,3);
        shown={v:from.v+(to.v-from.v)*e,c:from.c+(to.c-from.c)*e,u:from.u+(to.u-from.u)*e};
        render();
        if(k<1)raf=requestAnimationFrame(step);
      };
      raf=requestAnimationFrame(step);
    };
    [cDay,cShare,cVal].forEach(function(el){el.addEventListener('input',calc)});
    calc();
  }

  /* copy the info checklist as a message the owner can paste into WhatsApp or email */
  var copyBtn=document.getElementById('copy-sheet');
  if(copyBtn){
    copyBtn.addEventListener('click',function(){
      var items=Array.prototype.map.call(document.querySelectorAll('.checklist li'),function(li,i){return (i+1)+'. '+li.textContent.trim()+':'});
      var text='Hi Nyrex, here are my business details.\n\n'+items.join('\n\n')+'\n';
      var st=document.getElementById('copy-status');
      var ok=function(){if(st)st.textContent='Copied. Paste it and fill in each line.'};
      var fail=function(){if(st)st.textContent='Could not copy automatically. Select the list and copy it by hand.'};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok,fail)}
      else{
        var ta=document.createElement('textarea');
        ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;opacity:0';
        document.body.appendChild(ta);ta.select();
        try{document.execCommand('copy')?ok():fail()}catch(e){fail()}
        document.body.removeChild(ta);
      }
    });
  }
})();
