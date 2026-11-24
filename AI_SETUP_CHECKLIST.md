# StudyBuddy AI and account setup checklist

1. Deploy the complete project to a Node.js host (not a static-only hosting target).
2. Add at least one valid server-side provider key: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.
3. Confirm the configured model is enabled for that provider account. Defaults in `.env.example` can be changed.
4. Open `/api/ai/status` and confirm at least one provider is true and `ready` is true.
5. Ask a short question in the tutor and test the provider selector/fallback.
6. Register a test account, sign out, sign in again and confirm the saved chat returns.
7. Configure `ACCOUNT_FILE` on persistent storage before production deployment.
8. Keep all AI keys on the server. Never expose keys in browser code or a public repository.

A ChatGPT subscription does not include API credits. API usage requires a separately enabled API account and billing.
