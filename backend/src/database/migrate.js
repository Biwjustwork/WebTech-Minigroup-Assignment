const fs = require('fs');
const path = require('path');
const {
  all,
  closeDatabase,
  exec,
  openDatabase,
  run,
  withTransaction
} = require('./connection');

const migrationsDir = path.resolve(__dirname, '../../database/migrations');

async function ensureMigrationsTable(db) {
  // schema_migrations records which SQL migration files have already run. This
  // makes npm run db:migrate safe to execute repeatedly.
  await exec(db, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

async function migrate() {
  const db = await openDatabase();
  const applied = [];

  try {
    await ensureMigrationsTable(db);

    const appliedRows = await all(db, 'SELECT filename FROM schema_migrations');
    const appliedNames = new Set(appliedRows.map((row) => row.filename));

    // Migrations are sorted by filename, so prefixes like 001_, 002_ define the
    // database evolution order in a predictable Git-friendly way.
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((filename) => filename.endsWith('.sql'))
      .sort();

    for (const filename of migrationFiles) {
      if (appliedNames.has(filename)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');

      await withTransaction(db, async () => {
        await exec(db, sql);
        await run(db, 'INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
        applied.push(filename);
      });
    }

    return { applied };
  } finally {
    await closeDatabase(db);
  }
}

module.exports = { migrate };
