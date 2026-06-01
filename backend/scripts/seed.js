const { seedDatabase } = require('../src/database/seed');

seedDatabase()
  .then((result) => {
    console.log(`Seed complete: ${result.products} products, ${result.users} users.`);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });

