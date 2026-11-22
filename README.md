# StudyBuddy — Dual AI edition

StudyBuddy now supports **OpenAI and Anthropic Claude** through one server-side AI gateway.

## What is implemented

- Existing StudyBuddy landing page and installable PWA shell.
- OpenAI Responses API integration.
- Anthropic Claude Messages API integration.
- Provider choice in the free AI tutor and paid assignment flow:
  - Automatic (recommended)
  - OpenAI
  - Claude
- Server-side fallback: if the preferred provider errors and fallback is enabled, the other configured provider is tried.
- `/api/ai/status` endpoint reports which providers are configured (never returns keys).
- Existing Paystack checkout, webhook signature validation and payment verification retained.
- Paid assignment response is unlocked only after server-side payment verification.
- Basic security headers, input bounds and atomic payment-file writes.

## AI routing

`AI_DEFAULT_PROVIDER=openai` makes OpenAI the first-choice provider when a student selects Automatic. Set it to `claude` to make Claude the first choice.

`AI_FALLBACK_ENABLED=true` enables failover to the other configured provider. If a student explicitly selects OpenAI or Claude, that provider is tried first, followed by the other configured provider if failover is enabled.

The default model IDs are configurable in `.env` (confirm model access in each provider account):
- OpenAI: `gpt-6.2-astra` (example model ID shown in the current OpenAI API quickstart).
- Claude: `claude-haiku-5-5` (fast, cost-effective option listed in Anthropic documentation).

If your API account does not have access to a default model, change the model ID to one enabled for your account. Model availability and prices can change.

## Setup

1. Install Node.js 18.17 or newer.
2. Extract this ZIP.
3. In the project folder run:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env`.
5. Add at least one AI key. To use both providers and automatic failover, add both. Paystack credentials are only needed when you enable checkout:
   - OpenAI key: https://platform.openai.com/api-keys
   - Anthropic key: https://console.anthropic.com/
6. Set `PUBLIC_BASE_URL` to the HTTPS address where this Node server will run when enabling Paystack checkout.
7. Start the server:

   ```bash
   npm start
   ```

8. Open `http://localhost:3000` during local testing.
9. Check `http://localhost:3000/api/health` and `http://localhost:3000/api/ai/status`.

## Paystack setup

- Use Paystack TEST mode first.
- Configure the webhook URL as `https://YOUR-DOMAIN/api/paystack/webhook`.
- Confirm that your Paystack account supports the payment channels you intend to offer in Kenya.
- Test initialization, successful payment, failed payment, webhook verification and one-payment/one-assignment behavior before enabling live mode.
- Keep `PAYSTACK_SECRET_KEY` only on the server.

## Deployment

Deploy the **whole project folder** to a Node.js host (not only the `public` folder). Configure all `.env` values in the host's environment-variable dashboard. The `public/` folder is served by Express.

The Paystack callback returns to `/app.html`; this file is included and loads the StudyBuddy app interface.

## Important production limitations to resolve before public launch

1. **Payment storage:** `payments.json` is a starter store, not a production database. Use a persistent disk at minimum, or preferably migrate payment records and usage limits to Supabase/Postgres. Set `DATA_FILE` to a persistent path if your host supports persistent disks.
2. **Usage limits:** free-tier per-IP counters are in memory and reset when the server restarts. Move them to a shared database/Redis before scaling.
3. **Authentication:** student accounts and Supabase authentication are not included in this build yet. Do not treat IP limits as account-level entitlements.
4. **Rate limiting:** add a production rate-limiting layer and abuse monitoring before sharing widely.
5. **Privacy:** avoid sending unnecessary student personal information to AI providers. Publish a privacy notice that explains data handling and provider processing.
6. **Billing:** AI API usage is charged separately by OpenAI and Anthropic. Set provider budgets/alerts and conservative usage limits.
7. **Academic integrity:** use AI outputs as learning support; students should verify facts and follow their institution's rules.

## API endpoints

- `GET /api/health` — server health and configured assignment price.
- `GET /api/ai/status` — configured AI providers and fallback status.
- `POST /api/ask` — limited free tutor chat. Body: `{ "messages": [...], "provider": "auto|openai|claude" }`.
- `POST /api/pay` — initialize Paystack checkout. Body: `{ "email": "student@example.com" }`.
- `GET /api/pay/:reference` — verify payment status.
- `POST /api/paystack/webhook` — Paystack webhook.
- `POST /api/assignment` — paid assignment help. Body includes `reference`, `subject`, `level`, `language`, `question`, and optional `provider`.

## Official API references

- OpenAI Responses API: https://developers.openai.com/api/reference/resources/responses/methods/create
- Anthropic Messages API: https://platform.claude.com/docs/en/api/messages/create
