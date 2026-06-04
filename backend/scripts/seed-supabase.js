const { seedSupabaseDatabase } = require('../src/database/supabaseSeed');

seedSupabaseDatabase()
  .then((result) => {
    console.log(`Supabase seed complete: ${result.products} products, ${result.users} users.`);
  })
  .catch((error) => {
    console.error('Supabase seed failed:', error);
    process.exit(1);
  });

