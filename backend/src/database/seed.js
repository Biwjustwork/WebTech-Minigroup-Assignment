const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const {
  closeDatabase,
  openDatabase,
  run
} = require('./connection');
const { migrate } = require('./migrate');

const mockDataDir = path.resolve(__dirname, '../../mock-data');

// Demo users all receive this password after seeding. The seed process stores it
// as a bcrypt hash, matching the Auth Architecture of Trust requirement.
const defaultSeedPassword = 'password';

// The original products.json did not include inventory. We add deterministic
// stock by category so the later checkout transaction can prove stock-check logic.
const productStockByCategory = {
  Accessories: 35,
  Bathroom: 20,
  'Eco-Friendly': 30,
  Kitchen: 25,
  Laundry: 28,
  'Plastic Free': 22,
  'Zero Waste': 24
};

function readJsonFile(filename) {
  const filePath = path.join(mockDataDir, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeUserId(userId) {
  // The ER diagram expects string IDs. Prefixing the old numeric mock IDs keeps
  // them readable while avoiding ambiguity with future generated IDs.
  return String(userId).startsWith('user_') ? String(userId) : `user_${userId}`;
}

function getStockQuantity(product) {
  return product.stock_quantity || productStockByCategory[product.category] || 20;
}

async function seedProducts(db, products) {
  for (const product of products) {
    // Upsert keeps the seed idempotent: running npm run db:seed twice refreshes
    // demo data instead of creating duplicate products.
    await run(
      db,
      `
        INSERT INTO products (
          product_id,
          name,
          category,
          image,
          description,
          price,
          stock_quantity,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(product_id) DO UPDATE SET
          name = excluded.name,
          category = excluded.category,
          image = excluded.image,
          description = excluded.description,
          price = excluded.price,
          stock_quantity = excluded.stock_quantity,
          updated_at = datetime('now')
      `,
      [
        product.id,
        product.name,
        product.category,
        product.image,
        product.description,
        product.price,
        getStockQuantity(product)
      ]
    );
  }
}

async function seedUsers(db, users) {
  // We intentionally do not reuse the old MD5-looking password_hash from
  // users.json because the project requirement calls for salted password hashes.
  const passwordHash = await bcrypt.hash(defaultSeedPassword, 12);

  for (const user of users) {
    await run(
      db,
      `
        INSERT INTO users (
          user_id,
          username,
          email,
          password_hash,
          is_logged_in,
          token,
          last_login,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          username = excluded.username,
          email = excluded.email,
          password_hash = excluded.password_hash,
          is_logged_in = excluded.is_logged_in,
          token = excluded.token,
          last_login = excluded.last_login,
          updated_at = datetime('now')
      `,
      [
        normalizeUserId(user.user_id),
        user.username,
        user.email,
        passwordHash,
        user.auth_status?.is_logged_in ? 1 : 0,
        user.auth_status?.token || null,
        user.auth_status?.last_login || null,
        user.registration_date || new Date().toISOString()
      ]
    );
  }
}

async function seedDatabase() {
  // Seeding depends on the schema, so migrations are run first. This lets a new
  // teammate clone the project and run only npm run db:seed safely.
  await migrate();

  const db = await openDatabase();
  const products = readJsonFile('products.json');
  const users = readJsonFile('users.json');

  try {
    // Product and user seed operations are treated as one unit. If one insert
    // fails, the transaction rolls back and avoids a partially seeded demo DB.
    await run(db, 'BEGIN');

    try {
      await seedProducts(db, products);
      await seedUsers(db, users);
      await run(db, 'COMMIT');
    } catch (error) {
      await run(db, 'ROLLBACK');
      throw error;
    }

    return {
      products: products.length,
      users: users.length
    };
  } finally {
    await closeDatabase(db);
  }
}

module.exports = { seedDatabase };
