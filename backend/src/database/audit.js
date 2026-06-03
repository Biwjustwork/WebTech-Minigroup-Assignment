const {
  all,
  closeDatabase,
  get,
  openDatabase
} = require('./connection');

const requiredTables = [
  'cart_items',
  'carts',
  'order_items',
  'orders',
  'payments',
  'products',
  'schema_migrations',
  'users'
];

const requiredOrderColumns = [
  'subtotal_amount',
  'subscription_discount_amount',
  'dynamic_discount_amount',
  'dynamic_discount_reason'
];

const requiredForeignKeyTables = [
  'cart_items',
  'carts',
  'order_items',
  'orders',
  'payments'
];

async function auditDatabase() {
  const db = await openDatabase();

  try {
    const foreignKeys = await get(db, 'PRAGMA foreign_keys');
    const tableRows = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    );
    const tableNames = new Set(tableRows.map((row) => row.name));
    const missingTables = requiredTables.filter((table) => !tableNames.has(table));
    const orderColumns = await all(db, 'PRAGMA table_info(orders)');
    const orderColumnNames = new Set(orderColumns.map((column) => column.name));
    const missingOrderColumns = requiredOrderColumns.filter((column) => !orderColumnNames.has(column));
    const foreignKeyProblems = await all(db, 'PRAGMA foreign_key_check');
    const foreignKeyCounts = {};

    for (const table of requiredForeignKeyTables) {
      const rows = await all(db, `PRAGMA foreign_key_list(${table})`);
      foreignKeyCounts[table] = rows.length;
    }

    const missingForeignKeys = Object.entries(foreignKeyCounts)
      .filter(([, count]) => count === 0)
      .map(([table]) => table);

    return {
      ok:
        Number(foreignKeys.foreign_keys) === 1
        && missingTables.length === 0
        && missingOrderColumns.length === 0
        && foreignKeyProblems.length === 0
        && missingForeignKeys.length === 0,
      foreignKeysEnabled: Number(foreignKeys.foreign_keys) === 1,
      missingTables,
      missingOrderColumns,
      foreignKeyProblems,
      foreignKeyCounts,
      missingForeignKeys
    };
  } finally {
    await closeDatabase(db);
  }
}

module.exports = { auditDatabase };
