const { migrate } = require('../src/database/migrate');

migrate()
  .then((result) => {
    if (result.applied.length === 0) {
      console.log('Database is already up to date.');
      return;
    }

    console.log(`Applied migrations: ${result.applied.join(', ')}`);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

