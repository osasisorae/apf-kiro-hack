# Deployment Guide — Aurum Prop Firm

This document explains how to run the app locally, test Korapay webhooks using ngrok, and deploy to Vercel. It includes example `.env.local` entries, a webhook simulation curl, and troubleshooting/security notes.

## Checklist
- [ ] Start app locally and expose it with ngrok for webhook testing
- [ ] Configure `.env.local` for local dev (Korapay keys, webhook secret, notification_url)
- [ ] Simulate webhook deliveries for debugging
- [ ] Deploy to Vercel with correct environment variables
- [ ] Register production webhook URL in Korapay dashboard and remove dev bypass flags

---

## Quick plan
1. Run the Next.js app locally.
2. Start ngrok and forward to localhost:3000 so Korapay can POST to your local webhook.
3. Configure `.env.local` for local testing (example provided).
4. Simulate webhooks with curl to verify handler behavior.
5. Deploy to Vercel and set production env vars and Korapay webhook URL.

---

## Local development + ngrok

1. Install and start your dev server:

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000` by default.

2. Start ngrok to forward port 3000:

```bash
ngrok http 3000
```

Copy the HTTPS forwarding URL (e.g. `https://906ff9d56460.ngrok-free.app`).

3. Create/update `.env.local` in the project root (do not commit):

```
# .env.local (local only)
KORA_TEST_SECRET=sk_test_xxx
KORA_WEBHOOK_SECRET=whsec_yyy        # set if you use signature verification locally
KORAPAY_WEBHOOK_ALLOW_INSECURE=true # optional: dev-only (do NOT use in prod)
KORAPAY_NOTIFICATION_URL="https://<your-ngrok-domain>/api/payments/webhook"
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```

Notes:
- `KORA_TEST_SECRET` (or `KORAPAY_SECRET_KEY`) is required for server-side verify calls to Korapay.
- `KORA_WEBHOOK_SECRET` should match Korapay's webhook signing secret for signature verification.
- `KORAPAY_WEBHOOK_ALLOW_INSECURE=true` is strictly for local debugging; remove it in production.
- `KORAPAY_NOTIFICATION_URL` can be used by your initialize handler to ask Korapay to POST webhooks to your ngrok URL.

4. Configure Korapay:
- Option A: In your initialize payload include `notification_url` set to your ngrok URL + `/api/payments/webhook`.
- Option B: Add webhook URL in Korapay dashboard to point to your ngrok domain.

---

## Simulate a Korapay webhook (for debugging)

Use curl to POST a sample `charge.success` event to your ngrok URL. Replace the URL and payload as needed.

```bash
curl -X POST "https://<your-ngrok-domain>/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.success",
    "data": {
      "reference": "KPY-1757283475795",
      "payment_reference": "KPY-1757283475795",
      "amount": 1000,
      "currency": "NGN",
      "metadata": {"user_id":"2","account_size":"25000"}
    }
  }'
```

- If you enforce signature verification (`KORA_WEBHOOK_SECRET` present), you must include the `x-korapay-signature` header generated per Korapay docs, or use the dev bypass flag temporarily.

---

## Vercel deployment (production)

1. Connect the repository to Vercel (via the Vercel dashboard or `vercel` CLI).
2. In Vercel Project Settings → Environment Variables, add values for:
- `KORA_TEST_SECRET` or `KORAPAY_SECRET_KEY` (production secret)
- `KORA_WEBHOOK_SECRET` (webhook signing secret)
- `DATABASE_URL` (Neon connection string)
- `NEXTAUTH_URL` and other auth/env variables your app needs
- `KORAPAY_NOTIFICATION_URL="https://<your-vercel-app>.vercel.app/api/payments/webhook"` if you want initialize to include it

3. Important: Do NOT set `KORAPAY_WEBHOOK_ALLOW_INSECURE=true` in production.

4. Configure Korapay webhook URL to point at production:
```
https://<your-vercel-app>.vercel.app/api/payments/webhook
```

5. Deploy:

```bash
npm run build
npm run deploy   # this calls `vercel --prod` if configured
```

Or deploy from the Vercel dashboard.

---

## Post-deploy checks
- Check Vercel function logs for `api/payments/webhook` and `app/api/payments/initialize/route.js` to confirm webhooks and initialize flows.
- Confirm DB rows (`orders`, `trading_accounts`) are created in Neon.
- Trigger test payments in Korapay and verify the end-to-end flow.

---

## Troubleshooting
- Webhook not received:
  - Check Korapay dashboard delivery logs for errors.
  - Confirm the webhook URL is correct and reachable (ngrok for local; Vercel domain for prod).
  - Ensure ngrok forwarded URL is HTTPS.

- Signature verification fails:
  - Ensure `KORA_WEBHOOK_SECRET` matches the secret configured in Korapay.
  - Confirm header `x-korapay-signature` is present and your webhook handler reads it.

- Return page stays `pending`:
  - Either webhook was not delivered or server-side verify failed. Check logs for verify calls and webhook updates.

- DB connectivity errors:
  - Confirm `DATABASE_URL` is correct in the environment and tables exist.

---

## Security notes
- Never commit `.env.local` with secrets.
- Remove any dev-only bypass flags in production (e.g., `KORAPAY_WEBHOOK_ALLOW_INSECURE`).
- Use Korapay's webhook secret and verify signatures in production.
- Remove or redact verbose logs that include secrets before shipping to production.

---

## Helpful extras (optional)
- Add a simple health route `GET /api/health` that checks DB connectivity. Useful to verify Vercel → Neon quickly.
- Add an admin replay UI or admin endpoint to re-process webhook payloads if Korapay retries fail.

---

## Requirements coverage
- ngrok testing instructions: included
- `.env.local` example and notes: included
- curl webhook simulation: included
- Vercel deployment and env var checklist: included
- Security & troubleshooting: included

---

If you want, I can add the `GET /api/health` endpoint and commit it to the repo now. Let me know.
