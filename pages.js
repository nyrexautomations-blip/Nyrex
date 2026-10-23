/* Pilot checklist: tick items, see progress, copy the list as a message. Ticks stay in this browser only. */
(function(){
  var boxes=[].slice.call(document.querySelectorAll('.cl-list input[type=checkbox]'));
  if(!boxes.length) return;
  var KEY='nyrex-checklist';
  var fill=document.getElementById('cl-fill'),count=document.getElementById('cl-count'),status=document.getElementById('cl-status');
  var saved={};
  try{saved=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){}
  boxes.forEach(function(b){b.checked=!!saved[b.getAttribute('data-item')]});
  function update(){
    var n=boxes.filter(function(b){return b.checked}).length;
    fill.style.width=Math.round(n/boxes.length*100)+'%';
    count.innerHTML='<b>'+n+' of '+boxes.length+'</b> ready'+(n===boxes.length?'. You are all set.':'');
  }
  function persist(){
    var o={};boxes.forEach(function(b){if(b.checked)o[b.getAttribute('data-item')]=1});
    try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}
  }
  boxes.forEach(function(b){b.addEventListener('change',function(){update();persist()})});
  update();
  function say(m){status.textContent=m;setTimeout(function(){status.textContent=''},4000)}
  function label(b){return b.parentNode.querySelector('span').textContent}
  document.getElementById('cl-copy').addEventListener('click',function(){
    var ready=boxes.filter(function(b){return b.checked}).map(label);
    var todo=boxes.filter(function(b){return !b.checked}).map(label);
    var t='Hi Nyrex, I would like to start the free pilot.\n\nI have ready:\n'+(ready.length?ready.map(function(x){return '- '+x}).join('\n'):'- Nothing yet')+'\n\nStill to do:\n'+(todo.length?todo.map(function(x){return '- '+x}).join('\n'):'- Nothing, all done')+'\n';
    var ok=function(){say('Copied. Paste it into WhatsApp, Instagram or email.')};
    var fail=function(){
      var ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
      var done=false;try{done=document.execCommand('copy')}catch(e){}
      document.body.removeChild(ta);say(done?'Copied. Paste it into WhatsApp, Instagram or email.':'Could not copy. Please select and copy the list yourself.');
    };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok,fail);else fail();
  });
  document.getElementById('cl-reset').addEventListener('click',function(){boxes.forEach(function(b){b.checked=false});update();persist();say('Cleared.')});
})();
