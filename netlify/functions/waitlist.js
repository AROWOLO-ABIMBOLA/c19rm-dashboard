// C19RM waiting-list handler (Netlify Function)
// Appends each sign-up to a Google Sheet via an Apps Script web app. No email is sent.
// Set in Netlify (Site settings -> Environment variables):
//   SHEETS_WEBHOOK_URL    the Apps Script web-app deployment URL (ends in /exec)   [required]
//   SHEETS_SHARED_SECRET  optional token your Apps Script can check, to reject stray posts

exports.handler = async (event) => {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: H, body: JSON.stringify({ error: 'POST only' }) };

  try {
    const d = JSON.parse(event.body || '{}');
    if (!d.name || !d.email || !d.organisation)
      return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Missing required fields' }) };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email))
      return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Invalid email' }) };

    const url = process.env.SHEETS_WEBHOOK_URL;
    // Before the Sheet is wired up, accept the sign-up so the button still works, but flag it as unsaved.
    if (!url)
      return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, saved: false, note: 'Sheet not configured yet' }) };

    const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
    const row = {
      timestamp: new Date().toISOString(),
      name: cut(d.name, 200),
      email: cut(d.email, 200),
      organisation: cut(d.organisation, 200),
      role: cut(d.role, 200),
      country: cut(d.country, 120),
      audience: cut(d.audience, 120),
      interests: (Array.isArray(d.interests) ? d.interests : []).join(', ').slice(0, 300),
      message: cut(d.message, 2000),
      secret: process.env.SHEETS_SHARED_SECRET || ''
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
    const text = await r.text();
    let saved = r.ok;
    try { const j = JSON.parse(text); if (j && j.ok === false) saved = false; } catch (_) {}

    if (!saved)
      return { statusCode: 502, headers: H, body: JSON.stringify({ error: 'Could not save to the list. Please try again.' }) };

    return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, saved: true }) };
  } catch (e) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: String(e) }) };
  }
};
