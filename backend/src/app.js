const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { apiRoutes } = require('./routes');
const { notFoundHandler } = require('./middleware/notFoundHandler');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Global middleware layer:
// - cors() allows the static frontend pages to call this API during local development.
// - express.json() is the body parser required by Session 7's checkout POST payload.
// - morgan('dev') gives request-level visibility while we are building and debugging.
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

// All backend endpoints are grouped under /api so frontend routes and API routes
// stay clearly separated. Feature modules are mounted inside src/routes/index.js.
app.use('/api', apiRoutes);

// Error boundary order matters in Express:
// 1. notFoundHandler catches unknown API paths.
// 2. errorHandler is the final centralized JSON error formatter.
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
