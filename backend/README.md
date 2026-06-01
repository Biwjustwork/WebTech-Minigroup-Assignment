# Backend

Express API for The Smart-Niche Marketplace.

## Structure

- `src/server.js` starts the HTTP server.
- `src/app.js` configures Express middleware and routes.
- `src/config` contains environment/config loading.
- `src/routes` maps HTTP paths to controllers.
- `src/controllers` handles request/response concerns.
- `src/services` contains business logic.
- `src/database` contains SQLite connection and migration helpers.
- `database/migrations` contains SQL schema changes.
- `src/middleware` contains shared request middleware.
- `mock-data` keeps the original JSON data until database seeding is added.

## Run

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

The API starts on `http://localhost:3001` by default.

The default SQLite database file is `backend/data/app.sqlite`.

