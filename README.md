# yuRi Research App

A stock research app that pairs SEC filing / financial data with an LLM assistant that can actually reason about it. FastAPI backend, React/Vite frontend, LangGraph-orchestrated chatbot.

**[Jump to the screenshots →](#examples)**

## Contents

| Section | What's in it |
|---|---|
| [Stack](#stack) | The technologies, at a glance. |
| [Core features](#core-features) | What the app does: auth, watchlist, assistant. |
| [Installation](#installation) | Prerequisites, backend and frontend setup, env files. |
| [Project structure](#project-structure) | The repository tree, annotated. |
| [Architecture](#architecture) | How routers, services and the agent fit together. |
| [Database](#database) | The nine tables, their relationships, and why the caches are keyed on filings. |
| [API endpoints](#api-endpoints) | Every route, its auth requirement, and the shared dependencies behind them. |
| [Services](#services) | The layer holding all the logic — one subsection per module. |
| [Agentic pipeline](#agentic-pipeline) | The supervisor/worker graph and how its answer reaches the browser. |
| [Data sources](#data-sources) | EDGAR, Finnhub, yfinance and Logokit — what each provides and what's cached. |
| [Examples](#examples) | A walk through the app, screen by screen. |

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLModel (SQLAlchemy 2.0), Postgres, Alembic |
| Auth | JWT (`python-jose`) + Argon2 password hashing |
| LLM | LangChain + LangGraph, OpenAI |
| Data sources | `edgartools` (SEC EDGAR), Finnhub, `yfinance`, Logokit |
| Frontend | React 19, TypeScript, Vite, React Router |

---

## Core features

### Auth

- JWT-based, stateless.
- Register/login issue a signed token (`sub`, user id, expiry).
- Every protected route depends on a typed `CurrentUser` dependency that decodes and validates it.
- Passwords are hashed with Argon2.
- A rolling daily message-limit counter on the user record throttles chatbot usage (admins are exempt).

### Watchlist

- A plain many-to-many link table between users and stocks.
- Users can add/remove a ticker and see their full watchlist on the home page.

### Chatbot / assistant

Scoped to one company at a time, from that company's stock page. A user can:

- ask business, financial, or filing questions and get a streamed, cited-in-context answer from the [agentic pipeline](#agentic-pipeline);
- see prior chat sessions for that ticker and resume any of them;
- start a new session (created lazily on the first message, not on clicking "new chat," to avoid empty session clutter);
- delete a session (falls back to the next most recent, or a fresh draft).

---

## Installation

### Prerequisites

| | Version | Notes |
|---|---|---|
| Python | 3.12 | The backend is pinned to CPython 3.12 (`backend/venv` was built with 3.12.2). |
| Node.js | 20.19+ or 22.12+ | Required by Vite 8. |
| PostgreSQL | 14+ | A running instance and an empty database for the app. |

You also need API keys for three external services:

| Service | Used for | Where to get one |
|---|---|---|
| OpenAI | The LLM assistant | <https://platform.openai.com/api-keys> |
| Finnhub | Company profile / metadata | <https://finnhub.io/register> |
| Logokit | Company logo images | <https://logokit.com> |

SEC EDGAR needs no key, but it does require a contact identity in the request headers. That value is currently hardcoded in [main.py](backend/app/main.py#L13) — change it to your own email before running.

### 1. Clone the repository

```bash
git clone <repository-url>
cd stock_app
```

### 2. Backend

All backend commands run from the `backend/` directory — both the `.env` lookup and `alembic.ini` are resolved relative to it.

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
```

Create `backend/.env`:

```ini
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/stock_app
JWT_SECRET_KEY=<a long random string>

OPENAI_API_KEY=<your key>
FINNHUB_API_KEY=<your key>
STOCK_LOGO_API_KEY=<your key>

CORS_ORIGINS_RAW=http://localhost:5173
```

Generate a secret key with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

Apply the database migrations, then start the server:

```bash
alembic upgrade head
fastapi dev app/main.py
```

The API is now on <http://localhost:8000>, with interactive docs at `/docs` and a liveness probe at `/health`.

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```ini
VITE_API_BASE_URL=http://localhost:8000
```

```bash
npm run dev
```

The app is now on <http://localhost:5173>. Register an account from the UI to get started — the first user is created through the normal signup route, not a seed script.

### Frontend build

```bash
cd frontend
npm run build     # type-checks with tsc, then bundles to dist/
npm run preview   # serve the production build locally
npm run lint      # eslint
```

---

## Project structure

Two independent applications in one repository — a Python backend and a TypeScript frontend, each with its own dependencies and env file.

```
stock_app/
├── backend/            FastAPI application
│   ├── app/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env
└── frontend/           React + Vite single-page app
    ├── src/
    ├── public/
    ├── package.json
    └── .env
```

### Backend

```
backend/app/
├── main.py                     App entrypoint: CORS, /health, router mounting
├── models.py                   SQLModel tables (User, Stock, Financial, FilingSection, ChatSession, ...)
├── schemas.py                  Pydantic request/response models
├── crud.py                     Database reads and writes
│
├── core/
│   ├── config.py               Settings loaded from .env
│   ├── database.py             Engine and session factory
│   ├── deps.py                 FastAPI dependencies (CurrentUser, DB session)
│   ├── security.py             JWT signing/decoding, Argon2 hashing
│   └── logging_config.py       Log formatting and levels
│
├── routers/                    HTTP layer — auth and validation only
│   ├── auth.py                 Register, login, token issuing
│   ├── stocks.py               Search, prices, overview, statements, news, business summary
│   ├── users.py                Account and watchlist management
│   └── chatbot.py              Chat sessions and the SSE streaming endpoint
│
├── services/                   Business logic — caching, external fetches, DB writes
│   ├── edgar_client.py         Thin wrapper over edgartools
│   ├── filings_data.py         Filing sections (10-K, 10-Q, 8-K)
│   ├── financial_data.py       Financial statement extraction and caching
│   ├── company_data.py         Company profile from Finnhub
│   ├── stock_data.py           Ticker search, price history, logo URLs
│   ├── news_data.py            Company news
│   ├── metrics.py              Computed ratios and derived metrics
│   └── llm/                    The assistant
│       ├── agent.py            LangGraph supervisor/worker graph
│       ├── chatbot.py          Session orchestration and token streaming
│       ├── llm_client.py       Model construction
│       ├── prompts.py          System prompts per node and worker
│       └── summarize.py        AI business summaries
│
└── alembic/
    ├── env.py                  Reads DATABASE_URL from app config
    └── versions/               Migration history
```

The `routers` → `services` split is the load-bearing one: see [Architecture](#architecture) for why.

---

## Architecture

```mermaid
flowchart LR
    subgraph Client
        FE["React SPA"]
    end

    subgraph Backend["FastAPI backend"]
        Routers["Routers\nauth / stocks / users / chatbot"]
        Services["Services\nfilings, financials, company,\nmetrics, news"]
        Agent["LLM Agent\n(LangGraph)"]
    end

    DB[("Postgres")]
    EDGAR["SEC EDGAR\n(edgartools)"]
    Finnhub["Finnhub"]
    YF["yfinance"]
    OpenAI["OpenAI API"]

    FE <-->|"REST + SSE"| Routers
    Routers --> Services
    Routers --> Agent
    Agent --> Services
    Agent <--> OpenAI
    Services <--> DB
    Services --> EDGAR
    Services --> Finnhub
    Services --> YF
```

The backend is thin at the router layer:

- **Routers** handle auth and request validation only.
- **Services** own caching, external fetches, and DB writes — for both REST endpoints *and* the LLM agent's tools.

> **Design decision — services own caching and fetching, routers stay thin.**
> Routes never talk to EDGAR, Finnhub, yfinance or the cache directly — they call into the service layer, and so do the LLM agent's tools. The REST API and the assistant's tools are backed by the exact same function for a given piece of data, not two parallel implementations that can quietly drift apart.

---

## Database

Nine tables in Postgres, defined with SQLModel in [models.py](backend/app/models.py) and migrated with Alembic. Table names are the lowercased class names.

```mermaid
erDiagram
    user ||--o{ watchlist : "watchlists"
    stock ||--o{ watchlist : "watchlisted by"
    user ||--o{ chatsession : "owns"
    stock ||--o{ chatsession : "scoped to"
    chatsession ||--o{ chatmessage : "contains"
    stock ||--o{ financials : "has"
    financials ||--o{ financialline : "contains"
    stock ||--o{ filingsection : "has"
    stock ||--o| businesssummary : "has"

    user {
        string id PK
        string username
        string hashed_password
        int daily_message_counter
        datetime limit_resets_at
        bool is_admin
    }

    stock {
        string id PK
        string ticker
        string name
    }

    watchlist {
        string user_id PK "FK to user"
        string stock_id PK "FK to stock"
        datetime created_at
    }

    financials {
        string id PK
        string stock_id FK
        string financial_statement "income_statement, balance_sheet, cash_flows"
        string accession_number "cache key"
        datetime created_at
    }

    financialline {
        string financial_id PK "FK to financials"
        string label PK "the company's own wording"
        int period PK "calendar year"
        string standard_label "XBRL standard concept"
        string unit
        float value
    }

    filingsection {
        string stock_id PK "FK to stock"
        string section PK "business, mda, risks"
        string accession_number "cache key"
        text content
        datetime created_at
    }

    businesssummary {
        string stock_id PK "FK to stock"
        string accession_number "cache key"
        string content "LLM-generated"
        datetime created_at
    }

    chatsession {
        string id PK
        string user_id FK
        string stock_id FK
        string title "LLM-generated, set on the first turn"
        datetime last_message_at
        int message_count
        datetime created_at
    }

    chatmessage {
        string id PK
        string chat_session_id FK
        string role "user, assistant, system"
        string content
        datetime created_at
    }
```

`stock` and `user` are the only two tables holding primary data. Everything else is either a cache of something fetched from EDGAR or a record of a conversation.

Three tables are caches, and all three carry an `accession_number` rather than a TTL: `financials`, `filingsection` and `businesssummary`. A row is valid while its accession number still matches the company's latest annual filing — see [filings_data](#filings_data--filing-prose) for why that beats an expiry time.

Two relationships cascade on delete. Removing a `financials` row drops its `financialline` rows, and deleting a `chatsession` drops its `chatmessage` rows. Nothing else cascades, so a stock keeps its cached filings even after every user un-watchlists it.

> **Design decision — composite natural keys on the cache tables.**
> `filingsection` is keyed on `(stock_id, section)` and `businesssummary` on `stock_id` alone, so a stock can physically hold only one row per filing section and one summary. Re-ingesting a new filing is an upsert against that key rather than an insert plus a cleanup of the old rows.

> **Design decision — `financialline` is one row per label and period.**
> Statements arrive from EDGAR as a wide dataframe with a column per period. Melting them into `(financial_id, label, period)` rows means the composite primary key enforces one value per line item per year, and both consumers — the REST endpoint and the assistant's Markdown table — read the same shape.

> **Design decision — `chatsession` stores counters it could compute.**
> `last_message_at` and `message_count` are written on every turn even though both are derivable from `chatmessage`. Listing a user's sessions is then a plain indexed read instead of a join and aggregate over every message. Neither is ever reset — the daily throttle is a separate counter on `user`, reset by `DailyLimitDep`.

> **Design decision — no foreign key from `stock` to a filing.**
> The cache tables reference `stock`, never the other way round. A stock row is created the first time anyone searches its ticker, long before any filing has been parsed, so the relationship has to tolerate a stock with nothing cached against it.

---

## API endpoints

Every route lives under one of four routers. Auth is a bearer JWT in the `Authorization` header; the **Auth** column marks which routes require one. The full interactive spec is at `/docs` when the server is running.

### `/auth` — registration and login

| | Endpoint | Auth | What it does |
|---|---|---|---|
| `POST` | `/auth/register` | — | Creates a user. Rejects a taken username with 400 and stores the password as an Argon2 hash. |
| `POST` | `/auth/login` | — | Verifies the password and returns a signed JWT bearer token. |

### `/users` — account and watchlist

| | Endpoint | Auth | What it does |
|---|---|---|---|
| `GET` | `/users/me` | ✓ | Returns the authenticated user. |
| `GET` | `/users/me/watchlist` | ✓ | Returns the user's watchlisted stocks. |
| `POST` | `/users/me/watchlist/{ticker}` | ✓ | Adds a ticker to the watchlist. 400 if it's already there. |
| `DELETE` | `/users/me/watchlist/{ticker}` | ✓ | Removes a ticker. 404 if it isn't on the list. |

### `/stocks` — market and filing data

| | Endpoint | Auth | What it does |
|---|---|---|---|
| `GET` | `/stocks?query=` | — | Ticker search. Non-equity results (ETFs, indices, currencies) are filtered out. |
| `GET` | `/stocks/{ticker}/prices?range=` | — | Daily price bars. `range` is one of `1m`, `6m`, `1y`, `5y`, `max` (default `1y`). |
| `GET` | `/stocks/{ticker}/overview` | — | The header block: quote, day and 52-week range, market cap, industry, beta, logo. |
| `GET` | `/stocks/{ticker}/news` | — | Recent news articles. |
| `GET` | `/stocks/{ticker}/statements/{statement}` | ✓ | One financial statement — `income_statement`, `balance_sheet` or `cash_flows` — as flat rows, with headline subtotals flagged for the UI. |
| `GET` | `/stocks/{ticker}/summary` | ✓ | AI-generated business summary. 404 when the company has no business section to summarize. |

### `/chat` — assistant sessions

| | Endpoint | Auth | What it does |
|---|---|---|---|
| `GET` | `/chat/{ticker}/sessions` | ✓ | The user's chat sessions for that ticker, most recent first. |
| `POST` | `/chat/{ticker}/session` | ✓ | Creates an empty session. |
| `GET` | `/chat/session/{id}` | ✓ | Full message history for one session. |
| `DELETE` | `/chat/session/{id}` | ✓ | Deletes a session and its messages. |
| `POST` | `/chat/session/{id}` | ✓ | Sends a message and streams the answer back as SSE (`limit`, `status`, `token`, `done` events). Returns 429 once the daily message limit is hit. |

Plus `GET /health`, which holds no database session and calls nothing external — see [main.py](backend/app/main.py) for why that emptiness is the point.

### Shared dependencies

The routers stay this thin because five typed dependencies do the repetitive work before a handler runs.

| Dependency | What it guarantees |
|---|---|
| `SessionDep` | An open database session, closed after the response. |
| `CurrentUser` | A decoded, still-valid JWT resolved to a real `User` row — otherwise 401. |
| `StockDep` | A `Stock` row for the path's `{ticker}`, **created on first request** if the app has never seen it — otherwise 404. |
| `ChatSessionDep` | A chat session that belongs to the calling user. A session owned by someone else returns 404, not 403. |
| `DailyLimitDep` | The caller is under their daily message allowance, resetting the rolling 24-hour counter if it has expired. Admins are exempt. |

> **Design decision — tickers are created on demand, not seeded.**
> `StockDep` runs `get_or_create_stock`, so the `stocks` table fills up as people search rather than from a preloaded universe of symbols. A ticker with no Finnhub profile is treated as nonexistent, which keeps typos out of the table.

---

## Services

The service layer holds all the logic. Each module owns one subject area and is the single implementation behind both the REST endpoints and the assistant's tools.

[`edgar_client`](#edgar_client--one-door-to-sec-edgar) · [`filings_data`](#filings_data--filing-prose) · [`financial_data`](#financial_data--financial-statements) · [`metrics`](#metrics--ratios-and-derived-figures) · [`company_data`](#company_data--company-profile-and-quote) · [`stock_data`](#stock_data--search-price-history-logos) · [`news_data`](#news_data--company-news) · [`llm/`](#llm--the-assistant)

### `edgar_client` — one door to SEC EDGAR

Resolves a ticker to an EDGAR company and finds its latest annual (10-K/20-F) or quarterly (10-Q) filing.

Nothing else in the codebase constructs an `edgartools` object directly. 

### `filings_data` — filing prose

Serves the text sections of a company's filings: the 10-K's business description, MD&A and risk factors, the latest 10-Q's MD&A, and recent 8-K events.

Three caching strategies sit side by side here, chosen per filing type rather than applied uniformly:

- **10-K sections are cached in Postgres**, keyed by the filing's accession number. Parsing a 10-K is slow, so it happens once per filing.
- **10-Q MD&A and 8-K events are fetched live** and never persisted. They are small enough that caching would only buy invalidation logic.
- **The AI business summary is cached** on top of the 10-K, under the same accession number.

> **Design decision — invalidate on a new filing, not on a TTL.**
> A cached section is valid while its accession number still matches the company's latest annual filing. Filings change rarely and on no schedule, so a TTL would be wrong in both directions: too short and it re-parses a document that hasn't changed, too long and it serves last year's numbers.

> **Design decision — a failed refetch serves the stale cache.**
> If EDGAR is down or the parse fails, the cached copy is returned with a warning rather than an error. Last year's business description is a better answer than none. This applies only where a cache exists — the live 10-Q and 8-K paths simply return nothing, since they are supplementary context rather than the substance of an answer.

> **Design decision — 8-Ks are listed before they are read.**
> `list_8k_filings` returns metadata only (date, event type, items reported). The worker picks a relevant filing from that list before `fetch_8k_filing` pays to render its full text and exhibits. Reading every recent 8-K to find the one that matters would spend most of its tokens on filings that don't.

> **Design decision — the quarterly MD&A is extracted separately, then labeled.**
> When the assistant asks for MD&A it gets both the annual and quarterly versions, each passed through the extractor on its own and returned under its own heading. Concatenating them first would make the extractor split attention across two documents in one pass, and would leave the model unable to tell which statement came from the more recent report.

### `financial_data` — financial statements

Fetches the income statement, balance sheet and cash flow from the latest annual filing and normalizes them into flat rows, one per line item and period.

Statements arrive from `edgartools` as a wide dataframe carrying abstract header rows and dimensional breakdowns (revenue split by segment, by geography, and so on). Those rows are dropped, duplicate labels collapsed, and the per-period columns melted into `(label, period, value)` rows. Caching works exactly as in `filings_data` — accession-number keyed, with a stale fallback.

Each stored row keeps both the company's own label and the XBRL **standard concept** behind it, which is what makes the two consumers possible:

- The REST endpoint renders the company's labels, flagging headline subtotals (revenue, net income, total assets…) via an allowlist of standard concepts so the UI can style them without pattern-matching on label text.
- The assistant's tool pivots the same rows into a Markdown table of labels × periods.

> **Design decision — dimensional rows are dropped at ingest.**
> A raw statement mixes totals with every segment and geography breakdown of those totals. Keeping them would triple the row count and give a model several plausible candidates for "revenue" with no way to tell which is the consolidated figure.

### `metrics` — ratios and derived figures

Computes financial ratios on top of the cached statements — 59 metrics across liquidity, leverage, profitability, cash flow, efficiency, growth and per-share.

A `Statement` object flattens all three statements into a single concept × period lookup. Lookups go through the **standard XBRL concept**, not the company's label, so one formula works across companies that phrase their line items differently. Figures with no single source line — D&A, total debt, diluted EPS — are synthesized at load time from their components.

Each metric is a registry entry pairing a formula with the description, use case and unit shown to the model. Every formula is built from `safe_div`/`safe_add` helpers, so a missing input or a zero denominator resolves to `None` and prints as `N/A`.

> **Design decision — a metric registry, not metric functions.**
> Because each entry carries its own description and use case, `list_metrics` can hand the model the whole catalog as a table. The model looks up what exists instead of guessing a metric name, and unrecognized names come back reported rather than silently dropped. Adding a metric is one registry entry, and it becomes visible to the assistant with no prompt change.

> **Design decision — missing data resolves to `None`, never an exception.**
> Growth and CAGR metrics deliberately reach past the requested window (period + 1, + 3, + 5), so asking for data that was never fetched is a normal outcome. One absent line item nulls one cell instead of failing the whole request.

> **Design decision — units are formatted in one place.**
> Formulas return raw numbers (`4.79`, not `479%`); the unit declared on the metric decides how that renders. Nothing downstream has to guess whether a value has already been multiplied by 100.

### `company_data` — company profile and quote

Backs the overview block at the top of a stock page, and resolves a ticker's company name whenever `StockDep` meets a new symbol.

One overview combines three Finnhub endpoints: `/quote` for price and day range, `/stock/profile2` for industry, exchange and market cap, `/stock/metric` for the 52-week range and beta. Market cap and share count are reported in millions and scaled back to units here. Nothing is cached.

> **Design decision — Finnhub instead of Yahoo for company data.**
> Yahoo rate limits by IP, so on a single shared instance one user's burst locked out everyone. Finnhub's free tier gives an explicit 60 calls a minute against an API key, which is a budget that can be reasoned about instead of an opaque throttle.

### `stock_data` — search, price history, logos

Ticker search, daily price bars, and the Logokit URL for a company's logo.

Search filters Yahoo's results down to `EQUITY`, so ETFs, indices and currencies never reach a page built for company filings. The logo function returns a URL rather than fetching an image — the browser loads it straight from Logokit's CDN, so the backend never proxies image bytes.

> **Design decision — market data is never cached.**
> Prices change constantly and are cheap to fetch, so persisting them would only mean serving stale quotes.

### `news_data` — company news

Recent news articles for a ticker, from Yahoo.

Yahoo's payload is awkward in three specific ways, and this module absorbs all three: article fields are nested under a `content` key, the destination URL appears as either a canonical or a tracked click-through URL, and the thumbnail arrives as a list of resolutions. Articles missing a title or publish date are dropped rather than rendered half-empty.

### `llm/` — the assistant

The LangGraph pipeline, the SSE streaming layer, prompts, and the extractor — five modules, layered so that model construction, graph logic and the HTTP-facing turn each sit on their own.

| Module | What it holds |
| --- | --- |
| `llm_client` | The only place a model is constructed. `get_model` takes a model name and returns a cached chat model — callers read the tier they want off config and pass it in; `ask` is a one-shot system + history + question call for code that needs no chain. Reasoning models (the `gpt-5` and o-series prefixes) take `reasoning_effort` and reject `temperature`, so which of the two applies is decided here per model rather than at every call site. |
| `agent` | The supervisor/worker graph — pipeline state, the four nodes (`reformulate_question`, `supervisor`, `worker`, `write_answer`), the two worker agents with their tool sets, and the conditional edge that fans assignments out and loops back. Detailed under [Agentic pipeline](#agentic-pipeline). |
| `chatbot` | The turn boundary between the graph and the API. Runs one turn, converts the graph's dual `updates`/`messages` stream into SSE events, and persists the exchange — the question immediately so it survives a failed call, the reply and session metadata in a `finally` so a client disconnecting mid-stream still commits. Also generates the session title. |
| `summarize` | The two standalone filing passes `filings_data` calls: `retrieve_relevant_context`, the extractor every filing tool routes its text through, and `summarize_business_info`, the cached business description on a stock's overview. Neither runs inside the graph. |
| `prompts` | Every system prompt and chat template the modules above use, kept in one file so wording can be read and changed without touching pipeline code. |

Two decisions worth naming at the service level:

> **Design decision — three model tiers.**
> `budget_llm_model` runs the high-volume mechanical passes: the filing extractor, session-title generation, question reformulation and the business summary. The extractor reads entire filing sections, so it is by far the largest token consumer in the app and the least in need of reasoning ability. `llm_model` is the default tier and runs the tool-using worker agents, where most of the remaining tokens go, along with the supervisor's planning. `reasoning_llm_model` runs the final answer writer — a handful of calls per turn on small inputs, but it sets the ceiling on answer quality, so it is raised without dragging the workers' volume up with it. The answer writer runs at low `reasoning_effort` even so: its tokens are what streams to the screen, so thinking time there shows up as silence, and it is synthesizing results the workers already gathered rather than reasoning from scratch. Session-title generation pins effort too, at `minimal` — naming a question needs no reasoning, and on a response that short a reasoning model can otherwise spend its whole budget on reasoning tokens and return empty text.

> **Design decision — the extractor pulls verbatim passages, it does not summarize.**
> Before an analyst worker sees filing text, a cheap pass extracts the passages bearing on its subtask, verbatim. It is a gather step, not an analysis step — materiality weighting is the analyst's job. Summarizing here would mean the final answer is a summary of a summary, with nothing traceable back to what the filing actually says.

---

## Agentic pipeline

The assistant is a **supervisor/worker graph** built with LangGraph, not a single prompt-and-tools loop.

```mermaid
flowchart TD
    START(["User question"]) --> Reformulate["reformulate_question\n(rewrite using chat history)"]
    Reformulate --> Supervisor{"supervisor\n(decides what's still needed)"}
    Supervisor -->|"assign subtasks"| Worker["worker (parallel fan-out)\nfinancial_analyst | filing_analyst"]
    Worker --> Supervisor
    Supervisor -->|"enough info / iteration cap"| Writer["write_answer\n(synthesize final reply)"]
    Writer --> END(["Streamed to user"])
```

### Nodes

| Node | Role |
|---|---|
| `reformulate_question` | Rewrites a follow-up ("what about last year?") into a standalone question using chat history, so downstream nodes don't need the full conversation. |
| `supervisor` | A structured-output LLM call (`is_complete` + a list of subtask assignments). Can dispatch several workers in the same turn (LangGraph `Send`), capped at a max iteration count as a guardrail against infinite tool-calling loops. |
| `worker` | Dispatches to one of the two specialist workers below. |
| `write_answer` | The only node whose output is user-visible; synthesizes everything the workers found into one final answer. |

### Specialist workers

Each worker is its own small tool-calling agent (`langchain.agents.create_agent`) with its own system prompt and a narrow, non-overlapping tool set — the supervisor picks which worker(s) to invoke per subtask, not which tools to use.

| Worker | Tools | Answers questions about |
|---|---|---|
| `financial_analyst` | `fetch_financial_statement`, `list_metrics`, `get_metrics` | Revenue, margins, growth, computed metrics/ratios |
| `filing_analyst` | `fetch_filing_section`, `list_8k_filings`, `fetch_8k_filing` | Business description, risk factors, MD&A, recent 8-K events |

> **Design decision — multiple specialist workers instead of one general agent.**
> Multiple Workers allow for parallel gathering across different domains. Apart from that, it also allows each worker (agent) to be specialised in one single aspect instead of forcing a response from a single worker 

### Streaming

- LangGraph emits one interleaved stream of every node's activity.
- The backend filters that stream so **only `write_answer`'s tokens become real text on screen**. Every earlier node (supervisor deciding, workers fetching data) instead emits a short status update — *"Thinking…"*, *"Gathering data…"*.
- Result: a live "typing" response with no dead air, without leaking intermediate reasoning as garbled partial text.

**Path**: `graph.stream()` (SSE from FastAPI) → raw `fetch` + a manual `ReadableStream` reader on the frontend (not `EventSource`, since the request needs a POST body and an auth header) → tokens appended one at a time to the chat UI.

> **Design decision — persist before generating, not after.**
> The user's message and their daily-message-limit counter are committed *before* the LLM call starts, and the assistant's reply is persisted in a `finally` block. A failed generation or a client disconnect can never lose the question or let a call dodge the rate limit.

---

## Data sources

Four external sources feed the app, each wrapped behind a service module so the LLM tools and the REST API read from identical logic.

### SEC EDGAR (`edgartools`)

| | |
|---|---|
| **Scraped** | Latest annual report — 10-K, or 20-F for a foreign issuer — (business description, MD&A, risk factors), latest 10-Q (MD&A), 8-K filings, Financial statements |
| **Handled** | Financial Statements require pre-processing to clean uneccessary dimensions|
| **Served via** | `GET /stocks/{ticker}/statements/{statement}`, `GET /stocks/{ticker}/summary`; the same functions are also exposed as LangChain tools (`fetch_financial_statement`, `fetch_filing_section`, `list_8k_filings`, ...) |

> **Design decision — extract, don't summarize, source documents.**
> Filing text goes through a cheap "extractor" LLM pass that pulls verbatim relevant passages before an analyst ever sees it, rather than summarizing it. Answers stay traceable to the actual filing text instead of a lossy summary of a summary.

> **Design decision — Only Annual Reports are cached**
> From Annual filing data we extract relevant sections, financial statements and later an AI-generated summary. Since parsing annual reports requries heavy proccessingis, the outputs are cached in Postgres keyed by the filing's accession number — a new annual report invalidates the cache, and a failed refetch falls back to the last good cached copy rather than erroring. Filings change rarely and irregularly, so invalidating on a new filing (rather than a TTL) avoids both stale data and unnecessary re-fetching. 

> **Design decision — Cache is triggered by users**
> The more the users search stocks, the more content is cached, to allow for faster response times.

> **Design decision — Smaller Filings are scraped live**
> Apart from annual report (10-K), the rest of the filings are scraped/parsed live on request. The time it takes for this proccess is negligible.

### Finnhub

| | |
|---|---|
| **Fetched** | One overview draws on three endpoints: `/quote` for price, previous close and day range, `/stock/profile2` for industry, exchange, market cap and shares outstanding, `/stock/metric` for the 52-week range and beta. `/stock/profile2` is also hit on its own to resolve a ticker's company name. |
| **Handled** | Market cap and share count are reported in millions and scaled back to units; an unknown ticker answers `200` with a payload of zeros, so a falsy price is the only signal to reject it; day high/low come back as zero outside trading hours on some listings, where the current price stands in |
| **Served via** | `GET /stocks/{ticker}/overview`, plus the name lookup inside `StockDep`, which fires for any ticker not yet in the database |

> **Design decision — Finnhub instead of Yahoo for company data.**
> Yahoo rate limits by IP, so on a single shared instance one user's burst locked out everyone. Finnhub's free tier gives an explicit 60 calls a minute against an API key, which is a budget that can be reasoned about instead of an opaque throttle.

> **Design decision — the overview is not cached.**
> It is built around a live quote, so caching it would mean serving a stale price. The cost is three of the 60-per-minute budget per page load, which is the trade accepted for a quote that is actually current.

> **Design decision — the API token travels in a header.**
> `X-Finnhub-Token` rather than a query parameter, so the key stays out of request logs and any URL that gets captured along the way.

### yfinance

| | |
|---|---|
| **Scraped** | Ticker search, daily price history, company news |
| **Handled** | Search results are filtered to `EQUITY`, so ETFs, indices and currencies never reach a page built for company filings; news articles arrive with nested fields, two competing URL forms and a list of thumbnail resolutions, all normalized on the way out |
| **Served via** | `GET /stocks?query=`, `GET /stocks/{ticker}/prices`, `GET /stocks/{ticker}/news` |

> **Design decision — no caching for market data.**
> This data is cheap to fetch and changes constantly, so persisting it would just mean serving stale prices — it's fetched live on every request instead.

### Logokit

| | |
|---|---|
| **Fetched** | Nothing — the service returns a tokenized image URL |
| **Served via** | Embedded in `GET /stocks/{ticker}/overview` as the `img` field |

> **Design decision — the logo URL is handed to the browser, not proxied.**
> The image loads straight from Logokit's CDN, so the backend never moves image bytes and never needs a cache for them.

---

## Examples

One pass through the app, in the order a new user meets it.

### 1. Landing

Search is the only entry point — there is no browsable universe of tickers, because [the `stocks` table fills up on demand](#shared-dependencies) as people search. Signing in is optional and only buys a watchlist; prices, charts and news are open to anyone.

![The logged-out home screen: a single search field over a dark ground](images/home_page.png)

### 2. Sign in

Username and password, hashed with Argon2 and exchanged for a JWT bearer token that every protected route validates.

![The log-in dialog over the home screen](images/login.png)

### 3. Your watchlist

Signed in, the same screen becomes a dashboard: each saved ticker with its last price, day change, and a sparkline of the past month.

![The home screen signed in, showing a watchlist of four tickers with prices and sparklines](images/home_page_logged_in.png)

### 4. Find a company

Typeahead over Yahoo's search, filtered to equities — ETFs, indices and currencies never appear, because every page behind this one is built on company filings.

![The search field with "MET" typed, showing MetLife, Meta Platforms and other matches](images/search.png)

### 5. The stock page

Everything about one company on a single screen: quote and day range, price history, an AI summary of what the business does, financial statements and recent news. The star beside the ticker adds it to the watchlist; the assistant sits in the dock at the bottom, scoped to this company.

![The full stock page for Meta Platforms](images/stock_page.png)

The blocks that make it up:

**Overview and news** — 52-week range, market cap, shares outstanding and beta from [Finnhub](#finnhub), alongside recent articles from Yahoo.

![Company overview panel and the recent-news rail](images/feature_stock_overview.png)

**Price history** — daily bars over 1M, 6M, 1Y, 5Y or the full listed history, with the change over the selected window stated in the heading.

![The price chart on its MAX range](images/feature_price_chart.png)

**What the company does** — an LLM summary of the business section of the latest 10-K, [cached against that filing's accession number](#database) so it is written once per filing rather than once per visit.

![The AI-written business summary for Meta](images/feature_ai_summary.png)

**Financial statements** — income statement, balance sheet and cash flow, each as flat rows by period. Headline subtotals (revenue, net income, income from operations) are highlighted through [an allowlist of XBRL standard concepts](#financial_data--financial-statements), not by pattern-matching the company's own wording.

![The income statement tab, with revenue and net income highlighted](images/feature_fin_stmt.png)

### 6. Ask the assistant

The assistant opens with three starter questions and a text field scoped to the ticker. Past conversations for this company are behind the Conversations menu.

![The assistant panel with three suggested questions](images/chatbot_start.png)

Research takes a while, so the graph reports what it is doing — *Thinking…* while the supervisor plans, *Gathering data…* while workers pull filings and financials. See [Agentic pipeline](#agentic-pipeline) for what runs behind each label.

![The assistant showing a "Thinking…" status under the user's question](images/chatbot_status_updates.png)

The answer streams in token by token, grounded in what the workers actually retrieved and citing the filings it came from.

![A streamed answer explaining Meta's business and revenue model, citing the 2025 10-K and Q2 2026 10-Q](images/chatbot_response.png)
