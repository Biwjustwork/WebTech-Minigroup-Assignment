# Deployment Audit

This checklist covers Session 10: zero-config setup, `.env` security, and go-live readiness.

## Required Commands

Run from `backend/`:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run audit:deploy
npm start
```

## Environment

Required variables:

```text
PORT=3001
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=./data/app.sqlite
CORS_ORIGIN=*
```

For production:

- Set `NODE_ENV=production`.
- Replace `JWT_SECRET` with a long random secret of at least 32 characters.
- Set `CORS_ORIGIN` to the deployed frontend origin instead of `*`.
- Keep `.env` out of Git.
- Keep local database files out of Git.

## Audit Scripts

```bash
npm run audit:env
```

Checks `.env.example`, `.gitignore`, required config values, and production JWT secret safety.

```bash
npm run db:audit
```

Checks required tables, foreign keys, and `PRAGMA foreign_key_check`.

```bash
npm run smoke:test
```

Starts the Express app on a random port and verifies `GET /api/health`.

```bash
npm run audit:deploy
```

Runs environment audit, database audit, and smoke test together.

## Go-Live Notes

- API routes are under `/api`.
- Payment is intentionally bypassed for the assignment.
- Checkout recalculates price, stock, discounts, and totals on the backend.
- Client-calculated totals are rejected with `CLIENT_CALCULATION_REJECTED`.
- Production error responses hide stack traces when `NODE_ENV=production`.

