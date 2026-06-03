const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { config } = require('../config/env');

let sqlRuntimePromise;

function resolveDatabasePath() {
  if (path.isAbsolute(config.databaseUrl)) {
    return config.databaseUrl;
  }

  return path.resolve(__dirname, '../..', config.databaseUrl);
}

async function getSqlRuntime() {
  // sql.js loads a WebAssembly SQLite runtime. We memoize it so all scripts reuse
  // the same initialized runtime instead of paying setup cost on each DB open.
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = initSqlJs();
  }

  return sqlRuntimePromise;
}

async function openDatabase() {
  const databasePath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  // sql.js stores the DB in memory while it is open. If a file already exists,
  // we hydrate the in-memory database from that file first.
  const SQL = await getSqlRuntime();
  const fileBuffer = fs.existsSync(databasePath) ? fs.readFileSync(databasePath) : null;
  const db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  // Keep the resolved path on the DB object so closeDatabase can persist changes
  // back to disk. Foreign keys are explicitly enabled because SQLite can leave
  // them off by default depending on the runtime.
  db.__databasePath = databasePath;
  db.run('PRAGMA foreign_keys = ON;');

  return db;
}

async function run(db, sql, params = []) {
  // Every helper accepts params separately from SQL text. This is the foundation
  // for parameterized queries and prevents SQL injection when user input arrives.
  const stmt = db.prepare(sql);

  try {
    stmt.run(params);
    return { changes: db.getRowsModified() };
  } finally {
    stmt.free();
  }
}

async function get(db, sql, params = []) {
  const stmt = db.prepare(sql);

  try {
    stmt.bind(params);
    return stmt.step() ? stmt.getAsObject() : undefined;
  } finally {
    stmt.free();
  }
}

async function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];

  try {
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }

    return rows;
  } finally {
    stmt.free();
  }
}

async function exec(db, sql) {
  db.exec(sql);
}

async function withTransaction(db, work) {
  await run(db, 'BEGIN');

  try {
    const result = await work();
    await run(db, 'COMMIT');
    return result;
  } catch (error) {
    await run(db, 'ROLLBACK');
    throw error;
  }
}

async function closeDatabase(db) {
  // Persist the in-memory SQLite database to backend/data/app.sqlite before
  // closing. API code must call this after write operations until we introduce a
  // longer-lived connection manager.
  if (db.__databasePath) {
    const data = db.export();
    fs.writeFileSync(db.__databasePath, Buffer.from(data));
  }

  db.close();
}

module.exports = {
  all,
  closeDatabase,
  exec,
  get,
  openDatabase,
  resolveDatabasePath,
  run,
  withTransaction
};
