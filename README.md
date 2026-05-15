# Hookline - Serverless Webhook Event Monitor

Hookline is a webhook monitor/debugger built with **Next.js** and
**AWS serverless infrastructure**. It lets developers create public webhook
ingest URLs, capture incoming events, inspect payloads, replay requests to
downstream services, and optionally ask AI to explain an event.

The goal is to present a compact, production-aware backend/platform project:
API design, storage tradeoffs, replay safety, observability, infrastructure as
code, CI, and a public-demo-friendly frontend.

## What It Solves

Webhook integrations are difficult to debug because payloads are transient,
provider behavior differs, and failed deliveries are hard to reproduce.
Hookline gives developers a controlled place to receive, inspect, and replay
events from services such as Stripe, GitHub, Shopify, Discord, Web3 indexers, or
custom backends.

## Core Features

- Create webhook endpoints with public ingest URLs.
- Capture request method, path, headers, query params, source IP, timestamp, and
  raw body.
- Store searchable event metadata in DynamoDB and full raw payloads in S3.
- Inspect event details from a Next.js dashboard.
- Delete endpoints from the dashboard (removes their events and S3 payloads).
- Replay captured events to a destination URL.
- Strip sensitive and hop-by-hop headers during replay.
- Emit structured JSON logs to CloudWatch.
- Show seeded preview data when the app API key is missing or invalid, so the
  demo still communicates the product flow.
- Optionally explain webhook payloads or failures with **Gemini** behind a
  DynamoDB-backed daily usage cap.

## Try the live demo (~10 seconds)

No clone or AWS setup required to explore the project.

1. Open **[https://hookline.dev](https://hookline.dev)**.
2. Browse **Dashboard**, **Endpoints**, and an event detail page. Without an API
   key, the UI loads **seeded preview data**.

The hosted stack restricts replay via SAM parameter **`ReplayAllowedHosts`** so
the shared account cannot be used to forward traffic to arbitrary URLs. When you
clone the repo and deploy locally, leave that parameter empty for friction-free
testing (e.g. replay to [webhook.site](https://webhook.site)).

To apply the same restriction on a stack you operate, set the parameter when deploying sam:

```bash
sam deploy --guided
```

Use hostnames only (no `https://` or paths). Subdomains of an allowed host are
permitted (e.g. `example.com` allows `api.example.com`).

## Local Development

Install dependencies and start the frontend:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck:lambdas
```

### Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and point the UI at your
deployed API Gateway URLs (from `sam deploy` stack outputs **`AppApiBaseUrl`** and
**`IngestBaseUrl`**):

```bash
# App API — dashboard reads /api/* (stack output AppApiBaseUrl)
NEXT_PUBLIC_API_BASE_URL=https://abc123.execute-api.us-east-1.amazonaws.com

# Ingest API — webhooks POST to /hooks/{endpointId} (stack output IngestBaseUrl)
NEXT_PUBLIC_INGEST_BASE_URL=https://def456.execute-api.us-east-1.amazonaws.com/hooks
```

Use two different `execute-api` hosts if SAM created separate HTTP APIs for ingest
and app (typical for this template). Replace `abc123` / `def456`, region, and paths
with your stack outputs. No trailing slash on either value.

Then open `/settings` in the app and paste the same value you deployed as SAM
parameter **`AppApiKey`** (sent as `x-api-key` on every `/api/*` request).

### Deploy the AWS backend

Prerequisites: AWS SAM CLI, AWS credentials, Node.js 22+.

```bash
cd infra
sam build
sam deploy --guided
```

Important stack outputs:

- `IngestBaseUrl` → `NEXT_PUBLIC_INGEST_BASE_URL`
- `AppApiBaseUrl` → `NEXT_PUBLIC_API_BASE_URL`
- `EventsTableName`, `PayloadsBucketName`, `AiUsageTableName`

## Demo Flow

A quick end-to-end picture of what the system does:

1. Open `/settings` and save the deployed app API key (`AppApiKey` from SAM).
2. Go to `/endpoints` and create an endpoint.
3. Copy the generated ingest URL (includes `?token=...`).
4. Send a test webhook:

```bash
curl -sS -X POST "https://abc123.execute-api.us-east-1.amazonaws.com/hooks/00000000-0000-4000-8000-000000000001?token=YOUR_INGEST_TOKEN" \
  -H "content-type: application/json" \
  -d '{"event":"demo.order.paid","amount":4200}'
```

5. Open `/dashboard` and inspect the new event.
6. Open the event detail page and replay it to a test destination such as
   `https://webhook.site/...`.
7. Optional: click **Explain with AI** if the stack was deployed with
   `GeminiApiKey`.
8. Optional: delete an endpoint from `/endpoints` to drop its history. On event
   detail, the **Reproduce this request** curl omits the ingest token; add
   `?token=...` to the URL or send `x-hookline-token` before running it locally.

Without an API key, the UI still loads with **preview data** so you can browse the
dashboard; configure Settings to talk to the real backend.

## Architecture

```mermaid
flowchart LR
  UI[Next.js Hookline UI] -->|x-api-key| AppApi[API Gateway HTTP API<br/>/api/*]
  AppApi --> AppLambda[App API Lambda]

  UI -->|POST /hooks/{endpointId}| IngestApi[API Gateway HTTP API<br/>/hooks/*]
  IngestApi --> IngestLambda[Ingest Lambda]

  AppLambda --> Events[(DynamoDB<br/>events)]
  AppLambda --> Endpoints[(DynamoDB<br/>endpoints)]
  IngestLambda --> Events
  IngestLambda --> Endpoints

  AppLambda --> Payloads[(S3<br/>raw payloads)]
  IngestLambda --> Payloads

  AppLambda --> AiUsage[(DynamoDB<br/>AI usage)]
  AppLambda --> Gemini[Google Gemini<br/>generateContent]

  AppLambda --> Logs[(CloudWatch Logs)]
  IngestLambda --> Logs
```

### Request Flow

1. An endpoint is created from the app page.
2. The app API stores endpoint metadata and generates an ingest token.
3. A sender posts to `/hooks/{endpointId}?token=...`.
4. The ingest Lambda validates the endpoint/token pair.
5. The raw body is written to S3.
6. Queryable metadata and a body preview are written to DynamoDB.
7. The dashboard reads events through the app API.
8. Replay loads the stored body and forwards it to a destination URL.
9. AI explain, when configured, reserves a daily usage slot before calling Gemini.
10. Endpoint delete purges that endpoint's DynamoDB events and S3 objects, then removes the endpoint row.

## Engineering Decisions

### DynamoDB for metadata, S3 for raw payloads

Webhook bodies can be large, binary, or provider-specific. Hookline stores
queryable event fields in DynamoDB while archiving the original raw body in S3.
This keeps the dashboard access pattern fast without forcing large payloads into
the primary database record.

### Token-protected ingest URLs

Each endpoint can include an ingest token in the generated URL. The ingest Lambda
checks the token before accepting writes, which keeps public ingest URLs from
becoming open write endpoints.

### Replay with header hygiene

Replay sends the stored payload back out as a `POST`, but intentionally strips
sensitive and hop-by-hop headers such as `authorization`, `cookie`, `host`,
`content-length`, forwarding headers, and AWS request headers. The SAM template
also supports an optional replay host allowlist for public demos.

### Public-demo preview mode

If the app API returns `401` or `403`, the dashboard falls back to a seeded
preview dataset for endpoints and events. This keeps the public UI useful without
exposing the real API key, while write actions remain disabled until a valid key
is configured.

### Bounded AI explain

AI explain is optional and disabled by default. When `GeminiApiKey` is set, the
app API redacts sensitive headers, truncates the payload sent to the model, and
atomically reserves a UTC daily usage slot in DynamoDB before calling Gemini.
If the daily cap is exceeded, the endpoint returns `429` instead of making an
external model call.

### Endpoint cleanup path

Deleting an endpoint removes the endpoint row, deletes its event records in
DynamoDB batches, and removes the matching S3 payload objects. The cleanup path
handles paginated event queries and retries unprocessed DynamoDB batch writes.

### Structured operational logs

Both Lambdas emit structured JSON logs to CloudWatch with fields such as
`eventId`, `endpointId`, `durationMs`, status, and failure messages. The goal is
to make the system observable instead of only visually demoable.

### Infrastructure as code

The AWS backend is defined with AWS SAM, including HTTP APIs, Lambda functions,
DynamoDB tables, S3 payload storage, IAM permissions, CORS settings, and runtime
configuration.

## Tech Stack

**Frontend**

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style components over Radix UI
- Sonner toasts and lucide-react icons

**Backend**

- AWS Lambda on Node.js 22
- AWS API Gateway HTTP APIs
- DynamoDB
- S3
- CloudWatch Logs
- IAM
- AWS SAM

**Quality**

- Node.js test runner (`tsx`) — UI helpers plus mocked Lambda handler tests for
  API key auth, ingest tokens, and replay allowlist / private-IP rejection
- ESLint
- Lambda TypeScript typechecks
- GitHub Actions CI (lint, test, Next.js build, `sam validate --lint`, `sam build`)

## Application Routes

- `/` - landing page
- `/dashboard` - recent webhook events across endpoints
- `/endpoints` - create/delete endpoints and copy ingest URLs
- `/events/[eventId]` - event detail, raw payload inspection, replay, AI explain,
  and reproducible `curl`
- `/settings` - local API key configuration

When the app API returns **401/403** (missing or invalid `x-api-key`), the
dashboard, endpoints list, and event detail show **sample preview data** and a
banner instead of a blank error. Configure your API key in Settings to load real
data and enable write actions.

## Project Structure

```text
app/                  Next.js App Router routes
components/           App-specific UI and shadcn/ui primitives
lib/                  API client, preview dataset, config, utilities
types/                Shared webhook and endpoint types
infra/                AWS SAM template and deployment config
lambdas/ingest/       Ingest Lambda for public webhook writes
lambdas/app-api/      App API Lambda for dashboard reads, delete, replay, and AI explain
tests/                Node test runner coverage for API helpers and preview data
docs/                 AWS project tour and implementation notes
.github/workflows/    CI for lint, tests, build, Lambda typecheck, SAM lint
```

## Optional AI Explain (Gemini)

AI explain uses **Gemini** through Google AI Studio. Deploy with
`GeminiApiKey` to enable it, optionally overriding `GeminiModel` (default
`gemini-2.0-flash`) and `AiExplainMaxPerDay` (default `100`, global cap per UTC
day).

When `GeminiApiKey` is blank, `POST /api/events/{eventId}/explain` returns `200`
with a short "not configured" message and does not call Google. When the key is
set, the Lambda reserves a slot in `AiUsageTable` before calling Gemini;
exceeding the daily cap returns `429`.

## CI

GitHub Actions runs the same checks expected before shipping changes:

```bash
pnpm lint
pnpm test
pnpm build
pnpm typecheck:lambdas
sam validate --lint -t infra/template.yaml
```

This covers the frontend, shared client helpers, deterministic preview data,
Lambda TypeScript, and the SAM template.

## Security Notes

The project documents and implements several practical safety controls:

- App API requests require an `x-api-key` header.
- Ingest URLs can include per-endpoint tokens.
- Replay strips sensitive and hop-by-hop headers.
- Replay rejects localhost/private/internal destinations and non-standard ports.
- Public S3 access is blocked and payloads are encrypted at rest with S3-managed
  encryption.
- CORS origins are configurable through the SAM template.
- Replay destinations can be restricted with `ReplayAllowedHosts`.
- AI explain redacts sensitive headers and has a daily usage cap.
- Real webhook payloads may contain secrets; avoid sending production traffic to
  a demo deployment.

Production hardening would add user authentication, endpoint ownership checks,
provider-specific signature verification, rate limiting, retention policies,
dead-letter queues, and more granular authorization.

## Cost Notes

For light demo traffic, Lambda, DynamoDB on-demand capacity, API Gateway, and S3
can stay low-cost. Costs increase with sustained request volume, large payloads,
or long payload retention. Delete the SAM stack when the demo is no longer
needed:

```bash
cd infra
sam delete --stack-name <your-stack-name>
```

If stack deletion fails because the S3 bucket is not empty, remove the payload
objects first.

## Documentation

Detailed notes live in [`docs/`](docs/):

- [`docs/AWS_PROJECT_TOUR.md`](docs/AWS_PROJECT_TOUR.md) - technical project tour

## License

MIT License. See [LICENSE](LICENSE).
