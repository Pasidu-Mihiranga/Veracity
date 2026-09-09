# Veracity

<div align="center">

```
 __      __                     _ _         
 \ \    / /                    (_) |        
  \ \  / /__ _ __ __ _  ___ _ _| |_ _   _ 
   \ \/ / _ \ '__/ _` |/ __| | | __| | | |
    \  /  __/ | | (_| | (__| | | |_| |_| |
     \/ \___|_|  \__,_|\___|_|_|\__|\__, |
                                     __/ |
                                    |___/ 
```

**Autonomous Market Intelligence & Competitive Strategy System of Record**

[![Next.js 15](https://img.shields.io/badge/Next.js-15.4.9-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2.1-blue?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.1.11-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash_/_Pro-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)
[![LangGraph](https://img.shields.io/badge/Orchestration-LangGraph_/_Custom_Agent_Engine-FF6F00?style=flat-square)](https://langchain.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_+_pgvector-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Inngest](https://img.shields.io/badge/Jobs-Inngest_Workflows-6366F1?style=flat-square)](https://www.inngest.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

*Know what changed, prove every claim with real web citations, simulate stakeholder impact, and generate boardroom-ready execution playbooks.*

---

[Executive Overview](#executive-overview) • [Why Veracity](#why-veracity-vs-generic-chatbots) • [System Architecture](#system-architecture) • [How It Works](#how-the-system-works) • [Technology Stack](#currently-available-technology-stack) • [Core Capabilities](#core-capabilities) • [Project Structure](#project-structure) • [Getting Started](#getting-started) • [Testing & Quality](#testing--verification)

---

</div>

## Executive Overview

**Veracity** is an autonomous market intelligence engine and system of record for enterprise competitive decision-making. 

Instead of treating market intelligence as a one-shot query to an LLM, Veracity combines:
1. **Deterministic Web Evidence Ledger**: Content-hashed snapshots (`sha256`) of real competitor sources (pricing, features, hiring, changelogs) with **zero-hallucination citation enforcement**.
2. **6 Specialized Research Agents Running in Parallel**: Autonomous agents independently investigating market trends, feature matrix, pricing/packaging, positioning, win/loss dynamics, and adjacent disruptors.
3. **Continuous Change Detection & Watchlists**: Automated crawler jobs that compare historical snapshots against live web data, calculate deterministic materiality scores (0–100), and trigger proactive executive alerts.
4. **Time-Series Sector Radar**: 8-month historical tracking of market movements, competitor price changes, and capability launches.
5. **Synthetic Swarm Decision Lab (MiroFish Integration)**: Multi-persona stakeholder simulations (enterprise buyers, developers, procurement leads) to stress-test GTM moves prior to execution.
6. **Executive Board Briefs & Actionable Playbooks**: Generates PDF board packs, role-based recommendations (CTO, CMO, VP Sales), and ready-to-test A/B messaging variants.

---

## Why Veracity vs Generic Chatbots

General AI assistants (ChatGPT, Claude, Perplexity, Gemini) are powerful for ad-hoc generation, but **structurally incapable of enterprise market tracking** because they lack temporal state and deterministic verification.

```
+-----------------------------------------------------------------------------------+
|  "PickMe raised its base tuk fare from LKR 300 to LKR 350 on Aug 3.               |
|   Here is the exact sentence and URL. Uber Sri Lanka did not move pricing."      |
+-----------------------------------------------------------------------------------+
```
*No standard chatbot can surface this unprompted — because none of them continuously watch, snapshot, and diff the web.*

| Feature / Dimension | Generic AI Chatbot | Standard Scraping Tool | Veracity Intelligence Engine |
|---|---|---|---|
| **Temporal Memory** | ❌ No (resets per chat) | ⚠️ Dumps raw text | ✅ **8-month time-series radar & versioned snapshots** |
| **Change Detection** | ❌ Cannot detect delta | ⚠️ Raw diff only | ✅ **Deterministic materiality scoring (0-100)** |
| **Evidence Grounding** | ⚠️ Plausible hallucinations | ❌ No reasoning | ✅ **Strict DB-enforced quotes & source hashing** |
| **"No Data" Honesty** | ❌ Fills gaps with guesses | ❌ Raw null | ✅ **Explicitly outputs "No source found"** |
| **Multi-Agent Depth** | ❌ Single generic prompt | ❌ No intelligence | ✅ **6 parallel specialist agents + synthesis** |
| **Cost Optimization** | ❌ Full LLM call every prompt | n/a | ✅ **Content-hash short-circuit (0 LLM cost if unchanged)** |
| **Executive Output** | ⚠️ Bullet point text | ❌ Raw table | ✅ **Boardroom brief, Recharts, PDF export & GTM playbook** |
| **Scenario Testing** | ❌ Generic advice | ❌ No simulation | ✅ **Synthetic stakeholder swarm simulation** |

---

## System Architecture

Veracity is designed as a high-throughput, fault-tolerant, modular system. Below is the end-to-end architecture diagram:

```mermaid
flowchart TB
    subgraph PresentationLayer["1. Presentation & Interaction Layer"]
        UI["Next.js 15 + React 19 Frontend"]
        DASH["Executive Hub & Sector Radar"]
        BOARD["Executive Board Brief & Decision Matrix"]
        SSE_CLIENT["Live SSE Stream Listener (Real-Time Agent Wave)"]
        CHARTS["Recharts & Spline 3D Visualizer"]
        PDF["@react-pdf/renderer Board Pack Exporter"]
    end

    subgraph APIGateway["2. API Gateway & Middleware Layer"]
        AUTH["Auth & Session Management (JWT / HTTP-Only Cookie)"]
        RATE["Upstash Redis Rate Limiting"]
        ROUTER["Intent Classifier & Research Workflow Dispatcher"]
        OBS["OpenTelemetry + Sentry + JSON Logger"]
    end

    subgraph AgentOrchestration["3. Multi-Agent Intelligence Core"]
        ORCH["TypeScript Orchestrator / LangGraph Engine"]
        
        subgraph SpecializedAgents["Parallel Agent Swarm (Fan-Out)"]
            A1["Market Trends Agent\n(Regulatory, Macro Shifts)"]
            A2["Competitive Landscape Agent\n(Feature Matrices, Gaps)"]
            A3["Pricing & Packaging Agent\n(Tariffs, WTP Dynamics)"]
            A4["Positioning Agent\n(Narrative, Messaging Shifts)"]
            A5["Win/Loss Agent\n(Switching Friction, Churn)"]
            A6["Adjacent Threats Agent\n(Disruptors, New Entrants)"]
        end

        SYNTH["Cross-Agent Synthesis Engine & Fact Validator"]
        SWARM["Swarm Decision Lab (MiroFish Persona Sim)"]
        EXEC["GTM Strategy & Execution Playbook Generator"]
    end

    subgraph IngestionVerification["4. Ingestion & Grounding Ledger"]
        QPLAN["Query Planner & Multi-Source Search"]
        TOOLS["Live Connectors:\nFirecrawl | SerpAPI | Apify | Reddit & HN"]
        HASHER["SHA-256 Content Hasher & Delta Detector"]
        GROUND["Zero-Hallucination Evidence Binder"]
    end

    subgraph PersistenceAsync["5. Persistence & Background Services"]
        PG["PostgreSQL Database"]
        PGV["pgvector (Semantic Memory & Embeddings)"]
        REDIS["Upstash Redis Cache"]
        INNGEST["Inngest Event Workers (Continuous Watchlist Crawls)"]
    end

    %% Flow Connections
    UI --> APIGateway
    APIGateway --> AgentOrchestration
    ORCH --> SpecializedAgents
    SpecializedAgents --> IngestionVerification
    IngestionVerification --> PersistenceAsync
    SpecializedAgents --> SYNTH
    SYNTH --> SWARM
    SYNTH --> EXEC
    SYNTH --> SSE_CLIENT
    SSE_CLIENT --> UI
    INNGEST --> IngestionVerification
    INNGEST --> PG
```

---

## Multi-Agent Execution Lifecycle

When an executive inputs a question or selects two enterprise competitors (e.g., *Dialog Axiata vs. SLT-Mobitel* or *PickMe vs. Uber*), the system executes a structured multi-stage workflow:

```mermaid
sequenceDiagram
    autonumber
    actor User as Executive / Analyst
    participant Hub as Executive Hub (UI)
    participant Route as Intent Router
    participant Orch as Agent Orchestrator
    participant Tools as Tool Ingestion Hub
    participant Agents as 6 Parallel Agents
    participant Synth as Synthesis & Fact Binder
    participant Miro as Swarm Decision Lab
    participant DB as PostgreSQL + pgvector

    User->>Hub: Enters Query / Selects Competitors
    Hub->>Route: POST /api/chat (SSE Connection)
    Route->>Orch: Classify Intent & Plan Investigation
    
    rect rgb(240, 245, 255)
        Note over Orch,Agents: 10-Second Parallel Research Wave
        par Agent 1: Market Trends
            Orch->>Tools: Discover Industry & Regulatory Data
            Tools->>Agents: Extracted Sources
        and Agent 2: Competitive Matrix
            Orch->>Tools: Fetch Product Docs & Feature Lists
            Tools->>Agents: Extracted Sources
        and Agent 3: Pricing & Packaging
            Orch->>Tools: Crawl Pricing Pages & Tier Tables
            Tools->>Agents: Extracted Sources
        and Agent 4: Positioning & Messaging
            Orch->>Tools: Parse Value Props & Campaigns
            Tools->>Agents: Extracted Sources
        and Agent 5: Win/Loss Dynamics
            Orch->>Tools: Search Community Signals (Reddit/HN)
            Tools->>Agents: Extracted Sources
        and Agent 6: Adjacent Threats
            Orch->>Tools: Search Substitute Tech & New Players
            Tools->>Agents: Extracted Sources
        end
    end

    Agents-->>Hub: Stream Live Progress Events (SSE)
    Agents->>Synth: Return Structured AgentOutputs + Source Citations
    
    rect rgb(245, 255, 245)
        Note over Synth,DB: Deterministic Evidence Binding
        Synth->>DB: Check Content Hashes & Save Evidence Ledger
        Synth->>Synth: Validate Claim Grounding (Filter unverified claims)
    end

    opt Scenario Stress-Testing
        Synth->>Miro: Simulate Buyer / Stakeholder Responses
        Miro-->>Synth: Return Persona Sentiment & Probability Distributions
    end

    Synth->>Hub: Stream Completed Board Brief, Decision Matrix & Playbook
    Hub->>User: Displays Interactive Report + PDF Export Ready
```

---

## Continuous Intelligence & Watchlist Engine

Veracity operates continuously in the background via automated Inngest workers.

```mermaid
flowchart LR
    subgraph Schedule["1. Scheduled Inngest Cron"]
        CRON["Watchlist Trigger\n(Hourly / Daily)"]
    end

    subgraph Crawler["2. Source Ingestion"]
        FC["Firecrawl / Apify\nPage Scraper"]
        NORM["HTML Normalizer\n& Sanitizer"]
        HASH["SHA-256\nHash Calculation"]
    end

    subgraph DeltaEngine["3. Deterministic Delta Engine"]
        COMP{"Hash Matches\nPrevious Snapshot?"}
        SHORT["Short-Circuit\n(0 LLM Cost, No Drift)"]
        DIFF["Extract Text & Metric Diff\n(Pricing, Tiers, Claims)"]
        SCORE["Materiality Scorer\n(0–100 Weighted Score)"]
    end

    subgraph Output["4. Delivery & Alerting"]
        ALERT["Executive Alert Card\n(Triggered if Score >= 60)"]
        TIMELINE["Sector Radar History Updated"]
    end

    CRON --> FC --> NORM --> HASH --> COMP
    COMP -- Yes --> SHORT
    COMP -- No --> DIFF --> SCORE
    SCORE --> ALERT
    SCORE --> TIMELINE
```

---

## Currently Available Technology Stack

| Layer / Domain | Technology | Purpose & Implementation Details |
|---|---|---|
| **Core Framework** | **Next.js 15.4.9 (App Router)** | Full-stack architecture with React Server Components, Server-Sent Events (SSE), API route handlers, and middleware session checks. |
| **UI Library & State** | **React 19.2.1** | Modern component tree, optimistic updates, React hooks, and `@tanstack/react-query` for high-performance caching. |
| **Styling & Motion** | **Tailwind CSS v4.1.11** + **Motion (Framer)** | Custom dark/light mode design tokens, glassmorphism, micro-animations, and CSS container queries. |
| **3D & Visual Graphics** | **Spline 3D (`@splinetool/react-spline`)** | Interactive 3D visual elements in hero and presentation views. |
| **Data Visualization** | **Recharts 3.8.0** | Time-series market trends, competitor metric comparison charts, and historical price shift graphs. |
| **AI LLM Engine** | **Google Gemini (`@google/genai`)** | Powered by Gemini 2.5 Flash / Pro for high-speed multimodal reasoning, structured JSON outputs, and token-efficient synthesis. |
| **Multi-Agent Orchestration** | **TypeScript Orchestrator + LangGraph Core** | Parallel fan-out architecture (`lib/agents/orchestrator.ts`), dynamic intent routing, step streaming, and fault-tolerant degradation. |
| **Live Web Scraping & Ingestion** | **Firecrawl API**, **SerpAPI**, **Apify**, **Reddit & HN APIs** | Real-time URL discovery, clean markdown extraction, community sentiment mining, and proxy management. |
| **Database & Vector Memory** | **PostgreSQL** + **pgvector** + **Supabase** | Relational tables for sessions, entities, watchlists, decisions, and vector embeddings for contextual memory recall. |
| **Background Queues & Cron** | **Inngest 4.13.0** | Durable execution workflows, continuous watchlist monitoring, automated competitor change polling, and webhook handlers. |
| **Caching & Rate Limiting** | **Upstash Redis** + **@upstash/ratelimit** | Sliding window rate-limiting for API protection and fast cache hits. |
| **Document Exporting** | **@react-pdf/renderer 4.5.1** + **docx 9.7.1** | One-click export to boardroom-ready PDF briefs and Microsoft Word reports. |
| **Observability & Telemetry** | **OpenTelemetry**, **Sentry 10.67**, **PostHog** | End-to-end request tracing, error monitoring, user interaction analytics, and custom structured JSON logs. |
| **Testing & Quality Assurance** | **Vitest 4.1**, **Playwright 1.57**, **TypeScript 5.9** | Unit tests, integration test suite, output quality validation gates, and end-to-end browser tests. |

---

## Core Capabilities

### 1. Multi-Agent Research Swarm
Launches 6 specialized agents simultaneously to dissect any competitive scenario:
- **Market Trends**: Analyzes macroeconomic growth, industry adoption curves, and regulatory mandates.
- **Competitive Landscape**: Builds side-by-side feature comparisons, capability depth, and product gaps.
- **Pricing & Packaging**: Detects pricing tier shifts, free-to-paid gates, base rate updates, and unit economics.
- **Positioning & Messaging**: Evaluates target buyer personas, value propositions, and messaging pivots.
- **Win/Loss Intelligence**: Uncovers why customers switch, contract churn reasons, and procurement friction.
- **Adjacent Market Collision**: Identifies outside entrants, horizontal software expansions, and substitute risks.

### 2. Deterministic Evidence Ledger & Zero-Hallucination Guarantee
- Every single metric, price tag, or market claim is validated against raw extracted source text.
- If a data point is missing from public sources, Veracity strictly renders **"No source found"** rather than hallucinating an estimated number.
- All scraped source snapshots are stored with their cryptographic SHA-256 hash.

### 3. Continuous Watchlists & Materiality Engine
- Users can create watchlists for target competitor domains (e.g. `dialog.lk`, `mobitel.lk`, `pickme.lk`).
- Scheduled Inngest jobs check sites periodically:
  - If content hash is unchanged $\to$ Immediate zero-cost short-circuit.
  - If content hash changed $\to$ Computes metric diff, scores impact (0–100), and creates an alert.

### 4. Sector Radar (8-Month Historical Memory)
- Displays historical timelines of competitor moves across past quarters.
- Visualizes feature rollouts, pricing escalations, and messaging shifts over time.

### 5. Swarm Decision Lab (MiroFish Integration)
- Evaluates GTM strategies against simulated stakeholder personas (e.g., Enterprise CFO, Senior DevOps Engineer, Procurement Officer).
- Predicts acceptance probabilities, objection patterns, and customer friction prior to actual rollout.

### 6. Strategy Playbook & Execution Engine
- Converts research findings into concrete GTM action items.
- Automatically generates A/B landing page copy variants, targeted cold outreach scripts, and role-based assignments.

---

## Project Structure

```
Verasity/
├── SYSTEM_OVERVIEW_AND_PITCH.md      # Executive presentation guide & live demo pitch script
└── Veracity/                          # Full-Stack Application
    ├── app/                           # Next.js 15 App Router
    │   ├── api/                       # 30+ REST & Streaming API Route Handlers
    │   │   ├── chat/                  # Multi-agent streaming research endpoint (SSE)
    │   │   ├── watchlists/            # Continuous monitoring & alert APIs
    │   │   ├── inngest/               # Inngest background event handlers
    │   │   ├── decisions/             # Decision frame & policy endpoints
    │   │   └── export/                # PDF & DOCX generation routes
    │   ├── auth/                      # Authentication views (Login, Demo User, OAuth)
    │   ├── globals.css                # Tailwind v4 theme variables & design tokens
    │   ├── layout.tsx                 # Root application layout
    │   └── page.tsx                   # Main Executive Hub dashboard
    ├── components/                    # Modular React 19 UI Components
    │   ├── artifacts/                 # Dynamic artifact renderers (Matrices, Charts, Maps)
    │   ├── ui/                        # Design system components (Chat, Radar, Watchlists)
    │   └── visual/                    # 3D Spline canvases, motion animations, icons
    ├── lib/                           # Core Business Logic & Infrastructure
    │   ├── agents/                    # Multi-agent orchestration engine & 6 specialists
    │   │   ├── orchestrator.ts        # Agent fan-out coordinator & lifecycle manager
    │   │   ├── classify.ts            # Dynamic intent classification
    │   │   ├── synthesize.ts          # Cross-agent synthesis & fact binding
    │   │   └── prompts/               # Structured agent prompt templates
    │   ├── tools/                     # Live ingestion tools (Firecrawl, SerpAPI, Apify, etc.)
    │   ├── continuous-intelligence/   # Watchlist delta detection & materiality scoring
    │   ├── export/                    # @react-pdf/renderer board pack template
    │   ├── inngest/                   # Inngest background job definitions
    │   └── db.ts                      # PostgreSQL & pgvector client connection pool
    ├── db/                            # Database Schema & Migrations
    │   ├── schema.sql                 # Core database schema (sessions, entities, sources)
    │   └── migrations/                # Versioned SQL migrations
    ├── docs/                          # Architecture, ADRs, Plans & Roadmaps
    │   ├── architecture/              # Technical architecture documentation & ADRs
    │   ├── prd.md                     # Product requirements document
    │   └── PRODUCT_FIRST_MARKET...    # Market research and strategic roadmap
    ├── mirofish-service/              # Swarm simulation service (Python FastAPI)
    ├── scripts/                       # Database seed scripts, quality validators, smoke tests
    ├── __tests__/                     # Vitest unit and integration test suite
    ├── e2e/                           # Playwright end-to-end tests
    ├── package.json                   # Project dependencies and npm scripts
    └── tsconfig.json                  # TypeScript 5.9 configuration
```

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `>= 20.12.0`
- **npm**: `>= 10.0.0`
- **PostgreSQL**: `>= 15.0` (with `pgvector` extension enabled, or use Supabase)
- **Python**: `>= 3.11` (optional, only if running local MiroFish swarm server)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/veracity.git
cd veracity/Veracity
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# Core LLM Engine
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Database Connection (Local PostgreSQL or Supabase)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veracity
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Authentication
AUTH_SECRET=generate_a_secure_random_32_char_secret_here

# Live Research Ingestion Tools (At least one recommended for live search)
SERPAPI_API_KEY=your_serpapi_key
FIRECRAWL_API_KEY=your_firecrawl_key
APIFY_API_TOKEN=your_apify_token

# Background Queues (Optional for local dev, required for continuous watchlists)
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

# Rate Limiting (Optional)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

### 3. Setup Database & Seed Demo Data

Veracity ships with rich enterprise demo data (Ride-Hailing, Telecom, Tea Export, Apparel Manufacturing):

```bash
# 1. Run database migrations
npm run db:migrate

# 2. Seed development user and demo datasets
npm run dev:seed
npm run seed:demo
npm run seed:watchlists
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Click **"Demo user"** on `/auth` to instantly enter the workspace pre-loaded with live enterprise sector radars and watchlists.
- Type any query or click any comparison button (e.g., *Dialog vs. SLT-Mobitel*) to watch the 6-agent wave execute in real-time.

---

## Available NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server on `http://localhost:3000` |
| `npm run dev:full` | Concurrently starts Next.js and the Python MiroFish swarm service |
| `npm run build` | Builds the production bundle with type checking |
| `npm run typecheck` | Runs TypeScript compiler validation without emitting files (`tsc --noEmit`) |
| `npm run lint` | Lints codebase using ESLint 9 |
| `npm test` | Runs all Vitest unit and integration tests |
| `npm run test:quality` | Validates agent output quality, citation accuracy, and grounding rules |
| `npm run test:e2e:market-project` | Executes Playwright end-to-end browser tests for Market Projects |
| `npm run seed:demo` | Seeds full enterprise comparison dataset |
| `npm run seed:watchlists` | Seeds active competitor watchlists and alert items |
| `npm run db:migrate` | Applies all versioned SQL migrations to the configured database |

---

## Testing & Verification

Veracity maintains strict test suites and automated quality gates:

```bash
# 1. Static Type Checking
npm run typecheck

# 2. Unit & Integration Tests (Vitest)
npm test

# 3. Output Quality & Zero-Hallucination Verification
npm run test:quality

# 4. Intent Classification Router Tests
npm run test:router

# 5. Full Regression Suite
npm run test:regression
```

---

## Security & Enterprise Governance

- **Tenant Isolation**: All queries, watchlists, decisions, and memory vectors are strictly scoped by `workspace_id` and `user_id`.
- **RBAC (Role-Based Access Control)**: Enforces role permissions (`Owner`, `Admin`, `Analyst`, `Viewer`) on sensitive data and exports.
- **Secure Authentication**: Uses encrypted HTTP-only cookie JWTs and supports Enterprise SSO / OAuth providers.
- **Data Protection**: API rate-limiting via Upstash Redis prevents denial-of-service and quota exhaustion.
- **Audit Logging**: Every agent step, tool call, database read, and user feedback interaction is logged with unique correlation IDs (`x-correlation-id`).

---

<div align="center">

**Veracity** — *Autonomous Market Intelligence & Competitive Strategy*

Built with precision for modern enterprise leaders.

</div>
