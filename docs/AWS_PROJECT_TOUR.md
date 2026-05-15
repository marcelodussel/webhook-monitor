# Hookline AWS Project Tour

This doc is meant to teach AWS concepts behind **Hookline** and to clearly describe **what has already been built** in this repo.

If you’re new to AWS, read this in order:

- What the system does (in plain English)
- The end-to-end request flows
- The AWS resources (and why each exists)
- The data model (DynamoDB + S3)
- Security model (IAM + API keys + replay safety)
- How to deploy, test, and debug

---

## What Hookline is (the problem, not the tech)

Webhook producers (Stripe, GitHub, Shopify, etc.) send HTTP requests to your server. When integrations go wrong you need:

- A stable URL to receive webhooks
- A place to **store** what was sent (including raw body)
- A UI/API to **inspect** events and headers
- A “replay” button to send the exact payload to another destination

Hookline provides:

- An **ingest URL** (`/hooks/{endpointId}`) that receives webhooks.
- An **app API** (`/api/*`) used by the Next.js dashboard to list endpoints/events, view event detail, replay, and optionally “AI explain”.

---

## Repo orientation (what lives where)

- `infra/template.yaml`: AWS SAM template (infrastructure-as-code).
- `lambdas/ingest/src/index.ts`: Ingest Lambda handler (write path).
- `lambdas/app-api/src/index.ts`: App API Lambda handler (read + actions).
- `app/`, `components/`: Next.js UI. It talks to the app API using `NEXT_PUBLIC_API_BASE_URL`.
- `docs/DAY1_AWS_INGEST.md`: A smaller “Day 1” deep dive on ingest.

---

## Architecture at a glance (two HTTP APIs)

There are **two API Gateway HTTP APIs**, each pointing at its own Lambda:

- **Ingest API**: public write path  
  - Route: `ANY /hooks/{endpointId}` → `IngestFunction`
- **App API**: “dashboard backend”  
  - Routes: `GET/POST /api/endpoints`, `GET /api/endpoints/{endpointId}/events`, `GET /api/events/{eventId}`, `POST /api/events/{eventId}/replay`, `POST /api/events/{eventId}/explain` → `AppApiFunction`

Both Lambdas store/read data from:

- **DynamoDB** (metadata)
- **S3** (raw payload bodies)
- **CloudWatch Logs** (debugging + observability)

All of that is defined in `infra/template.yaml`.

---

## Flow 1: Ingest a webhook (write path)

When a webhook producer sends a request:

1. **Client** calls API Gateway: `POST /hooks/{endpointId}?token=...`
2. **API Gateway (HTTP API)** invokes the ingest Lambda with an event object.
3. **Ingest Lambda** (`lambdas/ingest/src/index.ts`):
   - Validates `endpointId`
   - Checks a per-endpoint **ingest token** (simple abuse control)
   - Generates an `eventId` (ULID)
   - Stores the **raw body** in S3:
     - `endpoints/{endpointId}/events/{eventId}/body.raw`
   - Stores **metadata** in DynamoDB (headers, query, `bodyPreview`, `payloadS3Key`, etc.)
4. Lambda returns `200` with JSON `{ eventId, endpointId }`

### AWS concepts this teaches

- **API Gateway (HTTP API)**: public URL → Lambda invocation.
- **Lambda**: stateless handler, runs per request.
- **S3**: cheap blob store for “the full thing”.
- **DynamoDB**: queryable store for “the index / metadata”.
- **IAM least privilege**: ingest Lambda can only do the writes it needs.
- **CloudWatch Logs**: where Lambda logs end up.

---

## Flow 2: The dashboard reads data (read path)

The Next.js UI calls the app API (secured via `x-api-key`):

- `GET /api/endpoints`
  - Scans the endpoints table and returns the list.

- `POST /api/endpoints`
  - Creates a new endpoint record in DynamoDB.
  - Generates an `ingestToken` and returns an ingest URL that includes `?token=...`.

- `GET /api/endpoints/{endpointId}/events?limit=50`
  - Queries DynamoDB for “recent events for this endpoint”.

- `GET /api/events/{eventId}`
  - Looks up the event by `eventId` (via a DynamoDB GSI).
  - Fetches the raw payload from S3 and returns `event.fullBody` when present.

### AWS concepts this teaches

- **Auth at the edge** (simplified): API key gating is implemented in the Lambda by checking `x-api-key`.
- **DynamoDB access patterns**: query-by-endpoint vs lookup-by-event-id (GSI).
- **S3 as a backing store**: fetch payload only when needed (event detail).

---

## Flow 3: Replay an event (action path)

Replay exists because it’s common to want “send the same webhook again, but to a new destination”.

1. UI calls `POST /api/events/{eventId}/replay` with optional JSON `{ "destinationUrl": "https://..." }`
2. App API Lambda:
   - Loads event record from DynamoDB (via `EventIdIndex`)
   - Loads the raw body from S3
   - Forwards a POST to `destinationUrl`
   - Updates the DynamoDB item to track status (`replayed` / `failed`), `replayCount`, `destinationUrl`, `lastError`

### Replay safety (important AWS/security lesson)

This repo intentionally contains protections for “public demo safety”:

- Strips common sensitive headers (`authorization`, `cookie`, etc.)
- Only forwards `content-type` and `x-*` headers
- Rejects localhost/private IPs and non-standard ports
- Optional allowlist via the `ReplayAllowedHosts` SAM parameter

---

## Flow 4 (optional): AI explain (external call)

`POST /api/events/{eventId}/explain`:

- Loads event from DynamoDB + payload from S3
- Redacts sensitive headers before sending to the model
- If `GEMINI_API_KEY` is unset: returns **200** with a short “not configured” message (no Google call, no usage write)
- If `GEMINI_API_KEY` is set:
  - Atomically increments a **UTC daily** counter in **`AiUsageTable`** (`explainDay#YYYY-MM-DD`) under cap **`AiExplainMaxPerDay`**; if over cap, returns **429**
  - Calls **Gemini** `generateContent` on `generativelanguage.googleapis.com` using `GEMINI_MODEL`
- Returns `{ explanation }` on success

This is **disabled by default** unless you deploy with **`GeminiApiKey`** set.

---

## The AWS resources (what SAM creates)

All of the following live in `infra/template.yaml`.

### API Gateway HTTP APIs

- `IngestApi`: CORS allows `content-type`, origins from `FrontendOrigins`
- `AppApi`: CORS allows `content-type` and `x-api-key`, origins from `FrontendOrigins`

Key learning: **HTTP API** is cheaper/simpler than REST API for many use cases.

### Lambda functions

- `IngestFunction`
  - Env vars: `EVENTS_TABLE`, `ENDPOINTS_TABLE`, `PAYLOADS_BUCKET`
  - IAM: `dynamodb:PutItem` (events), `dynamodb:GetItem` (endpoints token), `s3:PutObject` (payloads)

- `AppApiFunction`
  - Env vars: `EVENTS_TABLE`, `ENDPOINTS_TABLE`, `PAYLOADS_BUCKET`, `APP_API_KEY`, `INGEST_BASE_URL`, optional `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_USAGE_TABLE`, `AI_EXPLAIN_MAX_PER_DAY`, optional `REPLAY_ALLOWED_HOSTS`
  - IAM: `dynamodb:Query` + `UpdateItem` (events), `Scan/Get/Put/Delete` (endpoints), `dynamodb:UpdateItem` (**AiUsageTable**), `s3:GetObject` (payloads)

Key learning: Lambda permissions should be **narrow**, and environment variables are the standard “config injection” mechanism.

### DynamoDB tables

- `EventsTable` (`{ResourcePrefix}-events`)
  - Partition key: `endpointId`
  - Sort key: `sk`
  - GSI: `EventIdIndex` partition key `eventId`

- `EndpointsTable` (`{ResourcePrefix}-endpoints`)
  - Partition key: `id`

- `AiUsageTable` (`{ResourcePrefix}-ai-usage`)
  - Partition key: `pk` (for example `explainDay#2026-05-12`)
  - Attributes: `explainCount` (number, incremented by the app API), `ttl` (epoch seconds for DynamoDB TTL cleanup)

Key learning: DynamoDB schema design is about **queries you need**, not joins you want.

### S3 bucket

- `PayloadsBucket` (`{ResourcePrefix}-payloads-<account>-<region>`)
  - Private bucket with public access blocked
  - SSE-S3 encryption enabled (AES256)

Key learning: S3 is the “big payload store”; DynamoDB stores the “index”.

### CloudWatch Logs

Both functions log JSON. In AWS, every Lambda invocation gets:

- a log stream for that container/runtime
- log entries you can search by `msg` (e.g. `ingest`, `replay`, `app_api_failed`)

---

## Data model (why DynamoDB + S3 is split)

Webhook events can have bodies that are:

- large
- binary
- expensive to store repeatedly in DynamoDB

So Hookline uses a common pattern:

- **DynamoDB** stores “event metadata” (fast queries, small items)
- **S3** stores “the full raw body” (cheap, scalable objects)

### What an event record contains

In the events table, an item includes (simplified):

- `endpointId`: which endpoint received it
- `sk`: sort key used for time ordering (`RECEIVED#<iso>#<eventId>`)
- `eventId`: the stable identifier used by the UI
- `receivedAt`, `method`, `path`, `sourceIp`
- `headers`, `query`
- `bodyPreview`: first ~2KB (fast UI preview)
- `payloadS3Key`: pointer to the S3 object for the full body
- replay fields: `status`, `replayCount`, optional `destinationUrl`, optional `lastError`

### The two access patterns (this is the DynamoDB “why”)

The project needs:

- **List events by endpoint (most common)**  
  Partition key = `endpointId`, sort by `sk` descending → `GET /api/endpoints/{endpointId}/events`

- **Fetch one event by ID (deep link from UI)**  
  Query a GSI where partition key = `eventId` (`EventIdIndex`) → `GET /api/events/{eventId}`

Key learning: in DynamoDB you design for “how you query”, and you add a GSI when a second access pattern appears.

---

## Security model (what’s implemented and what’s “MVP”)

This is a portfolio-style MVP and is intentionally simple.

### App API auth: static API key

- The app API expects `x-api-key` to match the deployed `AppApiKey` parameter.
- The UI stores the value locally in the browser (see `README.md`).

Key learning: API keys are not user auth; this is “gatekeeping” for a demo, not a full auth system.

### Ingest auth: per-endpoint ingest token

- Endpoints created by `POST /api/endpoints` get an `ingestToken`.
- Ingest requires token via `?token=...` or `x-hookline-token`.
- If the endpoint doesn’t exist, ingest returns `404` (doesn’t accept writes).

Key learning: this keeps the ingest URL from being a completely open spam target during demos.

### IAM: least privilege per Lambda

The SAM template grants each function only what it needs:

- Ingest: write event, read endpoint token, write payload.
- App API: read/write endpoints, query/update events, read payload.

Key learning: IAM scopes are a core AWS “safety belt”.

---

## Deployment and configuration (how you actually run it)

### Prereqs

- AWS credentials (AWS CLI configured, or environment-based credentials)
- AWS SAM CLI installed
- Node.js (the Lambda build uses `npm ci` + bundling via Makefile builds)

### Deploy the backend

From repo root:

```bash
cd infra
sam build
sam deploy --guided
```

During `--guided`, SAM will prompt for:

- stack name
- region
- confirm IAM permissions (`CAPABILITY_IAM`)
- parameters (or accept defaults):
  - `ResourcePrefix` (names tables/bucket)
  - `FrontendOrigins` (CORS)
  - `AppApiKey` (dashboard API key)
  - `GeminiApiKey` (optional; Google AI Studio key for AI explain)
  - `GeminiModel` (optional; default `gemini-2.0-flash`)
  - `AiExplainMaxPerDay` (optional; default `100` global explains per UTC day)
  - `ReplayAllowedHosts` (optional)

### Wire the frontend to the backend

Set these in `.env.local` (see `.env.example` and `README.md`):

- `NEXT_PUBLIC_API_BASE_URL` = stack output `AppApiBaseUrl`
- `NEXT_PUBLIC_INGEST_BASE_URL` = stack output `IngestBaseUrl`

Then run:

```bash
pnpm dev
```

---

## How to test end-to-end (curl + AWS console)

### 1) Create an endpoint (so ingest is allowed)

```bash
API_BASE_URL="https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com"
API_KEY="replace-me-with-a-long-random-string"

curl -sS -X POST "${API_BASE_URL}/api/endpoints" \
  -H "x-api-key: ${API_KEY}" \
  -H "content-type: application/json" \
  -d '{"name":"Demo endpoint"}'
```

This returns an `ingestUrl` containing `?token=...`.

### 2) Send a webhook to the ingest URL

```bash
curl -sS -X POST "<INGEST_URL_FROM_RESPONSE>" \
  -H "content-type: application/json" \
  -d '{"event":"demo.order.paid","amount":4200}'
```

### 3) Verify storage

- **DynamoDB**: events table should have a new item under the endpoint partition.
- **S3**: payload object should exist at `endpoints/<endpointId>/events/<eventId>/body.raw`.
- **CloudWatch Logs**: ingest function should have a JSON log with `msg:"ingest"`.

---

## Debugging guide (what to check when things break)

- **4xx from app API**
  - `401`: wrong/missing `x-api-key`
  - `404`: wrong path or missing `eventId`/`endpointId`
  - `429`: AI explain daily cap exceeded (when `GeminiApiKey` is set)

- **404 from ingest**
  - Endpoint doesn’t exist yet (create it via `POST /api/endpoints`)

- **401 from ingest**
  - Missing/invalid token (`?token=...` or `x-hookline-token`)

- **502 from either Lambda**
  - The handler threw an error; check CloudWatch Logs for `msg:"ingest_failed"` or `msg:"app_api_failed"`

- **Replay fails**
  - Destination URL rejected (private host, non-standard port, allowlist mismatch)
  - Destination returned non-2xx (stored as `lastError`)

Key learning: in serverless systems, **logs + request IDs + deterministic inputs** are the fastest path to a fix.

---

## What has been done (checklist)

- **Infrastructure-as-code** using AWS SAM (`infra/template.yaml`)
- **Ingest** HTTP API + Lambda handler
  - Writes event metadata to DynamoDB
  - Writes raw bodies to S3
  - Validates endpoint existence + ingest token
- **App API** HTTP API + Lambda handler
  - API key gating via `x-api-key`
  - CRUD-lite for endpoints (create + list)
  - List events for endpoint (DynamoDB query)
  - Fetch event detail (GSI lookup + S3 body)
  - Replay event (S3 → outbound fetch → DynamoDB update)
  - Optional AI explain (S3 + DynamoDB usage slot + **Gemini**)
- **CORS** configured for browser use via `FrontendOrigins`

---

## Good “next AWS lessons” after this MVP

If you want to evolve this into a production-grade system, the next topics to teach are:

- **Authentication/Authorization**: Cognito or IAM authorizers / JWT validation instead of a static key
- **Secrets**: SSM Parameter Store or Secrets Manager instead of plain parameters
- **Observability**: metrics (CloudWatch EMF), structured logging, tracing (X-Ray)
- **Reliability**: DLQs, retries, idempotency keys for webhook replay
- **Cost controls**: S3 lifecycle policies, DynamoDB TTL, request throttling

