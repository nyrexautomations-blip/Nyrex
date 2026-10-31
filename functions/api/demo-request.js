const allowed = new Set(['biz', 'owner', 'type', 'city', 'contact', 'best_time', 'phone', 'asks', 'website']);

function plain(value, limit) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').trim().slice(0, limit);
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const ownOrigin = new URL(request.url).origin;
  if (origin && origin !== ownOrigin) return new Response('Forbidden', { status: 403 });

  let input;
  try { input = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!input || typeof input !== 'object' || JSON.stringify(input).length > 12000) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  // Quietly accept honeypot submissions without delivering spam.
  if (plain(input.website, 100)) return Response.json({ ok: true });
  for (const key of Object.keys(input)) if (!allowed.has(key)) delete input[key];

  const data = {
    biz: plain(input.biz, 100), owner: plain(input.owner, 100), type: plain(input.type, 80),
    city: plain(input.city, 120), contact: plain(input.contact, 40), best_time: plain(input.best_time, 100),
    phone: plain(input.phone, 40), asks: plain(input.asks, 1000)
  };
  if (!data.biz || !data.owner || !data.type || !data.contact) {
    return Response.json({ error: 'Please complete the required fields.' }, { status: 400 });
  }
  if (!env.BREVO_API_KEY) return Response.json({ error: 'Form delivery is not configured.' }, { status: 503 });

  const lines = [
    `Salon: ${data.biz}`, `Owner/manager: ${data.owner}`, `Business type: ${data.type}`,
    `Area/city: ${data.city || 'Not supplied'}`, `Contact number: ${data.contact}`,
    `Best time to call: ${data.best_time || 'Not supplied'}`,
    `WhatsApp number for compatibility check: ${data.phone || 'Not supplied'}`,
    `Common customer questions: ${data.asks || 'Not supplied'}`
  ];
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: { name: 'Nyrex website', email: 'nyrexautomations@gmail.com' },
      to: [{ email: 'nyrexautomations@gmail.com', name: 'Nyrex' }],
      subject: `Salon demo request: ${data.biz}`,
      textContent: `A new Nyrex salon demo request was submitted.\n\n${lines.join('\n')}\n\nThe person agreed to be contacted about this demo request. This is not marketing consent.`
    })
  });
  if (!response.ok) return Response.json({ error: 'Email delivery failed.' }, { status: 502 });
  return Response.json({ ok: true });
}
