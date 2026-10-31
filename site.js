/* Nyrex site script: nav, optional Google sign-in, scroll motion, example chats, FAQ search, pilot form. No tracking. */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* mobile nav: toggles, closes on link, Escape, outside click, or when the window grows */
  var burger=document.querySelector('.burger');
  var nav=document.getElementById('nav');
  function closeNav(){if(nav&&burger){nav.classList.remove('open');burger.setAttribute('aria-expanded','false')}}
  if(burger&&nav){
    burger.addEventListener('click',function(){
      var open=nav.classList.toggle('open');
      burger.setAttribute('aria-expanded',open?'true':'false');
    });
    nav.addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('a')) closeNav();
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&nav.classList.contains('open')){closeNav();burger.focus()}});
    document.addEventListener('click',function(e){if(nav.classList.contains('open')&&!nav.contains(e.target)&&!burger.contains(e.target)) closeNav()});
    window.addEventListener('resize',function(){if(window.innerWidth>980) closeNav()});
  }

  /* Sign in with Google (optional). Paste an OAuth "Web application" client ID below to switch it on;
     until then the button stays hidden. Google's script is only loaded when someone uses the button.
     The name, email and photo stay in this browser (localStorage) and are never sent to Nyrex servers. */
  var GOOGLE_CLIENT_ID='';
  var acct=document.getElementById('acct');
  var USER_KEY='nyrex-user';
  var gUser=null;
  function readUser(){try{var u=JSON.parse(localStorage.getItem(USER_KEY));return u&&u.email?u:null}catch(e){return null}}
  function saveUser(u){try{if(u)localStorage.setItem(USER_KEY,JSON.stringify(u));else localStorage.removeItem(USER_KEY)}catch(e){}}
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
  function avatar(u,size){
    var a=el('span','av');
    var letter=((u.name||u.email||'?').trim().charAt(0)||'?').toUpperCase();
    if(u.picture&&/^https:\/\//.test(u.picture)){
      var img=new Image();img.alt='';img.referrerPolicy='no-referrer';img.src=u.picture;
      img.onerror=function(){a.textContent=letter;if(img.parentNode)img.parentNode.removeChild(img)};
      a.appendChild(img);
    }else a.textContent=letter;
    return a;
  }
  var gScript=null;
  function loadGoogle(){
    if(window.google&&google.accounts&&google.accounts.oauth2) return Promise.resolve();
    if(gScript) return gScript;
    gScript=new Promise(function(res,rej){
      var s=document.createElement('script');
      s.src='https://accounts.google.com/gsi/client';s.async=true;
      s.onload=res;s.onerror=function(){gScript=null;rej(new Error('load'))};
      document.head.appendChild(s);
    });
    return gScript;
  }
  function note(msg){
    var old=acct.querySelector('.anote');if(old)old.remove();
    var n=el('div','anote',msg);n.setAttribute('role','status');acct.appendChild(n);
    setTimeout(function(){if(n.parentNode)n.remove()},5000);
  }
  function startSignIn(btn){
    btn.disabled=true;
    var done=function(){btn.disabled=false};
    loadGoogle().then(function(){
      var tc=google.accounts.oauth2.initTokenClient({
        client_id:GOOGLE_CLIENT_ID,
        scope:'openid profile email',
        callback:function(r){
          if(!r||r.error||!r.access_token){done();return}
          fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+r.access_token}})
            .then(function(x){return x.json()})
            .then(function(p){
              if(!p||!p.email) throw new Error('profile');
              gUser={name:p.name||p.email,first:p.given_name||(p.name||p.email).split(' ')[0],email:p.email,picture:p.picture||''};
              saveUser(gUser);window.nyrexUser=gUser;renderAcct();
            })
            .catch(function(){done();note('Could not read your Google profile. Please try again.')});
        },
        error_callback:function(){done()}
      });
      tc.requestAccessToken({prompt:''});
    }).catch(function(){done();note('Could not reach Google. Check your connection and try again.')});
  }
  function renderAcct(){
    if(!acct) return;
    acct.textContent='';
    if(!gUser){
      var b=el('button','gbtn');b.type='button';
      b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7-7.27 2.09 0 3.71.89 4.76 1.85l2.05-2.05C16.97 2.97 14.74 2 12 2 6.48 2 2.4 6.48 2.4 12s4.04 10 9.6 10c5.01 0 8.6-3.54 8.6-8.5 0-.54-.05-.9-.15-1.4z"/></svg><span>Sign in</span>';
      b.setAttribute('aria-label','Sign in with Google');
      var warm=function(){loadGoogle().catch(function(){})};
      b.addEventListener('pointerenter',warm,{once:true});b.addEventListener('focus',warm,{once:true});b.addEventListener('touchstart',warm,{once:true,passive:true});
      b.addEventListener('click',function(){startSignIn(b)});
      acct.appendChild(b);
      return;
    }
    var t=el('button','avbtn');t.type='button';t.setAttribute('aria-haspopup','true');t.setAttribute('aria-expanded','false');
    t.setAttribute('aria-label','Account menu for '+gUser.name);
    t.appendChild(avatar(gUser));
    t.appendChild(el('span','nm',gUser.first));
    t.insertAdjacentHTML('beforeend','<svg class="chev" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    var m=el('div','amenu');m.hidden=true;
    var who=el('div','who');who.appendChild(avatar(gUser));
    var wt=el('div');wt.appendChild(el('b',null,gUser.name));wt.appendChild(el('span',null,gUser.email));who.appendChild(wt);
    m.appendChild(who);
    var pl=el('a',null,'Request a free pilot');pl.href='/pilot.html';m.appendChild(pl);
    var so=el('button',null,'Sign out');so.type='button';
    so.addEventListener('click',function(){gUser=null;window.nyrexUser=null;saveUser(null);renderAcct()});
    m.appendChild(so);
    t.addEventListener('click',function(e){e.stopPropagation();var o=m.hidden;m.hidden=!o;t.setAttribute('aria-expanded',o?'true':'false')});
    m.addEventListener('click',function(e){e.stopPropagation()});
    document.addEventListener('click',function(){if(!m.hidden){m.hidden=true;t.setAttribute('aria-expanded','false')}});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!m.hidden){m.hidden=true;t.setAttribute('aria-expanded','false');t.focus()}});
    acct.appendChild(t);acct.appendChild(m);
  }
  if(acct&&GOOGLE_CLIENT_ID){
    gUser=readUser();window.nyrexUser=gUser;
    acct.hidden=false;renderAcct();
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
      if(window.nyrexUser) body+='\nContact (signed in with Google): '+window.nyrexUser.name+' <'+window.nyrexUser.email+'>\n';
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
      srTimer=setTimeout(function(){rSr.textContent='Your estimate: about \u20B9'+inr.format(value)+' in potential monthly sales value, based on '+inr.format(chats)+' unanswered chats and '+inr.format(cust)+' potential customers.'},600);
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

  /* try it with your own business: a rule-based preview built from the visitor's answers */
  var tf=document.getElementById('try-form');
  if(tf){
    var tName=document.getElementById('t-name'),tSvc=document.getElementById('t-service'),tPrice=document.getElementById('t-price'),tOpen=document.getElementById('t-open'),tClose=document.getElementById('t-close'),tOff=document.getElementById('t-off'),tMsgs=document.getElementById('t-msgs');
    var fmt=function(h){var s=h<12?'am':'pm',x=h%12||12;return x+' '+s};
    for(var h=6;h<=23;h++){
      [tOpen,tClose].forEach(function(sel){var o=document.createElement('option');o.value=h;o.textContent=fmt(h);sel.appendChild(o)});
    }
    tOpen.value='10';tClose.value='19';
    var clean=function(v,d){v=(v||'').replace(/[<>]/g,'').trim();return v||d};
    var tbusy=null;
    var say=function(who,text){var d=document.createElement('div');d.className='m '+who+' pop';d.textContent=text;var t=document.createElement('time');t.textContent='now';d.appendChild(t);tMsgs.appendChild(d);tMsgs.scrollTop=tMsgs.scrollHeight;return d};
    var reply=function(q){
      var name=clean(tName.value,'our business'),svc=clean(tSvc.value,'this service').toLowerCase(),pr=(tPrice.value||'').replace(/[^\d]/g,''),off=tOff.value;
      var hrs=fmt(+tOpen.value)+' to '+fmt(+tClose.value),days=off?'every day except '+off:'every day';
      if(q==='hours') return ['Are you open?','Hi! Welcome to '+name+'. We\'re open '+days+', '+hrs+'. Anything I can help you with?'];
      if(q==='off') return off?['Are you open on '+off+'?',off+' is our day off. We\'re open '+hrs+' on the other days. Shall I note a booking for another day?']:['Are you open on Sunday?','Yes, we\'re open every day, '+hrs+'. Shall I note a booking for you?'];
      if(q==='service') return ['Do you do '+svc+'?','Yes, we do '+svc+'. Would you like to book it? I just need your name, the day and the time.'];
      if(q==='price') return ['How much is '+svc+'?',pr?'Our '+svc+' is ₹'+Number(pr).toLocaleString('en-IN')+'. Would you like to book it?':'I don\'t have a price I can quote for '+svc+'. Our team will message you the exact price shortly. Anything else I can note down?'];
      if(q==='book') return ['I want to book '+svc,'Sure! Which day and time suit you, and may I have your name? Our team will confirm the slot.'];
      return ['Can I talk to a person?','Of course. I\'ve told the team at '+name+' and someone will message you shortly.'];
    };
    var refresh=function(){var n=clean(tName.value,'Your business');document.getElementById('t-title').textContent=n;document.getElementById('t-av').textContent=n.charAt(0).toUpperCase()};
    [tName,tSvc,tPrice,tOpen,tClose,tOff].forEach(function(el){el.addEventListener('input',refresh);el.addEventListener('change',refresh)});
    Array.prototype.forEach.call(tf.querySelectorAll('.t-chips button'),function(b){
      b.addEventListener('click',function(){
        if(tbusy)clearTimeout(tbusy);
        var r=reply(b.getAttribute('data-q'));
        while(tMsgs.children.length>6)tMsgs.removeChild(tMsgs.firstChild);
        if(window.innerWidth<=860){var ph=tMsgs.closest('.phone'),rc=ph.getBoundingClientRect();if(rc.top<80||rc.bottom>window.innerHeight)ph.scrollIntoView({block:'center',behavior:reduce?'auto':'smooth'})}
        say('me',r[0]);
        var tp=document.createElement('div');tp.className='typing';tp.innerHTML='<span></span><span></span><span></span>';tMsgs.appendChild(tp);
        tbusy=setTimeout(function(){tp.remove();say('bot',r[1])},reduce?0:800);
      });
    });
    refresh();
  }

  /* back to top, WhatsApp share, pilot form draft */
  var tt=document.querySelector('.totop');
  if(tt){
    tt.addEventListener('click',function(){window.scrollTo({top:0,behavior:reduce?'auto':'smooth'})});
    var tick=function(){tt.classList.toggle('show',(window.scrollY||0)>900)};
    window.addEventListener('scroll',tick,{passive:true});tick();
  }
  var sh=document.getElementById('share-wa');
  if(sh){sh.href='https://wa.me/?text='+encodeURIComponent('Nyrex answers your WhatsApp customers in seconds, any hour. Free 14-day pilot: https://nyrex.pages.dev/');sh.target='_blank'}
  var pf=document.getElementById('pilot-form');
  if(pf){
    var KEY='nyrex-pilot-draft';
    try{
      var saved=JSON.parse(localStorage.getItem(KEY)||'{}');
      Array.prototype.forEach.call(pf.elements,function(el){if(el.name&&saved[el.name]&&!el.value)el.value=saved[el.name]});
      pf.addEventListener('input',function(){
        var o={};Array.prototype.forEach.call(pf.elements,function(el){if(el.name&&el.value)o[el.name]=el.value});
        try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}
      });
    }catch(e){}
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

/* the embedded ad plays only while it is on screen */
(function(){
  var f=document.querySelector('.adframe iframe');
  if(!f||!('IntersectionObserver' in window)) return;
  var vis=false;
  function send(){try{f.contentWindow.postMessage({type:'nyrex-ad',visible:vis},location.origin)}catch(e){}}
  new IntersectionObserver(function(en){vis=en[0].isIntersecting&&en[0].intersectionRatio>=0.35;send()},{threshold:[0,.35,.6]}).observe(f);
  f.addEventListener('load',send);
})();

/* motion layer: headline words, card spotlight, hero tilt, magnetic buttons */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine=window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(reduce) return;

  /* headline: words rise one after another */
  var h1=document.querySelector('.board-hero h1,.pagehead h1');
  if(h1&&!h1.querySelector('.w')){
    var words=h1.textContent.trim().split(/\s+/);
    h1.setAttribute('aria-label',h1.textContent.trim());
    h1.classList.add('split');
    h1.textContent='';
    words.forEach(function(w,i){
      var s=document.createElement('span');
      s.className='w';s.setAttribute('aria-hidden','true');s.style.setProperty('--i',i);s.textContent=w;
      h1.appendChild(s);
      if(i<words.length-1)h1.appendChild(document.createTextNode(' '));
    });
  }
  if(!fine) return;

  /* feature cards: soft light follows the cursor */
  Array.prototype.forEach.call(document.querySelectorAll('.fgrid li'),function(li){
    li.addEventListener('pointermove',function(e){
      var r=li.getBoundingClientRect();
      li.style.setProperty('--mx',(e.clientX-r.left)+'px');
      li.style.setProperty('--my',(e.clientY-r.top)+'px');
    });
  });

  /* hero phone: gentle tilt toward the pointer */
  var hero=document.querySelector('.board-hero'),ph=document.querySelector('.hero-visual .phone');
  if(hero&&ph){
    hero.addEventListener('pointermove',function(e){
      var r=hero.getBoundingClientRect();
      var x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      ph.style.transform='perspective(900px) rotateY('+(x*8).toFixed(2)+'deg) rotateX('+(-y*6).toFixed(2)+'deg)';
    });
    hero.addEventListener('pointerleave',function(){ph.style.transform=''});
  }

  /* primary buttons lean slightly toward the pointer */
  Array.prototype.forEach.call(document.querySelectorAll('.board-hero .btn,.cta-band .btn,.pagehead .btn'),function(b){
    b.classList.add('mag');
    b.addEventListener('pointermove',function(e){
      var r=b.getBoundingClientRect();
      b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.12).toFixed(1)+'px,'+((e.clientY-r.top-r.height/2)*.2).toFixed(1)+'px)';
    });
    b.addEventListener('pointerleave',function(){b.style.transform=''});
  });
})();

/* pilot agreement: print and copy */
(function(){
  var pr=document.getElementById('agr-print'),cp=document.getElementById('agr-copy'),st=document.getElementById('agr-status');
  if(pr)pr.addEventListener('click',function(){window.print()});
  if(cp)cp.addEventListener('click',function(){
    var el=document.getElementById('agr-text');
    var text='Nyrex Pilot Agreement\n\n'+el.innerText.replace(/\n{3,}/g,'\n\n').trim()+'\n';
    var ok=function(){if(st)st.textContent='Copied. You can paste it into WhatsApp or an email.'};
    var fail=function(){if(st)st.textContent='Could not copy automatically. Select the text and copy it by hand.'};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok,fail)}
    else{var ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')?ok():fail()}catch(e){fail()}document.body.removeChild(ta)}
  });
})();

/* pilot agreement: print, copy as text */
(function(){
  var pr=document.getElementById('agr-print'),cp=document.getElementById('agr-copy'),st=document.getElementById('agr-status');
  if(pr)pr.addEventListener('click',function(){window.print()});
  if(cp)cp.addEventListener('click',function(){
    var root=document.querySelector('.agreement'),out=[];
    Array.prototype.forEach.call(root.children,function(el){
      if(el.classList.contains('no-print'))return;
      if(el.tagName==='TABLE'){Array.prototype.forEach.call(el.rows,function(r){out.push(r.cells[0].textContent.trim()+': ____________________')})}
      else if(el.classList.contains('agr-sign')){out.push('For the business: ____________________  Date: __________');out.push('For Nyrex: ____________________  Date: __________')}
      else if(el.tagName==='UL'){Array.prototype.forEach.call(el.children,function(li){out.push('- '+li.textContent.trim())})}
      else out.push(el.textContent.trim());
    });
    var text=out.join('\n\n');
    var ok=function(){if(st)st.textContent='Copied.'},fail=function(){if(st)st.textContent='Could not copy. Use Print or the PDF instead.'};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(ok,fail);else fail();
  });
})();
