# STSK - Shotokan Karate Academy Platform

A mobile-first, serverless web application for karate dojos to manage student roll-calls, calendar-month tuition tracking, student profiles, and public announcements. Built with Next.js 16 (App Router) on Vercel and MongoDB Atlas M0.

---

## 🥋 Core Features

- **Public Edge Notice Board (`/`)**: Edge-cached announcements, holiday closures, and belt grading schedules (`revalidate = 300`) with zero database connection consumption.
- **Mobile-First Roll-Call (`/dashboard/attendance`)**: Touch-optimized side-by-side `[ ✅ Present ]` / `[ ❌ Absent ]` buttons (min 48px), tactile vibration feedback (`navigator.vibrate`), 5-second interactive Undo toast, and in-memory offline queueing.
- **Calendar-Month Tuition Ledger (`/dashboard/fees`)**: Global month cycle switcher (`< YYYY-MM >`) with single-tap `[ PAID ]` / `[ UNPAID ]` toggles and historical payment ledger drawer.
- **Searchable Roster (`/dashboard/students`)**: Sub-5ms instant in-memory search, belt filters, required/remaining class tallies, and Add/Edit student drawers.
- **Bulk Onboarding via CSV (`/dashboard/settings`)**: Client-side CSV parser with live 5-row preview and atomic `POST /api/students/batch` insertion.
- **Disaster Recovery**: One-tap manual JSON export in dashboard settings + automated weekly GitHub Actions `mongodump` workflow.

---

## 📋 Prerequisites

- **Node.js**: v20+ (tested through v26)
- **Package Manager**: `pnpm` (v9+)
- **Database**: MongoDB Atlas (Free Tier M0) or local MongoDB 5+

---

## 🛠️ Quick Start & Running Locally

### 1. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Ensure your `.env` contains:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/stsk?retryWrites=true&w=majority
SESSION_SECRET=your-32-character-secret-key-goes-here-replace-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeThisToAStrongPassword123
NODE_ENV=development
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Provision Admin Account (Optional)

```bash
pnpm seed
```

*(Note: Even if you skip this step, the login API automatically lazy-seeds the admin user on the first login attempt if the `users` collection is empty).*

### 4. Start the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- `/` &rarr; Public Edge-cached Notice Board
- `/login` &rarr; Instructor Login
- `/dashboard` &rarr; Instructor Dashboard (Students, Roll-Call, Fees, Notices, Settings)

---

## 🧪 Testing & Verification

Run the full Vitest suite (29 unit and integration tests):

```bash
pnpm test
```

### Production Build

```bash
pnpm build
pnpm start
```

---

## 📁 Repository Structure

```text
stsk/
├── .github/workflows/
│   └── backup.yml                         # Automated weekly mongodump backup
├── package.json                           # Unified root scripts (dev, build, test, seed)
├── .env.example                           # Documented environment variables template
├── docs/designs/
│   └── consolidated_nextjs_dashboard.md   # Official system architecture specification
└── apps/web/
    ├── app/
    │   ├── page.tsx                       # Public notice-board with ISR (revalidate=300)
    │   ├── login/page.tsx                 # Mobile-friendly instructor login
    │   ├── dashboard/
    │   │   ├── layout.tsx                 # Mobile bottom navigation dock
    │   │   ├── students/page.tsx          # Fast search & student profile manager
    │   │   ├── attendance/page.tsx        # Mat-side roll-call with 5s Undo
    │   │   ├── fees/page.tsx              # Monthly tuition ledger & history drawer
    │   │   ├── notices/page.tsx           # Announcements manager with edge purge
    │   │   └── settings/page.tsx          # CSV bulk uploader & JSON export button
    │   └── api/                           # Consolidated serverless API route handlers
    ├── lib/
    │   ├── db.ts                          # Cached Mongoose singleton (maxPoolSize=10)
    │   ├── session.ts                     # Edge-compatible JWT via jose
    │   ├── auth.ts                        # Password hashing via bcryptjs
    │   ├── models/                        # Mongoose data schemas (stsk, attendance, tuition, notices, users)
    │   └── services/                      # Deep domain engines (AttendanceEngine, TuitionLedger, StudentImporter)
    └── test/                              # Vitest unit and integration test suite
```
