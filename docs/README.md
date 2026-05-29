# sentry-google-chat documentation

Full guide for configuring and running the service. For deploying the published image, see [deployment.md](./deployment.md).

## How it works

```
Sentry alert rule
    │  HTTPS POST (signed: Sentry-Hook-Signature)
    ▼
POST /sentry/webhook
    │  1. verify HMAC-SHA256 over the raw body  ──▶ 401 on mismatch
    │  2. route on Sentry-Hook-Resource         ──▶ 200 ignore for others
    │  3. Zod-validate the payload              ──▶ 400 on bad shape
    │  4. normalize → AlertEvent
    │  5. render Google Chat cardsV2
    │  6. enqueue, return 202   (ACK to Sentry in well under 1s)
    ▼
per-space delivery queue  (≈1 msg/sec, Request-ID idempotency, backoff on 429)
    ▼
Google Chat space  (Incoming Webhook URL)
```

The HTTP handler does only fast, synchronous work so Sentry always gets its sub-second acknowledgement. The Google Chat POST happens asynchronously in a per-space queue that respects Google Chat's ~1 message/second per-space limit and retries with exponential backoff.

## Features

- Verifies the `Sentry-Hook-Signature` (HMAC-SHA256 of the raw body, constant-time compare) before doing any work — unauthenticated requests are rejected.
- Handles issue alerts (`event_alert`) and metric alerts (`metric_alert`).
- Per-project routing: send different Sentry projects to different Google Chat spaces, with a default fallback space.
- Per-space rate limiting, Request-ID idempotency (dedupes Sentry retries), and exponential backoff on `429`/`5xx`.
- Groups updates for the same issue/alert into one Google Chat thread.
- Reports its own errors to Sentry (optional, via `SENTRY_DSN`).
- Forward-compatible payload parsing — new Sentry fields do not break it.

## Prerequisites

- A Sentry organization where you can create a custom (internal) integration.
- Owner/manager access to the Google Chat space(s) you want alerts posted to.
- Node.js 24+ and pnpm only if you want to develop or build locally.

## Setup

### 1. Create a Google Chat Incoming Webhook

In each target Google Chat space: **Apps & integrations → Webhooks → Add webhooks**, give it a name (and optional avatar), and copy the generated URL:

```
https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN
```

Treat this URL as a secret — anyone who has it can post to the space. There is no in-place rotation; to rotate, delete and recreate the webhook.

### 2. Create the Sentry internal integration

In Sentry: **Settings → Developer Settings → Custom Integrations → New Internal Integration**.

- **Webhook URL**: `https://<your-deployed-host>/sentry/webhook`
- Enable **Alert Rule Action** — this makes the integration selectable as "Send a notification via \<your integration>" inside alert rules, which is how issue and metric alert webhooks are delivered.
- Leave the per-resource webhook checkboxes (error, issue, comment, …) unchecked. Do **not** subscribe to the `error` resource — it fires on every event and will flood the space.
- Save, then copy the **Client Secret**. This is the HMAC key — set it as `SENTRY_CLIENT_SECRET`.

### 3. Add the action to your alert rules

For each Sentry alert rule (issue or metric) you want forwarded: **Alerts → (rule) → Add action → "Send a notification via \<your integration>"**.

## Configuration

All configuration is via environment variables.

| Variable                | Required | Default       | Description                                                                 |
| ----------------------- | -------- | ------------- | --------------------------------------------------------------------------- |
| `SENTRY_CLIENT_SECRET`  | yes      | —             | Client Secret of the Sentry internal integration (used to verify webhooks). |
| `GCHAT_WEBHOOK_DEFAULT` | yes      | —             | Fallback Google Chat Incoming Webhook URL for unrouted projects.            |
| `GCHAT_ROUTES`          | no       | `{}`          | JSON map of Sentry project slug → Google Chat webhook URL.                  |
| `SENTRY_DSN`            | no       | —             | DSN for this service to report its own errors to Sentry.                    |
| `PORT`                  | no       | `8080`        | HTTP listen port.                                                           |
| `LOG_LEVEL`             | no       | `info`        | pino log level (`fatal`…`trace`, `silent`).                                 |
| `NODE_ENV`              | no       | `development` | `development`, `test`, or `production`.                                     |

### Routing to multiple spaces

`GCHAT_ROUTES` maps a Sentry **project slug** to a space webhook URL. Anything not matched falls back to `GCHAT_WEBHOOK_DEFAULT`, so an alert is never dropped:

```
GCHAT_ROUTES={"api-prod":"https://chat.googleapis.com/v1/spaces/AAA/messages?key=...&token=...","web":"https://chat.googleapis.com/v1/spaces/BBB/messages?key=...&token=..."}
```

The project slug is parsed from the event API URL for issue alerts, or `metric_alert.projects[0]` for metric alerts. If routing misbehaves, check the logged `project` field for the value to key on, or rely on the default space.

## Security

- Every webhook is authenticated by HMAC-SHA256 over the **raw** request body, keyed by the integration Client Secret, compared in constant time. The body is read as raw bytes before JSON parsing so the signature matches exactly.
- Untrusted text from Sentry (error titles, culprits) is HTML-escaped before it is placed into Google Chat card widgets.
- Secrets (the Client Secret and Google Chat webhook URLs) come from the environment / a secret store, are never committed, and are redacted from logs.

## Architecture

Hexagonal layout: pure functions for verify/normalize/render (`src/sentry`, `src/gchat`, `src/domain`) and thin adapters for the HTTP edge (`src/app.ts`) and the Google Chat client (`src/gchat/client.ts`). Delivery sits behind an interface so the in-process queue can be swapped for a durable backend without touching the core.

## Development

```sh
pnpm install
pnpm dev            # tsx watch, pretty logs
pnpm test           # vitest run
pnpm test:cov       # with coverage thresholds
pnpm test:watch     # watch mode
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
pnpm build          # compile to dist/
```

To exercise the webhook locally, point a Sentry internal integration at a tunnel (for example `cloudflared`/`ngrok`) forwarding to `http://localhost:8080`.

## Releases

- `main` — development branch. CI runs on every push/PR; it may be red.
- `live` — release branch, kept green at all times. CI auto-promotes `main` to `live` only after lint + typecheck + tests + Docker build all pass ([`ci.yml`](../.github/workflows/ci.yml)), so `live` never advances to a broken commit.
- A push to `live` (or a `v*` tag) triggers [`release.yml`](../.github/workflows/release.yml), which builds and pushes the public multi-arch image to GHCR. It publishes the image only — deploying it is the consumer's responsibility (see [deployment.md](./deployment.md)).

## Limitations

- Single instance: the delivery queue, rate limiter, and idempotency cache are in-process. Horizontal scale-out requires swapping the delivery port for a durable queue (Redis / Cloud Tasks).
- Incoming Webhook delivery only — Google Chat webhook buttons are open-link only (no interactive "resolve from chat" actions). That needs a full Chat app.
- Issue lifecycle webhooks (resolved/regression/assigned) are not handled yet; only alert-triggered `event_alert` and `metric_alert`.
