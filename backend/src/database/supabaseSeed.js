const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getSupabaseAdminClient } = require('../config/supabase');
const { throwIfSupabaseError } = require('../utils/supabaseError');

const mockDataDir = path.resolve(__dirname, '../../mock-data');
const defaultSeedPassword = 'password';

const productStockByCategory = {
  Accessories: 35,
  Bathroom: 20,
  'Eco-Friendly': 30,
  Kitchen: 25,
  Laundry: 28,
  'Plastic Free': 22,
  'Zero Waste': 24
};

const demoOrderHistory = [
  {
    orderId: 'seed_order_001',
    userId: 'user_102',
    items: ['prod_01', 'prod_07', 'prod_08']
  },
  {
    orderId: 'seed_order_002',
    userId: 'user_103',
    items: ['prod_01', 'prod_07', 'prod_14']
  },
  {
    orderId: 'seed_order_003',
    userId: 'user_102',
    items: ['prod_01', 'prod_08', 'prod_15']
  },
  {
    orderId: 'seed_order_004',
    userId: 'user_103',
    items: ['prod_02', 'prod_10', 'prod_16']
  }
];

function readJsonFile(filename) {
  const filePath = path.join(mockDataDir, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeUserId(userId) {
  return String(userId).startsWith('user_') ? String(userId) : `user_${userId}`;
}

function getStockQuantity(product) {
  return product.stock_quantity || productStockByCategory[product.category] || 20;
}

async function resetDemoData(supabase) {
  const tables = ['cart_items', 'carts', 'payments', 'order_items', 'orders', 'users', 'products'];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('created_at', '1900-01-01T00:00:00.000Z');
    throwIfSupabaseError(error);
  }
}

async function seedProducts(supabase, products) {
  const now = new Date().toISOString();
  const rows = products.map((product) => ({
    product_id: product.id,
    name: product.name,
    category: product.category,
    image: product.image,
    description: product.description,
    price: product.price,
    stock_quantity: getStockQuantity(product),
    updated_at: now
  }));

  const { error } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'product_id' });

  throwIfSupabaseError(error);
}

async function seedUsers(supabase, users) {
  const passwordHash = await bcrypt.hash(defaultSeedPassword, 12);
  const now = new Date().toISOString();
  const rows = users.map((user) => ({
    user_id: normalizeUserId(user.user_id),
    username: user.username,
    email: user.email,
    password_hash: passwordHash,
    is_logged_in: Boolean(user.auth_status?.is_logged_in),
    token: user.auth_status?.token || null,
    last_login: user.auth_status?.last_login || null,
    created_at: user.registration_date || now,
    updated_at: now
  }));

  const { error } = await supabase
    .from('users')
    .upsert(rows, { onConflict: 'user_id' });

  throwIfSupabaseError(error);
}

async function seedRecommendationHistory(supabase) {
  const orders = demoOrderHistory.map((order) => ({
    order_id: order.orderId,
    user_id: order.userId,
    is_guest_checkout: false,
    address: 'Seed recommendation history',
    subtotal_amount: 0,
    subscription_discount_amount: 0,
    dynamic_discount_amount: 0,
    total_amount: 0,
    order_status: 'completed'
  }));

  const { error: orderError } = await supabase
    .from('orders')
    .insert(orders);

  throwIfSupabaseError(orderError);

  const orderItems = demoOrderHistory.flatMap((order) => order.items.map((productId) => ({
    order_item_id: `seed_order_item_${order.orderId}_${productId}`,
    order_id: order.orderId,
    product_id: productId,
    quantity: 1,
    is_recurring: false,
    frequency: null,
    unit_price: 0,
    discount_applied: 0,
    line_total: 0
  })));

  const { error: itemError } = await supabase
    .from('order_items')
    .insert(orderItems);

  throwIfSupabaseError(itemError);
}

async function seedSupabaseDatabase() {
  const supabase = getSupabaseAdminClient();
  const products = readJsonFile('products.json');
  const users = readJsonFile('users.json');

  await resetDemoData(supabase);
  await seedProducts(supabase, products);
  await seedUsers(supabase, users);
  await seedRecommendationHistory(supabase);

  return {
    products: products.length,
    users: users.length
  };
}

module.exports = { seedSupabaseDatabase };
