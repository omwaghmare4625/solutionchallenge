const express = require('express');
const path = require('path');

const config = require('./shared/config');
const { logger } = require('./shared/logging');
const authRoutes = require('./modules/auth/routes');
const ingestionRoutes = require('./modules/ingestion/routes');

function createApp() {
  const app = express();

  app.use(express.json());

  if (config.storage.backend === 'local') {
    app.use(
      config.storage.localAssetBaseUrl,
      express.static(path.resolve(process.cwd(), config.storage.uploadsDir))
    );
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRoutes);
  app.use('/', ingestionRoutes);

  app.use((err, req, res, _next) => {
    logger.error({
      message: err.message,
      module: 'http',
      route: req.originalUrl,
      code: err.code || 'internal_error',
      stack: config.app.isDevelopment ? err.stack : undefined
    });

    const status = err.statusCode || 500;
    res.status(status).json({
      error: status >= 500 ? 'Internal server error' : err.message,
      code: err.code || 'internal_error'
    });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.app.port, () => {
    logger.info({
      message: `Backend listening on port ${config.app.port}`,
      module: 'app',
      route: 'startup',
      code: 'server_started'
    });
  });
}

module.exports = createApp;
