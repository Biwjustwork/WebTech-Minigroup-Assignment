const { app } = require('../src/app');

const server = app.listen(0, async () => {
  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await response.json();

    console.log(JSON.stringify({
      ok: response.ok && body.status === 'ok',
      statusCode: response.status,
      body
    }, null, 2));

    if (!response.ok || body.status !== 'ok') {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Smoke test failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

