const { config } = require('../config/env');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Unexpected server error.',
      ...(config.nodeEnv === 'development' ? { stack: err.stack } : {})
    }
  });
}

module.exports = { errorHandler };

