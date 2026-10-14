# Website chat assistant

The chat bubble on every page of primeacrehomebuyers.com. It answers seller questions,
collects the property details, books a call into an open time slot, and sends you the lead.

It runs in two modes, and switches between them on its own:

| Mode | When | What it does |
| --- | --- | --- |
| **AI** | This Worker is deployed and has an Anthropic API key | Claude holds a real conversation, offers open call times as buttons, books the call, and emails you the lead. |
| **Guided** | Before the Worker exists, or if it is ever unreachable | A short scripted chat collects the address, condition, timeline, name, phone, texting consent and a requested call time, then emails you the lead through the website's form service. |

Nothing on the website changes when you deploy: the bubble checks `chat.primeacrehomebuyers.com`
and uses AI mode as soon as it answers.

## What it costs

- **Cloudflare:** free plan is enough (100,000 requests a day).
- **Anthropic (Claude):** pay as you go. With the default model (Claude Opus 5.5, low effort) a typical
  10-message chat that ends in a booked call costs roughly 10 to 25 cents. Set a monthly spend limit (step 1) so a busy month
  or someone abusing the chat can never surprise you. Switching `MODEL` to `claude-haiku-5-5`
  cuts the cost by roughly 40x with somewhat less polished conversations; your call.

## Setup

### 1. Get an Anthropic API key (5 minutes)

1. Go to **console.anthropic.com** and sign up with brsmith6758@gmail.com.
2. **Billing:** add a payment method and buy $10 to $20 of credit.
3. **Limits:** set a monthly spend limit, for example $25.
4. **API Keys → Create Key**, name it `website-chat`, copy it. You only see it once.

### 2. Deploy the Worker. Pick ONE of these paths and stick with it.

#### Path A: Cloudflare dashboard (easiest, no GitHub settings)

1. In Cloudflare, open **Workers & Pages → Create application → Hello World** (the starter template).
   Name it `prime-acre-chat` and click **Deploy**.
2. Click **Edit code**. Delete everything in `worker.js`.
   Open [cloudflare-paste/worker.js](cloudflare-paste/worker.js), click **Raw**, select all, copy, paste it in,
   then click **Deploy**.
3. Back on the Worker: **Settings → Variables and Secrets → Add**. Type **Secret**, name
   `ANTHROPIC_API_KEY`, value = your key from step 1. **Deploy**.
4. **Settings → Domains & Routes → Add → Custom domain**: `chat.primeacrehomebuyers.com` → **Add**.
   Cloudflare creates the DNS record and certificate itself (allow a few minutes).
5. Recommended, for lead storage and no double-booked call times: open **Storage & databases → Workers KV
   → Create instance**, name it exactly `prime-acre-chat-leads`, **Create**.
   Then on the Worker open **Bindings → Add binding → KV namespace** (on some accounts it is
   **Settings → Bindings → Add**), variable name `LEADS`, pick that namespace, and confirm.

To update the assistant later on this path, paste the new `cloudflare-paste/worker.js` the same way (step 2).

#### Path B: automatic deploys from GitHub (updates ship by themselves)

1. In Cloudflare: **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** template.
   Under *Account Resources* pick your account; under *Zone Resources* pick `primeacrehomebuyers.com`.
   Create it and copy the token.
2. Copy your **Account ID** (Workers & Pages overview page, right-hand side).
3. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, three times:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`.
4. **Actions → Deploy chat assistant (Cloudflare Worker) → Run workflow.**

The workflow runs the tests, creates the `prime-acre-chat-leads` storage, deploys to
`chat.primeacrehomebuyers.com` with a per-visitor rate limit, and stores the API key as a secret.
After that, every change to `worker/` deploys itself.

If you used Path A first and switch to Path B, the GitHub deploy takes over the Worker's settings.
Keep the KV namespace named `prime-acre-chat-leads` and nothing is lost.

### 3. Optional: have the Worker email you directly

Without this, leads still reach your inbox: the chat bubble hands them to the website's form service
(the same one the other forms use). With it, the Worker emails you itself, even if the seller closes
the tab right away.

1. Cloudflare → your domain → **Email → Email Routing** → enable it, and add and verify
   brsmith6758@gmail.com as a destination address.
2. Path B only: GitHub → **Settings → Secrets and variables → Actions → Variables** → add
   `EMAIL_BINDING` = `true`, then re-run the workflow.
   (The dashboard does not reliably offer this binding, so Path A keeps using the form service.)

## Your call hours

Defaults: Monday to Saturday, 9 AM to 7 PM Central, 30-minute calls, at least an hour's notice,
up to a week ahead. Sellers see times in their own time zone. To change them, set these Worker
variables (Path A: Settings → Variables and Secrets, type Text; Path B: edit `wrangler.toml`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `BUSINESS_TZ` | `America/Chicago` | Your time zone |
| `BUSINESS_DAYS` | `1,2,3,4,5,6` | 1 = Monday … 7 = Sunday |
| `BUSINESS_START` / `BUSINESS_END` | `09:00` / `19:00` | First call start, last call end |
| `SLOT_MINUTES` | `30` | Call length |
| `MIN_NOTICE_MINUTES` | `60` | Earliest booking from now |
| `DAYS_AHEAD` | `7` | How far ahead sellers can book |
| `MODEL` / `EFFORT` | `claude-opus-5-5` / `low` | Claude model and thinking effort |

Also update `chatHours` in `site/config.js` so the guided mode suggests the same hours.

## Where leads go

- **Your inbox**, every time, with the call time in your zone and a one-click "add to calendar" link.
- **KV storage** (if bound): Cloudflare → Storage & databases → Workers KV → `prime-acre-chat-leads`.
  Keys starting `lead:` are leads; keys starting `slot:` are booked call times.

## How it behaves

- Discloses that it is an AI assistant and that a person follows up.
- Never gives a price or value estimate, never promises outcomes, gives no legal or tax advice,
  points homeowners facing foreclosure to free HUD-approved counselors as well, and stays away
  from anything Fair Housing protects.
- Asks before texting, and records the answer with the lead.
- Only offers call times that are actually open, between 7 AM and 9 PM in the seller's own time zone.
- Limits abuse in code: one booking per reply, two per conversation, three per visitor per day,
  one upcoming call per phone number, and a signed conversation history nobody can forge.
- Replies in Spanish to Spanish speakers and on the Spanish page.

Known limits:

- If two sellers pick the same time within a few seconds of each other, both can be confirmed.
  You get both lead emails and can call one of them at a nearby time. (Fully preventing it needs a
  Cloudflare Durable Object, which the dashboard path cannot set up.)
- Path B (GitHub) deploys real per-visitor and site-wide rate limits. Path A (dashboard) relies on a
  lighter built-in limiter, so the Anthropic monthly spend limit from step 1 matters more there.

## For developers

```
cd worker
npm install
npm test                       # unit + SDK-level tests (no network, no API cost)
npm run bundle:paste           # rebuild cloudflare-paste/worker.js after changing src/
```

End-to-end, with no API cost: run `node test/mock-anthropic.mjs` (a scripted fake of the
Anthropic API), `npx wrangler dev --config test/wrangler.e2e.toml`, serve `site/` on port 8000,
then `node test/e2e-api.mjs` and `NODE_PATH=$(npm root -g) node test/e2e-browser.mjs`.

| File | Purpose |
| --- | --- |
| `src/index.js` | HTTP entry: allowed origins, rate limit, `/health`, `/chat` |
| `src/agent.js` | One chat turn: Claude with tools, append-only history, refusal and fallback handling |
| `src/prompt.js` | The assistant's instructions and its three tools |
| `src/slots.js` | Call times in your zone, shown in the seller's |
| `src/leads.js` | Lead checks, storage, email |
| `../site/assets/chat.js` | The bubble on the website (both modes) |
