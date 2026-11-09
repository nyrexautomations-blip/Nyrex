// Nyrex trial page - Cloudflare Worker (free plan).
// A shop owner types their own hours and prices and then chats with their own assistant on nyrexbot2.
// Binding needed: KV namespace NYREX (the same namespace nyrexbot2 uses). Optional variable: BOT_URL
// This Worker only writes a client_<id> entry that expires after 7 days. It never touches the live bot.

const DEFAULT_BOT = "https://nyrexbot2.nyrexautomations.workers.dev";
const SITE = "https://nyrex.pages.dev";
const CORS = {
  "access-control-allow-origin": SITE,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "vary": "origin",
};
const TTL = 7 * 86400;
const LIMITS = { name: 60, area: 60, hours: 300, services: 900, extra: 400 };

const TYPES = {
  gym:      { noun: "gym", head: "Membership plans and prices", collect: "the person's name, what they are looking for (membership, personal training or a trial) and a preferred day and time", med: false },
  clinic:   { noun: "clinic", head: "Doctors, services and fees", collect: "the patient's name, which doctor or service they need and a preferred day and time", med: true },
  dental:   { noun: "dental clinic", head: "Treatments and fees", collect: "the patient's name, the treatment they need and a preferred day and time", med: true },
  physio:   { noun: "physiotherapy clinic", head: "Services and fees", collect: "the patient's name, the problem or service they need and a preferred day and time", med: true },
  lab:      { noun: "diagnostic lab", head: "Tests, packages and prices", collect: "the person's name, which test or package, whether they want home collection, and a preferred day and time", med: true },
  coaching: { noun: "coaching class", head: "Courses, batches and fees", collect: "the student's name, the class, the exam or subject, and a parent's phone number", med: false },
  salon:    { noun: "salon", head: "Services and prices", collect: "the customer's name, the service and a preferred day and time", med: false },
  other:    { noun: "business", head: "Services and prices", collect: "the person's name, what they need and a preferred day and time", med: false },
};

const BOOKING = {
  walkin: "Walk-ins are welcome, but appointments are preferred.",
  appt: "Appointments are required.",
  walkonly: "Walk-ins only. No appointments are taken.",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname === "/create") {
      return new Response(null, { status: 204, headers: { ...CORS, "access-control-max-age": "86400" } });
    }
    if (request.method === "GET" && url.pathname === "/") return Response.redirect(SITE + "/trial.html", 302);
    if (request.method === "GET" && url.pathname === "/plain") return page();
    if (request.method === "POST" && url.pathname === "/create") return create(request, env);
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  },
};

// ---------- Limits (kept in memory, so they are approximate on the free plan) ----------

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (arr.length >= 4) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 2000) hits.clear();
  return false;
}

let today = { d: "", n: 0 };
function dayFull() {
  const d = new Date().toISOString().slice(0, 10);
  if (today.d !== d) today = { d, n: 0 };
  if (today.n >= 60) return true;
  today.n++;
  return false;
}

// ---------- Create a trial entry ----------

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  });
}

function clean(s, max) {
  return String(s == null ? "" : s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\[\[|\]\]/g, "")
    .slice(0, max);
}
function oneLine(s) { return s.replace(/\s+/g, " ").trim(); }
function lines(s, sep) {
  return s.split(/\n+/).map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean).join(sep);
}
function sentence(s) {
  s = oneLine(s);
  if (!s) return "";
  return /[.!?]$/.test(s) ? s : s + ".";
}

function hex(n) {
  const a = new Uint8Array(n / 2);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
}
function newId() {
  const a = new Uint8Array(14);
  crypto.getRandomValues(a);
  return "91" + Array.from(a, b => String(b % 10)).join("");
}

async function create(request, env) {
  let data;
  try { data = await request.json(); } catch { return json({ error: "Please fill in the form again." }, 400); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "Please fill in the form again." }, 400);
  if (data.website) return json({ ok: true, url: "/" });

  const name = oneLine(clean(data.name, LIMITS.name));
  const typeKey = Object.prototype.hasOwnProperty.call(TYPES, data.type) ? data.type : "other";
  const t = TYPES[typeKey];
  const area = oneLine(clean(data.area, LIMITS.area));
  const hours = lines(clean(data.hours, LIMITS.hours), "; ");
  const services = lines(clean(data.services, LIMITS.services), "; ");
  const extra = clean(data.extra, LIMITS.extra);
  const booking = Object.prototype.hasOwnProperty.call(BOOKING, data.booking) ? data.booking : "walkin";

  if (name.length < 2) return json({ error: "Please type the name of your business." }, 400);
  if (!hours && !services) return json({ error: "Please add your opening hours or your prices, so the assistant has something to answer with." }, 400);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (limited(ip)) return json({ error: "Too many tries from this phone. Please try again in an hour." }, 429);
  if (dayFull()) return json({ error: "Too many trials today. Please try again tomorrow." }, 429);

  const art = /^[aeiou]/i.test(t.noun) ? "an" : "a";
  const message = [
    name + " is " + art + " " + t.noun + (area ? " in " + area : "") + ".",
    hours ? sentence("Open " + hours) : "",
    services ? sentence(t.head + ": " + services) : "",
    BOOKING[booking],
    sentence("To book or enquire, collect " + t.collect),
    sentence(extra),
    t.med ? "Never give medical advice. For an emergency, tell the person to go to the nearest hospital." : "",
    "This is a short trial set up by the owner to try the Nyrex assistant.",
  ].filter(Boolean).join(" ");

  let id = "";
  for (let i = 0; i < 5 && !id; i++) {
    const c = newId();
    if (!(await env.NYREX.get("client_" + c))) id = c;
  }
  if (!id) return json({ error: "Something went wrong. Please try again." }, 500);

  const view = hex(24);
  const entry = {
    customer: name,
    timezone: "Asia/Kolkata",
    summary: false,
    message,
    view_token: view,
    widget_key: hex(20),
  };
  await env.NYREX.put("client_" + id, JSON.stringify(entry), { expirationTtl: TTL });

  const bot = String(env.BOT_URL || DEFAULT_BOT).replace(/\/+$/, "");
  return json({ ok: true, url: bot + "/widget-test?c=" + id + "&k=" + view });
}

// ---------- The page ----------

function page() {
  return new Response(PAGE, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
    },
  });
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Try the Nyrex assistant</title>
<style>
:root{--g9:#0b5a2d;--g8:#0f7a3d;--g6:#2e9d5c;--g2:#d6eadc;--g1:#eaf6ee;--g0:#f4fbf6;--ink:#10241a;--mut:#56705f;--bad:#8a3b2e}
*{box-sizing:border-box}
body{margin:0;background:var(--g0);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5}
header{background:linear-gradient(135deg,var(--g9),var(--g6));color:#fff;padding:26px 18px 58px}
.in{max-width:560px;margin:0 auto}
h1{margin:0 0 8px;font-size:26px;line-height:1.15}
header p{margin:0;opacity:.93;font-size:15px}
main{max-width:560px;margin:-38px auto 0;padding:0 14px 36px}
form{background:#fff;border:1px solid var(--g2);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:16px;box-shadow:0 8px 24px rgba(15,122,61,.08);position:relative}
label{font-size:13px;font-weight:600;color:var(--g9);display:block;margin-bottom:5px}
label small{font-weight:400;color:var(--mut)}
input,select,textarea{width:100%;font:inherit;font-size:16px;color:var(--ink);background:#f7fbf8;border:1px solid var(--g2);border-radius:12px;padding:12px 13px}
textarea{min-height:92px;resize:vertical;line-height:1.45}
input:focus,select:focus,textarea:focus{outline:2px solid var(--g6);outline-offset:1px;background:#fff}
button{border:0;background:var(--g8);color:#fff;font:inherit;font-size:17px;font-weight:650;padding:15px;border-radius:14px;cursor:pointer}
button:disabled{opacity:.6;cursor:default}
.err{color:var(--bad);font-size:14px;min-height:20px;margin:0}
.note{font-size:13px;color:var(--mut);text-align:center;margin:14px 6px 0}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
</style></head><body>
<header><div class="in">
<h1>Try the assistant with your own shop</h1>
<p>Type your timings and prices. In one minute you can chat with an assistant that already knows your business, the way your customers would.</p>
</div></header>
<main>
<form id="f" autocomplete="off">
<div><label for="name">Business name <small>(dukaan ka naam)</small></label>
<input id="name" name="name" type="text" maxlength="60" placeholder="As your customers say it" required></div>
<div><label for="type">What kind of business is it?</label>
<select id="type" name="type">
<option value="gym">Gym</option>
<option value="clinic">Clinic</option>
<option value="dental">Dental clinic</option>
<option value="physio">Physiotherapy clinic</option>
<option value="lab">Diagnostic lab</option>
<option value="coaching">Coaching class</option>
<option value="salon">Salon</option>
<option value="other">Something else</option>
</select></div>
<div><label for="area">Area <small>(optional)</small></label>
<input id="area" name="area" type="text" maxlength="60" placeholder="Vasai West"></div>
<div><label for="hours">Opening hours <small>(timing)</small></label>
<textarea id="hours" name="hours" maxlength="300" placeholder="Monday to Saturday 6am to 10pm&#10;Sunday closed"></textarea></div>
<div><label for="services">Services and prices <small>(rate, one per line)</small></label>
<textarea id="services" name="services" maxlength="900" placeholder="1 month Rs 1,500&#10;3 months Rs 4,000"></textarea></div>
<div><label for="booking">How do customers come to you?</label>
<select id="booking" name="booking">
<option value="walkin">Walk-ins welcome, appointment preferred</option>
<option value="appt">Appointment only</option>
<option value="walkonly">Walk-in only</option>
</select></div>
<div><label for="extra">Anything else customers ask? <small>(optional)</small></label>
<textarea id="extra" name="extra" maxlength="400" placeholder="Free trial, parking, offers, women's timing"></textarea></div>
<div class="hp" aria-hidden="true"><label for="website">Leave this empty</label><input id="website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
<p class="err" id="err" role="alert"></p>
<button id="go" type="submit">Start my assistant</button>
</form>
<p class="note">This is a short trial. Only people with your link can open it, and it is deleted automatically after 7 days. Nobody is charged anything.</p>
</main>
<script>
(function(){
var f=document.getElementById('f'),b=document.getElementById('go'),e=document.getElementById('err');
function reset(msg){e.textContent=msg;b.disabled=false;b.textContent='Start my assistant';}
f.addEventListener('submit',function(ev){
ev.preventDefault();
e.textContent='';
b.disabled=true;b.textContent='Setting up your assistant...';
var d={};
['name','type','area','hours','services','booking','extra','website'].forEach(function(k){d[k]=f.elements[k].value;});
fetch('/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)})
.then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
.then(function(o){
if(o.ok&&o.j&&o.j.url){location.href=o.j.url;return;}
reset((o.j&&o.j.error)||'Something went wrong. Please try again.');
})
.catch(function(){reset('Could not connect. Please check your internet and try again.');});
});
})();
</script>
</body></html>`;
