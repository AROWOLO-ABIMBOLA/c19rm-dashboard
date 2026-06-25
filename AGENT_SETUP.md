# C19RM dashboard — chat agent & waiting-list form setup

Two features are built into the dashboard. Both need one small configuration step
before they capture data / answer questions live.

---

## 1. AI chat agent ("Ask the evaluation")

**How it works.** The widget in the page sends each question to a small Netlify
Function you own. That function holds your Anthropic API key as a secret, retrieves
the most relevant passages from a bundled knowledge base, and asks Claude to answer
**only from those passages**, under the house rules (three PRs kept separate, no
monetary amounts, contribution-not-attribution, de-identified quotes, British
spelling). The answer and its sources come back to the widget.

**Model:** Claude Sonnet 4.6 (set in `netlify/functions/chat.js`, constant `MODEL`).
Swap to `claude-haiku-4-5-20251001` to cut cost if volume grows.

**Knowledge base:** `netlify/functions/kb.json` — 527 passages from the End-of-Project
Report, the 12-module evaluation, the methodology and the investment register.

### Deploy on Netlify
1. Put these in one folder / repo:
   - `C19RM_Dashboard_Landing.html`  (rename to `index.html` for the live site)
   - `C19RM_Overview.html`
   - `netlify.toml`
   - `netlify/functions/chat.js`
   - `netlify/functions/kb.json`
2. In **Netlify → Site settings → Environment variables**, add:
   `ANTHROPIC_API_KEY = sk-ant-...`  (your key — never put it in the HTML)
3. Deploy. The function is then live at `/.netlify/functions/chat`.
4. In the HTML, set the endpoint (top of the page script):
   `CONFIG.CHAT_ENDPOINT = "/.netlify/functions/chat";`
   (Left blank, the widget shows "goes live once deployed".)

### Good practice
- Set a monthly spend cap in the Anthropic console.
- The function caps questions at 1,000 characters and replies at ~600 tokens.
- For a busy public page, add IP rate-limiting or a Cloudflare Turnstile check.

### Refreshing the knowledge base
When the full EOP report or new documents arrive, rebuild `kb.json` (the indexer
chunks the sources and tags them by module) and redeploy. Nothing else changes.
Next planned additions: the full EOP report, and the qualitative evidence-bank
quotes (these live in embedded scripts and need a dedicated extractor).

---

## 2. Waiting-list form ("Download reports")

Clicking **Download reports** opens a short form (name, email, organisation, role,
country, audience, interests, consent). On submit it POSTs JSON to one endpoint.

Set it in the page script: `CONFIG.WAITLIST_ENDPOINT = "...";`

**Easiest (no backend):** create a form on Formspree / Getform / Basin and paste its
URL. Entries arrive in their dashboard with email alerts and CSV export.

**Owned data:** write a second Netlify Function (same pattern as `chat.js`) that
appends each submission to a Google Sheet, Airtable or your database.

Left blank, the form validates and confirms but only logs the entry (safe demo).

**Privacy (NDPR):** the modal already states the data is used only to notify people
and not shared. Add a named data controller / privacy link before going public.

---

## 3. Social sign-in on the waiting-list form

The form offers **Continue with Google / LinkedIn / Facebook**, then an email
fallback. One click pre-fills the verified name and email (LinkedIn can also give the
organisation), and the submission records `provider` and `verified`.

The three providers are not equal in effort:

- **Google — easiest, works from the page.** Create an OAuth client ID in Google
  Cloud (consent screen + "Sign in with Google"). Put it in
  `CONFIG.GOOGLE_CLIENT_ID`. No secret in the page. Your waitlist function should
  verify the returned ID token (Google tokeninfo) before trusting the email.
- **LinkedIn — needs a server step.** "Sign in with LinkedIn using OpenID Connect"
  uses an authorisation-code flow with a **client secret**, so a serverless function
  must exchange the code for tokens. Requires an approved LinkedIn developer app.
  Highest value for this audience (name, email, often employer).
- **Facebook — needs app review.** The JS SDK works, but a Facebook app with App
  Review is required to receive email, and it adds little for a government / partner
  audience. Optional.

### Recommended route
Use one **managed auth provider** to cover all three with a single integration and
no OAuth plumbing of your own: **Supabase Auth** (free, supports Google, LinkedIn and
Facebook) or **Auth0 / Clerk**. Point `CONFIG.AUTH_BASE` at the provider's redirect
(the LinkedIn/Facebook buttons already route to `${AUTH_BASE}/auth/<provider>`), and
on return the verified profile pre-fills the form. Google can also run directly via
`CONFIG.GOOGLE_CLIENT_ID` if you prefer the native One-Tap experience for Google.

### Privacy (NDPR)
Social login shares name, email and photo. Keep the consent checkbox, add a privacy
policy URL (each provider requires one), and name the data controller.

### What I need from you to wire it
- Google: your OAuth **client ID**.
- LinkedIn / Facebook: which managed provider you'll use (Supabase / Auth0 / Clerk)
  and its project URL — or the apps' client IDs if you self-host the OAuth function.

---

## 4. Confirmation email from the Jhpiego Evaluation Team

Built: `netlify/functions/waitlist.js` (sends via Gmail SMTP — no domain/DNS needed).
On each sign-up it (1) emails your team the lead, and (2) sends the person a branded
"You are on the waiting list" email **from c19rm.impactevaluation@gmail.com**, shown
as "Jhpiego Evaluation Team".

To go live:
1. On the Gmail account **c19rm.impactevaluation@gmail.com**, turn on **2-Step
   Verification** (Google account → Security).
2. Create a **16-character App Password** (Security → App passwords → app: Mail).
3. In Netlify → Environment variables, add:
   - `GMAIL_USER` = `c19rm.impactevaluation@gmail.com`
   - `GMAIL_APP_PASSWORD` = the 16-character app password
   - `WAITLIST_TEAM` = (optional) inbox for leads; defaults to `GMAIL_USER`
   - `GOOGLE_CLIENT_ID` = (optional) to verify Google sign-ins
4. The repo includes `package.json` (the function uses `nodemailer`); Netlify installs
   it automatically on deploy.

Note: free Gmail sends up to ~500 emails/day — ample for a waiting list. If volume
ever far exceeds that, switch to a verified domain on a service like Resend.

## SETUP CHECKLIST — what you configure, and what to send me

**A. Anthropic (chat agent)** — create an API key in the Anthropic console.
→ Put in Netlify env as `ANTHROPIC_API_KEY`. *Do not send it to me.*

**B. Gmail (emails)** — on c19rm.impactevaluation@gmail.com enable 2-Step
Verification and create an App Password.
→ Put `GMAIL_USER` and `GMAIL_APP_PASSWORD` in Netlify env. *Do not send the password to me.*

**C. Google sign-in** — Google Cloud Console → OAuth consent screen, then create an
OAuth **client ID** (type: Web). Add your Netlify site URL as an authorised
JavaScript origin. The client *secret* is not needed for this flow.
→ **Send me the Client ID** (it is public/front-end safe).

**D. LinkedIn / Facebook via Supabase** — create a Supabase project →
Authentication → Providers. For LinkedIn: create a LinkedIn developer app (the
"Sign In with LinkedIn using OpenID Connect" product), copy its Client ID + Secret
into Supabase, and paste Supabase's callback URL into the LinkedIn app. Same pattern
for Facebook (a Meta app + App Review to release email).
→ **Send me the Supabase Project URL and the anon (public) key.** The service-role
key and the provider secrets stay inside Supabase.

**Safe to send me (front-end public):** Google Client ID · Supabase Project URL ·
Supabase anon key.
**Never send (these live in Netlify/Supabase only):** Anthropic key · Gmail app password ·
Google client secret · LinkedIn/Facebook secrets · Supabase service-role key.

Once you send the three public values, I set them in the page's `CONFIG` and finish
the LinkedIn/Facebook wiring.
