# Swell — Architecture

End-to-end architecture of the Swell operator platform: a multi-agent AI system that
turns a restaurant's POS export + website + location into a 30-day, weather- and
event-aware promotional campaign with revenue projections, branded creative, ad kit,
and a grounded assistant — behind real auth and subscription billing.

## System overview

```mermaid
flowchart LR
  subgraph Client [Next.js App Router — React 19]
    L["/ landing"] --> A["/auth<br/>sign up / sign in"]
    A --> P["/pricing<br/>plan → checkout"]
    P --> C["/console<br/>upload · generate · edit"]
    C --> ART["/c/[slug]<br/>public campaign artifact"]
    ART --- W["Ask Swell<br/>RAG assistant"]
  end

  subgraph API [API routes — Node runtime]
    AUTH["/api/auth/*"]
    BILL["/api/billing/* · /api/stripe/webhook"]
    GEN["/api/generate"]
    CRUD["/api/campaigns* · /api/campaign-days*"]
    CRE["/api/creative/[file]"]
    ASST["/api/assistant"]
  end

  subgraph Brain [Multi-agent orchestrator]
    O["orchestrate()"]
  end

  subgraph Data [Postgres — PGlite local / Neon prod]
    DB[(users · subscriptions · restaurants<br/>campaigns · campaign_days · marketplace_signals)]
  end

  subgraph External [Live external services]
    OM["Open-Meteo<br/>geocoding + 16-day forecast<br/>+ archive (climate normals)"]
    NG["Nager.Date<br/>public holidays"]
    TM["Ticketmaster<br/>concerts/sports (optional)"]
    MDB["TheMealDB<br/>food photography"]
    ST["Stripe<br/>checkout + webhooks"]
    LLM["Claude / Groq<br/>(optional)"]
  end

  Client --> API
  GEN --> O
  O --> OM & NG & TM
  O --> LLM
  CRE --> MDB
  BILL --> ST
  API --> DB
```

## The agent pipeline

`src/lib/orchestrator.ts` coordinates ten specialised agents on a shared context.
Every run records a per-agent trace (`agent_trace`) that renders in the artifact
sidebar — inputs, decisions, and wall-clock ms are inspectable.

```mermaid
flowchart TB
  B["Brand Agent<br/>website → logo, palette, type,<br/>voice vector, imagery"]
  D["Demand Agent<br/>marketplace signal<br/>(clearly labeled simulated)"]
  LO["Location Agent<br/>geocode venue"]
  WE["Weather Agent<br/>live forecast + seasonal normals"]
  EV["Events Agent<br/>holidays + ticketed events"]
  AN["Analyst Agent<br/>z-score dayparts,<br/>score items (margin × mix)"]
  ST["Strategy Agent<br/>30 offers: item, window, %,<br/>adapted per day to weather/events"]
  CO["Copywriter Agent<br/>caption/day + claims guardrail"]
  CR["Creative Agent<br/>poster/day, brand duotone,<br/>ad-kit aspect ratios"]
  RE["Revenue Agent<br/>redemptions × lift →<br/>incremental revenue roll-up"]

  B --> AN
  D --> AN
  LO --> WE --> ST
  LO --> EV --> ST
  AN --> ST --> CO --> CR --> RE
```

**Agent contracts** (all in `src/lib/`):

| Agent | Module | Input → Output |
|---|---|---|
| Brand | `brand.ts` | URL → `BrandKit` (logo, colors, fonts, voice vector, image URLs) |
| Demand | `marketplace.ts` | slug → `MarketplaceSignals` (`simulated: true` until real app data) |
| Location | `context/geo.ts` | free-text location → lat/lon/country (Open-Meteo geocoding) |
| Weather | `context/weather.ts` | lat/lon → 30-day `DayWeather` map: live 16-day forecast, then climate normals (`source: "seasonal"`) for the tail |
| Events | `context/events.ts` | country+coords+dates → holidays (Nager.Date) ∪ ticketed events (Ticketmaster, optional key) |
| Analyst | `generator.ts:analyzeSales` + `model.ts:trainSalesModel` | daypart z-scores + item scores, **plus** a ridge regression (trend + day-of-week) trained on the uploaded daily series and backtested on a holdout (honest MAE/MAPE); learns trend, strongest/weakest days, anomaly days |
| Strategy | `generator.ts:buildDayPlan` | all of the above → 30 `RawDay`s (weather/event deltas applied) |
| Copywriter | `copy.ts` | day plan + voice → caption <80 chars, prohibited-claims guardrail; LLM optional, deterministic fallback |
| Creative | `creative.ts` | day + brand → poster PNG (photo duotone or brand gradient) in 4 aspect ratios |
| Revenue | `generator.ts:assembleCampaign` + `project.ts` | days → projections, baseline, strategy notes |

### Revenue model (the projection math)

Per day (`src/lib/project.ts`):

```
reachable      = (dow_orders / dow_occurrences) × daypart_share      # measured
response_rate  = (0.12 + pct_off/100 × 0.7) × responseScale          # ASSUMED
redemptions    = max(3, reachable × response_rate × marketplace_lift)
incremental $  = redemptions × avg_check × (1 − pct_off) × incrementality  # ASSUMED
```

Weather/event deltas shift `pct_off` (±3–5pts) and item selection (comfort vs light
affinity regexes); events multiply expected covers (prep hint). A seasonal-normal day
moves `pct_off` half as far as a forecast day. Every figure shown in the UI (Report
charts, sidebar, assistant) derives from these persisted numbers — nothing is invented
at render time.

### Confidence range (`src/lib/validate.ts`)

`responseScale` and `incrementality` are the two inputs a POS export cannot reveal: how
many guests act on an offer, and how much of that spend is genuinely new. Rather than
decorate the point estimate with an invented ±, `validate.ts` re-runs the *same*
`projectDay()` at the pessimistic and optimistic edges of both — a sensitivity analysis:

```
spread         = min(0.75, 0.40 × volumeFactor(days_of_history))
low            = Σ projectDay(day, responseScale = 1 − spread, incrementality = 0.40)
expected       = Σ projectDay(day, responseScale = 1,          incrementality = 0.55)
high           = Σ projectDay(day, responseScale = 1 + spread, incrementality = 0.70)
```

Thin history widens the band (`volumeFactor` ≤ 1.5). Confidence is **capped at moderate**
while the demand multiplier is simulated, and drops to **low** under 21 days of history.
The same module runs real checks against the generated plan (30 days present, discounts
in the 10–45% guardrail, redemptions never exceeding expected covers, weather on every
day, captions under 80 chars, uplift a plausible size) and reports what failed.

## Real-time context loop

- Campaigns start **today**, so the first ~16 days sit inside the live forecast horizon.
- The remaining ~14 days are filled with **climate normals** — the average of that exact
  calendar date over the last 5 years, from Open-Meteo's free archive API. They carry
  `source: "seasonal"`, are labelled "est." in the UI, move the discount **half** as far
  as a real forecast, and are **withheld from the copywriter** so no caption can ever
  claim "Rainy Saturday?" off an estimate.
- All context calls are **resilient**: timeout-guarded, cached per process, and degrade
  to a sales-history-only plan (no key, no location, API hiccup → still generates).
- Regenerating a campaign re-pulls weather/events; a scheduled daily regenerate (Vercel
  Cron hitting `/api/generate`) keeps the plan current as conditions change.

## Auth & billing flow

```mermaid
sequenceDiagram
  participant U as Owner
  participant K as Clerk
  participant P as /pricing
  participant S as Stripe
  participant DB as Postgres
  participant C as /console

  U->>K: Sign up / in (Google or email)
  K-->>U: Clerk session
  U->>P: Choose plan (monthly/annual)
  alt Stripe key configured
    P->>S: Checkout session (client_reference_id = email)
    S-->>DB: webhook → subscriptions.upsert
  else demo mode (no key)
    P->>DB: subscriptions.upsert (mode: demo)
  end
  U->>C: Open console
  C->>DB: Clerk email → user row (mirrored) + active subscription?
  C-->>U: gated: signed out → /sign-in · unsubscribed → /pricing · ok → Console
```

- **Identity**: **Clerk** (`@clerk/nextjs`), Google + email. `src/proxy.ts` protects only
  `/console`, `/account` and the mutating API routes — the landing page, `/pricing`,
  `/demo` and the public campaign artifact stay open. The hand-rolled scrypt/HMAC auth
  was deleted.
- **Mirroring**: the Clerk email is the account key; `getAccount()` creates the local
  `users` row on first sight (`src/lib/billing/account.ts`).
- **Binding**: `/api/billing/bind` refuses a Checkout session whose `client_reference_id`
  is not the signed-in email, and requires `status === "complete"`.
- **Plans**: Starter/Pro/Agency with limits (restaurants, campaigns/month, ad kit,
  auto-publish, white-label) in `src/lib/billing/plans.ts`; usage metered from the DB.

## RAG assistant ("Ask Swell")

`src/lib/assistant.ts` — deliberately grounded:

1. **Facts**: the campaign is flattened into ~35 chunks (overview, revenue, per-day
   offer + weather/event rationale, strategy, how-to) — every number comes from the DB row.
2. **Retrieve**: keyword/tag scoring ranks chunks against the question.
3. **Answer**:
   - *keyless* → intent-matched deterministic answers; if retrieval confidence is low it
     **says "I don't have that"** and lists what it can answer — it never stitches
     unrelated facts;
   - *with `ANTHROPIC_API_KEY`/`GROQ_API_KEY`* → LLM generation constrained to the
     retrieved chunks with a no-invention system prompt.

## Data model

```mermaid
erDiagram
  users ||--o| subscriptions : "email"
  restaurants ||--o{ campaigns : "restaurant_id"
  campaigns ||--|{ campaign_days : "campaign_id (cascade)"
  users {
    text email PK
    text name
    text password_hash
  }
  subscriptions {
    text email PK
    text plan
    text status
    text mode "live | demo"
    text stripe_subscription_id
  }
  campaigns {
    text id PK
    text slug UK "public URL"
    real projected_revenue
    text agent_trace_json
    text context_json "weather/events summary"
    text brand_json
    text sales_json
  }
  campaign_days {
    text id PK
    text date
    text item
    real pct_off
    real projected_revenue
    text weather_json
    text event_json
    text creative_url
  }
  campaign_runs {
    text id PK
    text email FK
    text campaign_slug
    text created_at
    real projected_low
    real projected_expected
    real projected_high
    text confidence
    int checks_passed
  }
```

`campaign_runs` exists because regenerating **replaces** the campaign row (its public URL
must stay stable). Without the run log there would be no record that an earlier
generation ever happened, or what it projected at the time.

**Storage**: one SQL dialect (Postgres) everywhere — embedded **PGlite** (WASM) in dev,
**Neon**/any Postgres in prod via `DATABASE_URL`. No native modules → clean Vercel
serverless builds. Schema auto-creates + column migrations run idempotently on boot
(`src/lib/db.ts`).

## API surface

| Route | Method | Purpose |
|---|---|---|
| `/sign-in` `/sign-up` | — | Clerk-hosted auth (Google + email); no hand-rolled sessions |
| `/api/billing/checkout` | POST | Stripe Checkout (or instant demo sub); requires signed-in user |
| `/api/billing/me` | GET | user + subscription + plan + usage |
| `/api/billing/portal · bind` | POST | Stripe billing portal / post-checkout cookie bind |
| `/api/stripe/webhook` | POST | subscription lifecycle sync (signature-verified) |
| `/api/parse-csv` | POST | Toast/Square CSV/XLSX → `ParsedSalesSummary` (rejects <14 days) |
| `/api/brand-kit` | POST | URL → `BrandKit` |
| `/api/generate` | POST | full orchestration → persisted campaign (+ poster prewarm) |
| `/api/campaigns` `[slug]` `[slug]/action` | GET/POST/DELETE | list/read/activate/publish/archive |
| `/api/campaign-days/[id]` | PATCH | inline edit; projections recompute server-side |
| `/api/creative/[file]` | GET | poster/ad PNG (sharp; disk-cached; `?ratio=` for ad sizes) |
| `/api/runs` | GET | this account's generation history (projection, band, confidence, checks) |
| `/api/assistant` | POST | grounded Q&A over one campaign |

## Deployment topology

- **Vercel** (Node serverless functions) + **Neon** Postgres — both free tier.
- Weather/geocoding/holidays are keyless public APIs called at request time.
- Env: `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL`, Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `CLERK_SECRET_KEY`); optional `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`,
  `ANTHROPIC_API_KEY`/`GROQ_API_KEY`, `TICKETMASTER_API_KEY`.
- CI: GitHub Actions (`npm ci → lint → build`) on every push/PR.

## Honesty guarantees (by design)

- Marketplace demand is **labeled `simulated`** in data and UI until real consumer-app
  data exists — no invented "saves" presented as real.
- The assistant answers **only** from persisted campaign facts and says so when it can't.
- Projections show their inputs (Report → "What the brain read") and recompute through
  the same `project.ts` math when a day is edited.
- The headline number is always shown as a **range with a confidence label**, and every
  assumption behind it is tagged `measured` / `assumed` / `simulated` in the Report.
- Weather past the 16-day forecast horizon is a labelled **seasonal estimate**, never
  presented as a forecast, and is withheld from the copywriter.
- Every generation is logged to `campaign_runs`, so a regenerate cannot quietly rewrite
  what the brain projected last week.
- The assistant is forbidden from inventing product features — it will not tell an owner
  to "compare actual vs projected", because Swell does not track that.

## Scaling path (not yet built)

Multi-restaurant workspaces per account → row-level ownership (`campaigns.owner_email`),
background job queue for poster rendering (currently request-time + disk cache), Meta/
Google Ads OAuth publish (assets are already exported in every required aspect ratio),
and read replicas if artifact traffic outgrows a single Neon instance.
