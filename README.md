## core-service

Core domain service for Ayncor: **channels, threads, messages, reactions**, and the async-first workflow rules.

### Prereqs

- Node.js (LTS)
- Docker Desktop

### Local dev (Windows / macOS / Linux)

Start Postgres:

```bash
docker compose up -d
```

Create `.env` (copy from `.env.example`) and set:

- `DATABASE_URL` (points at the Postgres container)
- `JWT_ACCESS_SECRET` (must match `identity-service` so access tokens validate)

Run Prisma + server:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

### Health

- `GET /health` liveness
- `GET /health/ready` readiness (DB)


