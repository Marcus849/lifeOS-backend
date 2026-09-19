# LifeOS Backend

A standalone Fastify + SQLite API for LifeOS. This folder is intentionally self-contained and can be moved into its own `lifeOS-backend` repository.

## Requirements

- Node.js 20+
- npm 10+ (pnpm also works)

## Start independently

```bash
cp .env.example .env
npm install
npm run db:init
npm run dev
```

The API listens on `http://localhost:4000` by default. The health check is `GET /health`.

For a production-style run:

```bash
npm run build
npm start
```

## Main API surface

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/assessments`
- `POST /api/assessments/:id/answers`
- `POST /api/assessments/:id/complete`
- `GET /api/dashboard`
- `GET /api/goals`
- `POST /api/goals`
- `GET /api/objectives`
- `POST /api/objectives/:id/tasks/:taskId/complete`

Send `Authorization: Bearer <token>` to protected routes. The database is created at `DATABASE_FILE`; the default is `data/lifeos.sqlite`.

The schema covers the LifeOS master model: users, profiles, advisor assessments, goals, AI analyses, blueprints, path stages, milestones, stories, chapters, objectives, tasks, measurements, RPG progression, inventory, abilities, streaks, conversations, and notifications. The initial service exposes the core onboarding-to-quest loop; additional tables are ready for the next feature slices.
