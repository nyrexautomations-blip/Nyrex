/* Nyrex site script: mobile nav + the example chat on the home page. No tracking, no external calls. */
(function(){
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

  var phone=document.querySelector('.phone[data-script]');
  if(!phone) return;
  var box=phone.querySelector('.msgs');
  var script;
  try{script=JSON.parse(phone.getAttribute('data-script'))}catch(e){return}
  var stamp=phone.getAttribute('data-time')||'11:02 pm';
  var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  function add(who,text,animate){
    var d=document.createElement('div');
    d.className='m '+who+(animate?' pop':'');
    d.textContent=text;
    var t=document.createElement('time');
    t.textContent=stamp;
    d.appendChild(t);
    box.appendChild(d);
    while(box.scrollHeight>box.clientHeight+2&&box.children.length>1){box.removeChild(box.firstChild)}
    return d;
  }
  function typing(){
    var d=document.createElement('div');
    d.className='typing';
    d.innerHTML='<span></span><span></span><span></span>';
    box.appendChild(d);
    return d;
  }

  if(still){script.forEach(function(s){add(s[0],s[1],false)});return}

  var i=0;
  function next(){
    if(i>=script.length){
      setTimeout(function(){box.innerHTML='';i=0;next()},5000);
      return;
    }
    var s=script[i++];
    if(s[0]==='bot'){
      var t=typing();
      setTimeout(function(){t.remove();add('bot',s[1],true);setTimeout(next,1100)},900);
    }else{
      setTimeout(function(){add('me',s[1],true);setTimeout(next,700)},900);
    }
  }
  next();
})();
