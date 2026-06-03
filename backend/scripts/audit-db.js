const { auditDatabase } = require('../src/database/audit');

auditDatabase()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));

    if (!result.ok) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Database audit failed:', error);
    process.exit(1);
  });

