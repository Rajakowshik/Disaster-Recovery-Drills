<div align="center">

# 🛡️ DR Drill Walkthrough Agent

**A production-grade Disaster Recovery drill execution platform for SRE teams**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)

*Automated runbook execution · RTO compliance tracking · AI-powered audit reports · SOC 2 / ISO 27001 ready*

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Workflow](#core-workflow)
- [Technology Stack](#technology-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database & Storage Architecture](#database--storage-architecture)
- [API Reference](#api-reference)
- [Role-Based Access Control](#role-based-access-control)
- [Infrastructure Simulation](#infrastructure-simulation)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Load Testing](#load-testing)

---

## Overview

The **DR Drill Walkthrough Agent** is a full-stack SRE platform that automates the execution of Disaster Recovery (DR) runbooks. It simulates multi-node PostgreSQL infrastructure, executes step-by-step recovery procedures with real OS-level tooling, tracks RTO (Recovery Time Objective) compliance per step, and generates AI-powered compliance audit reports — all from a single web dashboard.

### Key Capabilities

| Capability | Description |
|---|---|
| **Runbook Management** | Create, upload (PDF/DOCX/Markdown), and manage DR runbooks with structured step definitions |
| **Drill Execution** | Execute runbooks step-by-step with real shell script integration and evidence collection |
| **RTO Compliance** | Per-step timing tracked against defined RTO targets with a live compliance ratio |
| **AI Audit Reports** | Gemini-powered executive + technical compliance summaries with SOC 2 / ISO 27001 checklists |
| **Infrastructure Simulation** | In-memory emulation of postgres-primary, postgres-backup, and postgres-audit nodes |
| **Failover Orchestration** | Automated primary-to-backup database promotion with recovery time measurement |
| **Audit Trail** | Immutable log of every user action, drill event, and system state change |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DR Drill Agent Platform                         │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     React Frontend (Vite + Tailwind)             │  │
│  │   Dashboard │ Runbooks │ Drills │ Reports │ Audit │ Admin        │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                               │ REST API (JWT Auth)                     │
│  ┌────────────────────────────▼─────────────────────────────────────┐  │
│  │                    Express + TypeScript Server                    │  │
│  │                                                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │ Auth Module  │  │ Drill Engine │  │  Gemini AI Integration │  │  │
│  │  │ JWT + bcrypt │  │ Step Runner  │  │  Report Generation     │  │  │
│  │  └─────────────┘  └──────┬───────┘  └────────────────────────┘  │  │
│  │                          │                                        │  │
│  │  ┌───────────────────────▼──────────────────────────────────┐   │  │
│  │  │              3-Tier Storage Abstraction Layer             │   │  │
│  │  │  Supabase (cloud) → SQLite (local) → JSON files (always) │   │  │
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  Tool Execution Engine                            │  │
│  │  check_network.py │ stop_primary_replica.py │ failover_processor │  │
│  │  dns_switchover.py │ verify_db_rw.js                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ postgres-    │  │ postgres-    │  │ postgres-    │  │  Redis   │  │
│  │ primary:5432 │  │ backup:5433  │  │ audit:5434   │  │  :6379   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Workflow

The platform executes DR runbooks through a structured 5-phase lifecycle:

```
Phase 1: RUNBOOK LOADED
        │
        │  Admin/Operator selects a runbook and starts a drill
        ▼
Phase 2: STEP EXECUTION (repeats per step)
        │
        ├──► Tool function called (check_network / stop_primary_replica /
        │    failover_database / verify_read_write / dns_switchover)
        │
        ├──► Actual OS-level script executed (Python / Node.js)
        │
        ├──► Execution time measured vs RTO target
        │
        ├──► Evidence artifact written to disk (JSON per step)
        │
        └──► Infra state updated (container status, activeDatabase pointer)
        │
        ▼
Phase 3: DRILL COMPLETE (SUCCESS / FAILURE / ABORTED)
        │
        ▼
Phase 4: COMPLIANCE REPORT GENERATION
        │
        ├──► Step pass/fail counts aggregated
        ├──► RTO compliance % calculated
        ├──► Gemini AI generates executive + technical summaries
        └──► SOC 2 CC7.3 / ISO 27001 A.17 checklist evaluated
        │
        ▼
Phase 5: AUDIT TRAIL ENTRY
        └──► Immutable audit log entry written with user, role, action, IP
```

### Step Execution State Machine

Each drill step transitions through the following states:

```
PENDING ──► RUNNING ──► SUCCESS
                    └──► FAILURE
                    └──► SKIPPED
```

### Failover Flow (Database DR Steps)

```
postgres-primary RUNNING
        │
        │  stop_primary_replica
        ▼
postgres-primary STOPPED ──► primaryFailureDetectedAt = now
        │
        │  failover_database
        ▼
postgres-backup ACTIVE (activeDatabase = 'backup')
        │    recoveryDurationS = now - primaryFailureDetectedAt
        │    rtoCompliance = recoveryDurationS ≤ 10s ? 100% : 70%
        │
        │  verify_read_write
        ▼
Heartbeat check on postgres-backup ──► VERIFIED
        │
        │  dns_switchover
        ▼
DNS records updated ──► DR Complete
```

---

## Technology Stack

### Frontend
| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Styling | Tailwind CSS v4 |
| Build Tool | Vite 6 |
| Charts | Recharts |
| Animations | Motion (Framer Motion) |
| Icons | Lucide React |
| Language | TypeScript 5.8 |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Language | TypeScript 5.8 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| AI | Google Gemini SDK (`@google/genai`) |
| File Uploads | Multer |
| Document Parsing | Mammoth (DOCX) + pdf-parse (PDF) |

### Infrastructure & Storage
| Component | Technology |
|---|---|
| Cloud DB | Supabase (PostgreSQL via REST) |
| Local DB | SQLite3 |
| Fallback | JSON flat files |
| Cache / Rate Limit | Redis 7 |
| Monitoring | Prometheus + Grafana |
| Containers | Docker Compose |

### Tool Scripts
| Script | Runtime | Purpose |
|---|---|---|
| `check_network.py` | Python 3 | TCP port probe + HTTP health check |
| `stop_primary_replica.py` | Python 3 | Write OFFLINE state, optional Docker stop |
| `failover_processor.py` | Python 3 | Write PROMOTED state to local status file |
| `dns_switchover.py` | Python 3 | Write new DNS mapping to `dns_mapping.json` |
| `verify_db_rw.js` | Node.js | SQLite / JSON heartbeat read-write cycle |

---

## Features

### 🗂️ Runbook Management
- Create runbooks manually via the UI with custom steps
- Upload runbooks from **PDF**, **DOCX**, or **Markdown** files
- Gemini AI parses uploaded documents and extracts structured steps automatically
- Deterministic fallback parser if AI is unavailable
- Supported step functions: `check_network`, `stop_primary_replica`, `failover_database`, `verify_read_write`, `dns_switchover`

### ⚙️ Drill Execution Engine
- Sequential step-by-step execution with per-step RTO targets
- Real OS shell script execution via `child_process.exec`
- Supports failure injection mode (simulated outage for testing)
- Live drill status updates streamed to frontend via polling
- Prevents concurrent drill runs (one drill at a time)

### 📊 Compliance & Reporting
- Automatic calculation of: total steps, passed, failed, skipped, RTO met, RTO violations
- RTO compliance percentage per drill
- AI-generated executive summary (CTO-level prose)
- AI-generated technical SRE summary
- Auditor checklist against:
  - **SOC 2 CC7.3** – Continuous Resilience Auditing & Testing
  - **ISO 27001 A.17** – Information Security Continuity Validation
  - **RTO SLA** – ≥80% step-level compliance threshold
- Report caching (60s TTL) to prevent duplicate Gemini calls

### 🔍 Evidence Collection
- Per-step JSON evidence artifact written to `./evidence/` directory
- Each artifact captures: tool name, duration, exit code, stdout, stderr, host platform, SQLite integrity check

### 📈 System Metrics
- Prometheus-compatible metrics endpoint at `/api/system/metrics`
- Tracks: agent execution time avg, drill success rate, API latency, RTO compliance avg, active drills, rate limit hits, cache hit ratio, CPU & memory usage

---

## Project Structure

```
dr-drill-agent/
│
├── server.ts                    # Main Express server (2400+ lines)
├── server-supabase.ts           # Supabase adapter layer
├── vite.config.ts               # Vite build configuration
├── tsconfig.json                # TypeScript config
├── docker-compose.yml           # Full infra stack definition
├── prometheus.yml               # Prometheus scrape config
├── package.json
│
├── src/                         # React frontend source
│   ├── types/                   # Shared TypeScript interfaces
│   ├── components/              # UI components
│   └── ...
│
├── check_network.py             # DR tool: network verification
├── stop_primary_replica.py      # DR tool: primary isolation
├── failover_processor.py        # DR tool: backup promotion
├── dns_switchover.py            # DR tool: DNS record update
├── verify_db_rw.js              # DR tool: read-write heartbeat
│
├── runbooks.db.json             # Runbooks data store (JSON mode)
├── drills.db.json               # Drills data store (JSON mode)
├── compliance_reports.db.json   # Reports data store (JSON mode)
├── audit_trail.db.json          # Audit log (JSON mode)
├── users.db.json                # Users store (JSON mode)
├── documents.db.json            # Uploaded documents catalog
│
├── evidence/                    # Per-step execution artifacts
├── uploads/                     # Uploaded runbook documents
│
├── k6-stress.js                 # k6 load testing script
└── .env.example                 # Environment variable template
```

---

## Database & Storage Architecture

The platform uses a **3-tier fallback storage system** — the same `dbRun` / `dbGet` / `dbAll` API transparently routes to the available storage layer:

```
Request → dbRun/dbGet/dbAll
               │
               ├── Supabase enabled? ──► Supabase REST API (cloud PostgreSQL)
               │
               ├── SQLite available? ──► dr_agent.db (local file)
               │
               └── Fallback (always) ──► JSON flat files
                                         runbooks.db.json
                                         drills.db.json
                                         compliance_reports.db.json
                                         audit_trail.db.json
                                         users.db.json
                                         documents.db.json
```

### Supabase Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  role TEXT NOT NULL,              -- Admin | Operator | Auditor | Viewer
  "createdAt" TEXT NOT NULL
);

-- Runbooks
CREATE TABLE runbooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  steps TEXT NOT NULL,             -- JSON array of RunbookStep
  "rawMarkdown" TEXT,
  "createdAt" TEXT NOT NULL
);

-- Drills
CREATE TABLE drills (
  id TEXT PRIMARY KEY,
  "runbookId" TEXT NOT NULL,
  "runbookTitle" TEXT NOT NULL,
  status TEXT NOT NULL,            -- RUNNING | SUCCESS | FAILURE | ABORTED
  "agentState" TEXT NOT NULL,
  "startedAt" TEXT NOT NULL,
  "completedAt" TEXT,
  steps TEXT NOT NULL,             -- JSON array (with status + duration per step)
  logs TEXT NOT NULL,              -- JSON array of log strings
  "rtoComplianceRatio" INTEGER NOT NULL
);

-- Compliance Reports
CREATE TABLE compliance_reports (
  "drillId" TEXT PRIMARY KEY,
  "drillTitle" TEXT NOT NULL,
  "totalSteps" INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  "rtoMet" INTEGER NOT NULL,
  "rtoViolations" INTEGER NOT NULL,
  "totalDuration" INTEGER NOT NULL,
  "rtoCompliancePercent" INTEGER NOT NULL,
  "isCompliant" BOOLEAN NOT NULL,
  "executiveSummary" TEXT,
  "technicalSummary" TEXT,
  "auditorChecklist" TEXT NOT NULL, -- JSON array
  "createdAt" TEXT NOT NULL
);

-- Audit Trail
CREATE TABLE audit_trail (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "userRole" TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  "drillId" TEXT,
  "ipAddress" TEXT NOT NULL
);

-- Documents
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  "fileName" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "uploadDate" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  path TEXT NOT NULL
);
```

---

## API Reference

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header (except `/api/auth/login`).

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with email + password, returns JWT |
| `POST` | `/api/auth/logout` | Logout (logs audit event) |
| `GET` | `/api/auth/me` | Get current user profile |

### Runbooks

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/runbooks` | Any | List all runbooks |
| `POST` | `/api/runbooks` | Admin / Operator | Create runbook manually |
| `POST` | `/api/runbooks/upload-document` | Admin / Operator | Upload PDF/DOCX for AI parsing |
| `POST` | `/api/runbooks/import-markdown` | Admin / Operator | Import raw Markdown runbook |
| `DELETE` | `/api/runbooks/:id` | Admin | Delete a runbook |

### Drills

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/drills` | Any | List all drills |
| `GET` | `/api/drills/:id` | Any | Get single drill with steps + logs |
| `POST` | `/api/drills/start` | Admin / Operator | Start a new drill from a runbook |
| `POST` | `/api/drills/:id/update` | Admin / Operator | Update drill state (agent step-by-step updates) |
| `POST` | `/api/drills/tools/execute` | Admin / Operator | Execute a single DR tool function |

### Reports

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| `POST` | `/api/reports/generate` | Admin / Operator / Auditor | Generate compliance report for a drill |
| `GET` | `/api/reports/:id` | Any | Fetch existing report by drill ID |

### System & Infrastructure

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/system/infrastructure` | Any | Get infra node status + active DB pointer |
| `GET` | `/api/system/metrics` | Any | Prometheus-compatible system metrics |
| `POST` | `/api/system/simulate-rate-limit` | Admin / Operator | Trigger rate limit simulation |
| `GET` | `/api/system/supabase-config` | Any | Get Supabase connection config |
| `POST` | `/api/system/supabase-config` | Any | Save and validate Supabase config |
| `GET` | `/api/health` | Public | Health check endpoint |

### Admin

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| `GET` | `/api/admin/users` | Admin | List all users |
| `POST` | `/api/admin/users` | Admin | Create a new user |
| `PUT` | `/api/admin/users/:id` | Admin | Update user role / details |
| `DELETE` | `/api/admin/users/:id` | Admin | Delete a user |

---

## Role-Based Access Control

| Action | Admin | Operator | Auditor | Viewer |
|---|:---:|:---:|:---:|:---:|
| View runbooks & drills | ✅ | ✅ | ✅ | ✅ |
| Start / execute drills | ✅ | ✅ | ❌ | ❌ |
| Create / upload runbooks | ✅ | ✅ | ❌ | ❌ |
| Generate compliance reports | ✅ | ✅ | ✅ | ❌ |
| View audit trail | ✅ | ❌ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Configure Supabase | ✅ | ❌ | ❌ | ❌ |
| Simulate rate limits | ✅ | ✅ | ❌ | ❌ |

### Default Users (Development)

| Email | Password | Role |
|---|---|---|
| `admin@dragent.com` | `adminpassword` | Admin |
| `operator@dragent.com` | `operatorpassword` | Operator |
| `auditor@dragent.com` | `auditorpassword` | Auditor |
| `viewer@dragent.com` | `viewerpassword` | Viewer |

> ⚠️ **Change all default passwords before any production deployment.**

---

## Infrastructure Simulation

The platform simulates a 3-node PostgreSQL cluster in-memory. No actual Docker containers are required to run the application — the server maintains container state in the `containerStates` object and routes DB operations accordingly.

### Simulated Nodes

| Node | Emulated Port | Role |
|---|---|---|
| `postgres-primary` | 5432 | Active read-write database (initial state) |
| `postgres-backup` | 5433 | Standby replica, promoted during failover |
| `postgres-audit` | 5434 | Audit log database |

### Failover State Transitions

```
containerStates.primary.status: RUNNING → STOPPED     (stop_primary_replica)
activeDatabase: 'primary' → 'backup'                   (failover_database)
containerStates.primary.status: STOPPED → RUNNING     (restore_primary)
activeDatabase: 'backup' → 'primary'                   (restore_primary)
```

### RTO Compliance Calculation

```
recoveryDurationS = (failover_complete_time - primary_stopped_time) / 1000

rtoCompliance = recoveryDurationS ≤ 10s ? 100% : 70%
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.8+
- npm or yarn

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/Rajakowshik/dr-drill-agent.git
cd dr-drill-agent

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# 4. Start the development server
npm run dev
```

The server starts at `http://localhost:3000`. The React frontend is served by Vite with HMR in development mode.

### JSON Mode (No External Dependencies)

The app runs **fully offline** using JSON flat files as the storage backend. No Supabase account, no Docker, no Redis needed for local development. All data persists in `*.db.json` files in the project root.

### With Docker (Full Stack)

```bash
# Set your Gemini API key first
export GEMINI_API_KEY=your_key_here

# Start all services (app + 3x PostgreSQL + Redis + Prometheus + Grafana)
docker-compose up -d

# View logs
docker-compose logs -f app
```

Services available:
- App: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3100` (admin / `sre_grafana_pass`)

---

## Environment Variables

```env
# Required for AI features
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: JWT secret (defaults to built-in dev key)
JWT_SECRET=your_custom_jwt_secret

# Optional: Node environment
NODE_ENV=development
PORT=3000
```

> **Never commit your `.env.local` file or `supabase_config.json` with real credentials.**

---

## Load Testing

The project includes a [k6](https://k6.io) stress test script that simulates realistic SRE traffic patterns:

```bash
# Install k6 (https://k6.io/docs/getting-started/installation/)
# Then run:
k6 run k6-stress.js
```

### Test Scenarios

| Stage | Duration | Virtual Users | Simulates |
|---|---|---|---|
| Ramp up | 30s | 10 | Typical SRE team querying runbooks |
| Sustained load | 1m | 100 | Active audit review session |
| Stress | 1m | 1000 | Extreme concurrent access |
| Cool down | 30s | 0 | Graceful wind-down |

### Performance Thresholds

- P95 response time: **< 150ms**
- Error rate: **< 1%**

---

## Compliance Standards

| Standard | Control | Validation |
|---|---|---|
| SOC 2 | CC7.3 – Continuous Resilience Auditing | Each drill execution logged with evidence artifacts |
| ISO 27001 | A.17 – Information Security Continuity | Full read-write transaction cycle verified per drill |
| Internal RTO SLA | ≥80% of steps must meet their RTO target | Calculated and enforced in every compliance report |

---

<div align="center">
Built with ☕ and a healthy respect for production outages.
</div>
