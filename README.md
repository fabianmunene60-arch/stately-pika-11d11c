# StudyBuddy Global — upgraded website package

A redesigned, responsive StudyBuddy landing page/PWA for university, high-school and junior-secondary learners. Includes an AI chat interface, Supabase sign-up/login, a Netlify OpenAI function, KSh 50 / 7-day Paystack checkout, installation prompt, HopeBridge donation information, and draft Privacy/Terms pages.

## What has been upgraded
- Stronger purple/blue/gold identity, modern typography, mobile-first layout and generated student photography.
- Live AI chat interface connected to `/.netlify/functions/ai-chat` after credentials are configured.
- Daily AI fair-use limits: 5 requests for free accounts and 60 for active Premium accounts. This is a starter limit and can be adjusted.
- Premium payment initialization and server-side Paystack verification. KSh 50 is charged as 5,000 KES subunits and grants 7 days. Renewal is manual, not automatic.
- Installable PWA manifest, 192px/512px icons, service worker and install prompt. It is not automatically published in Google Play or Apple's App Store.
- HopeBridge section with a donation-intent form that opens WhatsApp and a copyable Pochi La Biashara number. It does not itself collect money.
- Draft Privacy Policy and Terms pages. They must be reviewed and completed before public launch, especially for younger users.

## 1. Supabase setup
1. Create/open a project at https://supabase.com.
2. In Authentication → Providers, enable Email. Set the Site URL and redirect URLs to your Netlify HTTPS domain.
3. In SQL Editor, run `supabase/schema.sql`.
4. In `config.js`, replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the Project URL and anon/public key.
5. Keep the service-role key private; put it only in Netlify environment variables.

## 2. Netlify environment variables
Add these under Project configuration → Environment variables:
- `OPENAI_API_KEY` — private OpenAI API key
- `OPENAI_MODEL` — a model enabled for your API account (default in code: `gpt-4o-mini`)
- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — private service-role key
- `PAYSTACK_SECRET_KEY` — Paystack test secret first, then live secret after approval
- `SITE_URL` — exact deployed HTTPS site URL, e.g. your Netlify site URL

Never paste the OpenAI or Paystack secret key into HTML, `app.js`, `config.js`, GitHub, screenshots or public chat. OpenAI API usage is billed separately from a ChatGPT subscription; set a budget/spend limit in the OpenAI platform.

## 3. Paystack setup
1. Finish the required Paystack account verification and activate the relevant payment channels.
2. Test with Paystack test keys first.
3. Set `PAYSTACK_SECRET_KEY` in Netlify to the test secret, deploy, and test the complete checkout/verification flow.
4. Only after Paystack approves the account and you have tested, replace it with the live secret key and redeploy.
5. In Paystack dashboard webhook settings, register `https://YOUR-SITE/.netlify/functions/paystack-webhook` so successful payments can be confirmed even if the student closes the checkout page. Keep the callback verification enabled as well.
5. The code currently initializes KES 50 and checks KES 50 at verification. Check your Paystack dashboard to confirm M-Pesa/mobile money is enabled for your account.

## 4. Deploy
1. Upload the extracted folder to a GitHub repository.
2. In Netlify choose Add new project → Import an existing project and connect the repository.
3. Build command: leave blank. Publish directory: `.`.
4. Add all environment variables and deploy.
5. After any change to environment variables, trigger a fresh deploy.

## 5. Test before sharing publicly
- Register and confirm an email account.
- Log in and send an AI question. Check the daily free allowance.
- Complete a Paystack test payment and confirm Premium activates for 7 days.
- Try to verify the same Paystack reference twice; it must not add another week.
- Test on Android Chrome and iPhone Safari. On iPhone use Share → Add to Home Screen.
- Test donation form: it opens WhatsApp with a draft message; the user must separately verify recipient details and send funds through M-PESA.

## Important launch cautions
- This is a deployable starter, not proof that any third-party service is configured or live. Do not advertise AI or payments as operational until you have tested them on the deployed site.
- The AI fair-use limit is 5 questions/day free and 60/day Premium in the starter function. Monitor OpenAI usage and change limits if necessary.
- The donation form is an intent/contact form, not a donation payment processor. Confirm HopeBridge's legal status, governance, recipient account ownership and financial reporting before asking the public for funds. The page clearly states that registration/programmes are in development.
- The Privacy Policy and Terms are drafts, not legal advice. Complete them with the operator's legal identity, retention details, refund policy, safeguarding/guardian consent and applicable Kenyan data-protection obligations before taking student registrations, particularly from minors.
- The PWA can be installed from the website over HTTPS. It is not a native Play Store/App Store app.

## Supplied support details
- Email: fabianmunene60@gmail.com
- WhatsApp: +254 796 875 061
- HopeBridge Pochi La Biashara: 0713974590 (provided by site owner; confirm recipient identity before public use)
