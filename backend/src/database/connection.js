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
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = initSqlJs();
  }

  return sqlRuntimePromise;
}

async function openDatabase() {
  const databasePath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const SQL = await getSqlRuntime();
  const fileBuffer = fs.existsSync(databasePath) ? fs.readFileSync(databasePath) : null;
  const db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  db.__databasePath = databasePath;
  db.run('PRAGMA foreign_keys = ON;');

  return db;
}

async function run(db, sql, params = []) {
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

async function closeDatabase(db) {
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
  run
};
