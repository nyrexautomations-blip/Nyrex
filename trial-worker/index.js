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
  gym:      { label: "Gym", noun: "gym", head: "Membership plans and prices", collect: "the person's name, what they are looking for (membership, personal training or a trial) and a preferred day and time", med: false },
  clinic:   { label: "Clinic", noun: "clinic", head: "Doctors, services and fees", collect: "the patient's name, which doctor or service they need and a preferred day and time", med: true },
  dental:   { label: "Dental clinic", noun: "dental clinic", head: "Treatments and fees", collect: "the patient's name, the treatment they need and a preferred day and time", med: true },
  physio:   { label: "Physiotherapy clinic", noun: "physiotherapy clinic", head: "Services and fees", collect: "the patient's name, the problem or service they need and a preferred day and time", med: true },
  lab:      { label: "Diagnostic lab", noun: "diagnostic lab", head: "Tests, packages and prices", collect: "the person's name, which test or package, whether they want home collection, and a preferred day and time", med: true },
  coaching: { label: "Coaching class", noun: "coaching class", head: "Courses, batches and fees", collect: "the student's name, the class, the exam or subject, and a parent's phone number", med: false },
  salon:    { label: "Salon or spa", noun: "salon", head: "Services and prices", collect: "the customer's name, the service and a preferred day and time", med: false },
  other:    { label: "Other", noun: "business", head: "Services and prices", collect: "the person's name, what they need and a preferred day and time", med: false },
};

const BOOKING = {
  walkin: "Walk-ins are welcome, but appointments are preferred.",
  appt: "Appointments are required.",
  walkonly: "Walk-ins only. No appointments are taken.",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname === "/create") {
      return new Response(null, { status: 204, headers: { ...CORS, "access-control-max-age": "86400" } });
    }
    if (request.method === "GET" && url.pathname === "/") return Response.redirect(SITE + "/trial.html", 302);
    if (request.method === "GET" && url.pathname === "/plain") return page();
    if (request.method === "GET" && url.pathname === "/demo") return demo(url, env);
    if (request.method === "POST" && url.pathname === "/create") return create(request, env, ctx);
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

async function create(request, env, ctx) {
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
  const phoneDigits = String(data.phone == null ? "" : data.phone).replace(/[^\d]/g, "");
  const phone = phoneDigits.length >= 10 && phoneDigits.length <= 13 ? phoneDigits.slice(-10) : "";
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
    trial_type: t.label,
    trial_area: area,
    ...(phone ? { trial_phone: phone } : {}),
    timezone: "Asia/Kolkata",
    summary: false,
    message,
    view_token: view,
    widget_key: hex(20),
  };
  await env.NYREX.put("client_" + id, JSON.stringify(entry), { expirationTtl: TTL });

  const link = new URL(request.url).origin + "/demo?c=" + id + "&k=" + view;
  const job = notify(env, { name, type: t.label, area, phone, hours, services, link });
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(job); else await job;
  return json({ ok: true, url: link });
}


// ---------- Email the owner when someone makes a trial (needs the BREVO_API_KEY secret; skipped without it) ----------

async function notify(env, d) {
  if (!env.BREVO_API_KEY) return;
  const to = String(env.OWNER_EMAIL || "nyrexautomations@gmail.com");
  const lines = [
    "Business: " + d.name,
    "Type: " + d.type,
    "Area: " + (d.area || "Not supplied"),
    "Phone: " + (d.phone ? d.phone : "Not supplied"),
    "Hours typed: " + (d.hours || "none"),
    "Services typed: " + (d.services || "none"),
    "",
    "Their demo (valid for 7 days): " + d.link,
  ];
  if (d.phone) lines.push("Call or WhatsApp them: https://wa.me/91" + d.phone);
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: "Nyrex trial", email: "nyrexautomations@gmail.com" },
        to: [{ email: to, name: "Nyrex" }],
        subject: "Trial: " + d.name + " (" + d.type + ")" + (d.phone ? " - has phone" : ""),
        textContent: "Someone just tried the Nyrex demo.\n\n" + lines.join("\n"),
      }),
    });
  } catch (e) { console.log("trial notify failed", String(e)); }
}

// ---------- The demo page (what the owner sees after the form) ----------

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function safeEq(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function demo(url, env) {
  const c = url.searchParams.get("c") || "";
  const k = url.searchParams.get("k") || "";
  const gone = () => new Response("This demo link has expired or is not valid. Make a new one at https://nyrex.pages.dev/trial.html", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (!/^\d{5,30}$/.test(c)) return gone();
  let profile = null;
  try { profile = JSON.parse((await env.NYREX.get("client_" + c)) || "null"); } catch {}
  if (!profile || typeof profile.view_token !== "string" || profile.view_token.length < 16 || !safeEq(profile.view_token, k)) return gone();
  if (typeof profile.widget_key !== "string" || profile.widget_key.length < 12) return gone();
  const bot = String(env.BOT_URL || DEFAULT_BOT).replace(/\/+$/, "");
  const name = esc(profile.customer || "Your business");
  const initial = esc(String(profile.customer || "N").trim().charAt(0).toUpperCase() || "N");
  const q = new URLSearchParams();
  q.set("biz", String(profile.customer || "").slice(0, 60));
  if (profile.trial_type) q.set("type", String(profile.trial_type).slice(0, 40));
  if (profile.trial_area) q.set("city", String(profile.trial_area).slice(0, 60));
  const pilot = esc("https://nyrex.pages.dev/pilot.html?" + q.toString() + "#request");
  const html = DEMO_HTML
    .replaceAll("{{NAME}}", name)
    .replaceAll("{{INITIAL}}", initial)
    .replaceAll("{{C}}", esc(c))
    .replaceAll("{{KEY}}", esc(profile.widget_key))
    .replaceAll("{{BOT}}", esc(bot))
    .replaceAll("{{PILOT}}", pilot);
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
    },
  });
}

const DEMO_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#04261C">
<title>{{NAME}} - live assistant demo</title>
<style>
:root{--g50:#F3FAF6;--g100:#E3F2EA;--g200:#C9E6D8;--g600:#00A863;--g700:#007A48;--g800:#07382A;--g900:#04261C;--g950:#021A13;--mint:#3DFFB0;--ink:#10241a;--mut:#5b7266}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:"Public Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:#fff;line-height:1.55;-webkit-font-smoothing:antialiased}
.w{max-width:1080px;margin:0 auto;padding:0 20px}
.hero{background:var(--g900);color:#fff;position:relative;overflow:hidden;isolation:isolate}
.hero::before{content:"";position:absolute;z-index:-1;right:-12%;top:-30%;width:min(720px,90vw);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(61,255,176,.30),rgba(61,255,176,0) 66%)}
.hero::after{content:"";position:absolute;z-index:-1;left:-10%;bottom:-40%;width:min(520px,80vw);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(0,168,99,.35),rgba(0,168,99,0) 66%)}
.bar{display:flex;align-items:center;gap:12px;padding:18px 0}
.av{width:42px;height:42px;border-radius:12px;background:var(--g600);color:#fff;display:grid;place-items:center;font-weight:800;font-size:19px;flex:none}
.bar b{flex:1;min-width:0;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.live{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mint);border:1px solid rgba(61,255,176,.35);padding:7px 13px;border-radius:999px;white-space:nowrap}
.live i{width:8px;height:8px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 0 rgba(61,255,176,.6);animation:pl 2s infinite}
@keyframes pl{70%{box-shadow:0 0 0 9px rgba(61,255,176,0)}100%{box-shadow:0 0 0 0 rgba(61,255,176,0)}}
.hgrid{display:grid;gap:34px;padding:clamp(28px,6vw,72px) 0 clamp(44px,7vw,92px);align-items:center}
@media(min-width:900px){.hgrid{grid-template-columns:1.15fr .85fr}}
h1{margin:0;font-weight:800;letter-spacing:-.045em;line-height:1;font-size:clamp(2.3rem,6.4vw,4.6rem)}
h1 em{font-style:normal;color:var(--mint)}
.lead{margin:20px 0 0;font-size:clamp(1rem,2.2vw,1.2rem);color:#cfe6da;max-width:34ch}
.pointer{display:inline-flex;align-items:center;gap:10px;margin-top:28px;font-weight:700;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);padding:13px 20px;border-radius:999px}
.pointer svg{width:20px;height:20px;animation:nd 1.6s ease-in-out infinite}
@keyframes nd{50%{transform:translate(4px,4px)}}
.try{background:#fff;color:var(--ink);border-radius:22px;padding:24px;box-shadow:0 30px 60px -30px rgba(0,0,0,.6)}
.try h2{margin:0 0 4px;font-size:1.05rem;letter-spacing:-.01em}
.try p.s{margin:0 0 16px;color:var(--mut);font-size:.9rem}
.q{display:grid;gap:9px}
.q span{display:flex;align-items:center;gap:10px;background:var(--g50);border:1px solid var(--g200);border-radius:14px;padding:12px 14px;font-weight:600;font-size:.95rem;color:var(--g800)}
.hint{margin:16px 0 0;padding-top:14px;border-top:1px solid var(--g100);font-size:.85rem;color:var(--mut)}
.hint a{color:var(--g700);font-weight:700}
.q span::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--g600);flex:none}
.sec{padding:clamp(44px,7vw,84px) 0}
.sec h2.t{margin:0 0 8px;font-weight:800;letter-spacing:-.04em;font-size:clamp(1.7rem,4vw,2.6rem);line-height:1.05;max-width:20ch}
.sec .sub{margin:0 0 30px;color:var(--mut);max-width:52ch}
.cards{display:grid;gap:16px;grid-template-columns:1fr}
@media(min-width:760px){.cards{grid-template-columns:repeat(3,1fr)}}
.card{border:1px solid var(--g200);border-radius:20px;padding:24px;background:linear-gradient(180deg,var(--g50),#fff)}
.card .n{width:40px;height:40px;border-radius:50%;background:var(--g900);color:var(--mint);display:grid;place-items:center;font-weight:800;margin-bottom:14px}
.card h3{margin:0 0 6px;font-size:1.1rem;letter-spacing:-.01em}
.card p{margin:0;color:var(--mut);font-size:.95rem}
.cta{background:var(--g900);color:#fff;border-radius:28px;padding:clamp(28px,5vw,56px);display:grid;gap:22px;position:relative;overflow:hidden;isolation:isolate}
.cta::before{content:"";position:absolute;z-index:-1;right:-10%;top:-60%;width:480px;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(61,255,176,.28),rgba(61,255,176,0) 66%)}
.cta h2{margin:0;font-weight:800;letter-spacing:-.04em;line-height:1.05;font-size:clamp(1.7rem,4vw,2.7rem);max-width:18ch}
.cta p{margin:0;color:#cfe6da;max-width:46ch}
.row{display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;font-weight:700;text-decoration:none;padding:15px 26px;border-radius:12px;font-size:1rem;min-height:50px}
.btn.p{background:var(--g600);color:#fff}
.btn.p:hover{background:var(--mint);color:var(--g900)}
.btn.l{border:2px solid rgba(255,255,255,.35);color:#fff}
.btn.l:hover{border-color:var(--mint);color:var(--mint)}
.note{padding:28px 0 120px;text-align:center;color:var(--mut);font-size:.85rem}
.note a{color:var(--g700)}
@media(max-width:560px){.live{font-size:11px;padding:6px 10px}.try{padding:20px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style></head><body>
<header class="hero"><div class="w">
  <div class="bar"><div class="av">{{INITIAL}}</div><b>{{NAME}}</b><span class="live"><i></i>Live demo</span></div>
  <div class="hgrid">
    <div>
      <h1>{{NAME}}'s assistant is <em>live.</em></h1>
      <p class="lead">This is how your customers would be answered on WhatsApp, using only the details you typed.</p>
      <span class="pointer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7l10 10M17 8v9H8"/></svg>Chat is open at the bottom right</span>
    </div>
    <div class="try">
      <h2>Try asking it</h2>
      <p class="s">Type it, or tap a suggestion inside the chat.</p>
      <div class="q"><span>What are your timings?</span><span>How much does it cost?</span><span>Kal shaam ko aa sakta hoon?</span><span>Where are you located?</span></div>
      <p class="hint">It only knows what you typed. If it says it needs to check with the team, that detail was missing. <a href="https://nyrex.pages.dev/trial.html" rel="noreferrer">Add more details</a> and try again.</p>
    </div>
  </div>
</div></header>

<section class="sec"><div class="w">
  <h2 class="t">What your customers get</h2>
  <p class="sub">The same assistant, on your own WhatsApp number, from day one of the pilot.</p>
  <div class="cards">
    <div class="card"><div class="n">1</div><h3>Instant answers</h3><p>Timings, prices and questions answered in seconds, in English, Hindi or Hinglish. Voice notes too.</p></div>
    <div class="card"><div class="n">2</div><h3>Open at 11pm on Sunday</h3><p>Customers get a reply at any hour, and you wake up to their details instead of missed messages.</p></div>
    <div class="card"><div class="n">3</div><h3>Never guesses</h3><p>If it does not know something, it says so and passes it to you, so you stay in charge.</p></div>
  </div>
</div></section>

<section class="sec" style="padding-top:0"><div class="w">
  <div class="cta">
    <h2>Like it? Put it on your own number.</h2>
    <p>Free 14-day pilot. We set it up with you, you see every conversation, and there is no contract.</p>
    <div class="row"><a class="btn p" href="{{PILOT}}" rel="noreferrer">Start my free pilot</a><a class="btn l" href="https://nyrex.pages.dev/trial.html" rel="noreferrer">Try a different shop</a></div>
  </div>
  <p class="note">A short demo made from what you typed. It is deleted by itself after 7 days. Powered by <a href="https://nyrex.pages.dev/" rel="noreferrer">Nyrex</a>.</p>
</div></section>

<script>try{if(sessionStorage.getItem('nyrex_open_{{C}}')===null){sessionStorage.setItem('nyrex_open_{{C}}','1');}sessionStorage.setItem('nyrex_nudge_{{C}}','1');}catch(e){}</script>
<script src="{{BOT}}/widget.js" data-client="{{C}}" data-key="{{KEY}}" data-title="{{NAME}}" data-color="#00A863" data-nudge="off" defer></script>
</body></html>`;

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
