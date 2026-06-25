// C19RM waiting-list handler (Netlify Function) — sends via the project's own Gmail.
// Set these env vars in Netlify (no domain/DNS setup needed):
//   GMAIL_USER          c19rm.impactevaluation@gmail.com
//   GMAIL_APP_PASSWORD  16-char Google App Password (account must have 2-Step Verification on)
//   WAITLIST_TEAM       (optional) inbox to receive each lead; defaults to GMAIL_USER
//   GOOGLE_CLIENT_ID    (optional) to verify Google sign-ins
const nodemailer = require('nodemailer');
const esc = s => String(s||'').replace(/[<>&]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

function transport(){
  return nodemailer.createTransport({ service:'gmail',
    auth:{ user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
}
const FROM = () => `"Jhpiego Evaluation Team" <${process.env.GMAIL_USER}>`;

function confirmationHTML(name, interests){
  const first = (name||'').trim().split(/\s+/)[0] || 'there';
  const list = (interests&&interests.length?interests:['the evaluation outputs'])
    .map(i=>`<li style="margin:2px 0">${esc(i)}</li>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f6f2e9;font-family:Helvetica,Arial,sans-serif;color:#26332e">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#0E2E27;border-radius:14px 14px 0 0;padding:20px 24px;color:#fff">
      <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#C39A3F;font-weight:700">Nigeria C19RM Impact Evaluation</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">You are on the waiting list</div>
    </div>
    <div style="background:#fffdf7;border:1px solid #e7e0cf;border-top:none;border-radius:0 0 14px 14px;padding:24px">
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Dear ${esc(first)},</p>
      <p style="font-size:14.5px;line-height:1.65;margin:0 0 14px">Thank you for your interest in the impact evaluation of the Global Fund COVID-19 Response Mechanism (C19RM) in Nigeria, prepared for the Government of Nigeria and the Global Fund.</p>
      <p style="font-size:14.5px;line-height:1.65;margin:0 0 8px">You are now on the waiting list. We will email you the moment the following are ready to download:</p>
      <ul style="font-size:14.5px;line-height:1.6;margin:0 0 14px;padding-left:20px">${list}</ul>
      <p style="font-size:14.5px;line-height:1.65;margin:0 0 16px">In the meantime, you are welcome to keep exploring the interactive dashboard, where you can look across the investment by state and by module.</p>
      <p style="font-size:14.5px;line-height:1.65;margin:0 0 4px">Warm regards,</p>
      <p style="font-size:14.5px;line-height:1.5;margin:0;font-weight:700">Jhpiego Evaluation Team</p>
      <p style="font-size:13px;line-height:1.5;margin:2px 0 0;color:#6f7a72">Nigeria C19RM Impact Evaluation</p>
    </div>
    <p style="font-size:11px;color:#9aa49d;text-align:center;margin:14px 0 0;line-height:1.5">You received this email because you asked to be notified about the C19RM evaluation outputs. Your details are used only for this purpose and are not shared with third parties.</p>
  </div></body></html>`;
}

exports.handler = async (event) => {
  const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS') return {statusCode:204,headers:H,body:''};
  if(event.httpMethod!=='POST') return {statusCode:405,headers:H,body:JSON.stringify({error:'POST only'})};
  try{
    const d = JSON.parse(event.body||'{}');
    if(!d.name||!d.email||!d.organisation) return {statusCode:400,headers:H,body:JSON.stringify({error:'Missing required fields'})};
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return {statusCode:400,headers:H,body:JSON.stringify({error:'Invalid email'})};

    let verified = !!d.verified;
    if(d.provider==='google' && d.token && process.env.GOOGLE_CLIENT_ID){
      try{ const v=await (await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(d.token))).json();
        verified = v.aud===process.env.GOOGLE_CLIENT_ID && (v.email||'').toLowerCase()===d.email.toLowerCase(); }catch(e){ verified=false; }
    }

    if(!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)
      return {statusCode:200,headers:H,body:JSON.stringify({ok:true,emailed:false,note:'Gmail not configured yet'})};

    const tx = transport();
    const team = process.env.WAITLIST_TEAM || process.env.GMAIL_USER;

    // 1) notify the team (your record of the lead)
    const rows=Object.entries({Name:d.name,Email:d.email,Organisation:d.organisation,Role:d.role,Country:d.country,Audience:d.audience,Interests:(d.interests||[]).join(', '),Provider:d.provider,Verified:verified,Message:d.message})
      .filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>`<tr><td style="padding:3px 10px 3px 0;color:#6f7a72">${k}</td><td style="padding:3px 0"><b>${esc(v)}</b></td></tr>`).join('');
    await tx.sendMail({from:FROM(),to:team,replyTo:d.email,
      subject:`New waiting-list sign-up: ${d.name} (${d.organisation})`,
      html:`<div style="font-family:Helvetica,Arial,sans-serif"><h3>New C19RM waiting-list sign-up</h3><table>${rows}</table></div>`});

    // 2) branded confirmation to the person
    await tx.sendMail({from:FROM(),to:d.email,replyTo:team,
      subject:'You are on the C19RM evaluation reports waiting list',
      html:confirmationHTML(d.name, d.interests)});

    return {statusCode:200,headers:H,body:JSON.stringify({ok:true,emailed:true,verified})};
  }catch(e){ return {statusCode:500,headers:H,body:JSON.stringify({error:String(e)})}; }
};
