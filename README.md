# StudyBuddy — Dual AI + Student Accounts + Support Pages

This build includes a StudyBuddy learning interface, server-side OpenAI/Claude gateway, student registration and login, saved AI chat history, and support pages for StudyBuddy and HopeBridge Africa Foundation.

## Important: this is a Node.js application

Deploy the **entire project folder** to a Node.js host that supports Express and persistent disk storage. A static-only Netlify site cannot run `server.js` or the `/api/*` endpoints by itself. If using Netlify, the backend must first be migrated to Netlify Functions or hosted separately and the frontend configured to call that backend.

## Install and run

1. Install Node.js 18.17 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add at least one valid AI provider key to `.env` (OpenAI or Anthropic). Never put keys in `public/` or commit `.env`.
5. Run `npm start`.
6. Open `http://localhost:3000`.
7. Check `/api/health` and `/api/ai/status`.

## AI configuration

- `OPENAI_API_KEY` and `OPENAI_MODEL` configure OpenAI. The default model is `gpt-4.1-mini`; change it to a model enabled for your API account if necessary.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` configure Claude. The default is `claude-haiku-4-5-20251001`; change it to a model enabled for your account if necessary.
- `AI_DEFAULT_PROVIDER=openai` selects the first-choice provider in Automatic mode.
- `AI_FALLBACK_ENABLED=true` tries the other configured provider if the first fails.
- AI requests are made by the server. Provider secrets are never sent to the browser.
- AI will remain unavailable until at least one valid API key is configured and that account has API access/billing enabled. A ChatGPT subscription is not the same as API billing.

## Student accounts

- `POST /api/auth/register` creates an account.
- `POST /api/auth/login` signs in.
- `GET /api/auth/me` returns the signed-in profile and saved chat.
- `POST /api/auth/chat` saves the user's conversation.
- `POST /api/auth/logout` ends the session.

Passwords are stored as salted scrypt hashes, not plain text. Sessions use an HttpOnly, SameSite=Lax cookie and expire after 30 days. Email verification and password-reset workflows are not included yet.

**Persistence is essential:** accounts and sessions are stored in `accounts.json` by default. On a production host, set `ACCOUNT_FILE` to a path on a persistent disk. If the host has ephemeral storage, accounts may be lost on redeploy/restart. Protect backups because the file contains personal data and password hashes.

## Payments and donations

- Paystack checkout is still dependent on server-side Paystack credentials and is not live merely because the UI exists. Keep test keys until end-to-end tests pass.
- M-Pesa PayBill details are displayed for voluntary StudyBuddy and HopeBridge support. These are **manual transfers only**; this build does not connect to Safaricom Daraja, automatically verify M-Pesa payments, issue receipts, or unlock assignment purchases from M-Pesa.
- Before accepting public donations, confirm that the PayBill and account number are authorized for the intended recipient and that HopeBridge's registration/governance disclosures are accurate. Ask donors to verify the recipient name shown in M-Pesa before confirming.
- For automated M-Pesa checkout, integrate Safaricom Daraja using authorized credentials, callback endpoints, transaction reconciliation, and a secure database.

## Production checklist

- Use HTTPS and a Node host with persistent disk.
- Set `NODE_ENV=production`, `ACCOUNT_FILE`, and `DATA_FILE` to persistent paths.
- Add request rate limiting, email verification, password reset, CSRF/origin protections, monitoring and backups before broad public launch.
- Move account/payment storage from JSON files to a managed database such as PostgreSQL/Supabase before scaling across multiple server instances.
- Publish a privacy notice and retention policy.
- Set AI provider spending limits and monitor usage.
- Test registration, login, logout, chat persistence, AI failure handling, payment callbacks and mobile installation before launch.

## API endpoints

- `GET /api/health`
- `GET /api/ai/status`
- `POST /api/ask`
- `POST /api/assignment`
- `POST /api/pay` and `GET /api/pay/:reference`
- `POST /api/paystack/webhook`
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `GET /api/auth/me`, `POST /api/auth/chat`
