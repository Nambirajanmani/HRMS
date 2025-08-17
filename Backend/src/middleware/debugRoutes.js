// src/middleware/debugRoutes.js
import logger from '../utils/logger.js';

// Middleware to debug route registration
export const debugRoutes = (req, res, next) => {
  logger.info('Route Debug Info', {
    method: req.method,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    params: req.params,
    query: req.query,
    headers: {
      'user-agent': req.get('User-Agent'),
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? 'Bearer [REDACTED]' : 'None'
    }
  });
  next();
};

// Function to list all registered routes
export const listRoutes = (app) => {
  const routes = [];
  
  const extractRoutes = (stack, basePath = '') => {
    stack.forEach((middleware) => {
      if (middleware.route) {
        // Direct route
        const methods = Object.keys(middleware.route.methods)
          .filter(method => middleware.route.methods[method])
          .map(method => method.toUpperCase());
        
        routes.push({
          path: basePath + middleware.route.path,
          methods: methods,
          type: 'route'
        });
      } else if (middleware.name === 'router' && middleware.handle.stack) {
        // Router middleware
        const routerPath = middleware.regexp.source
          .replace('\\', '')
          .replace('(?:/)', '')
          .replace('(?=\\/|$)', '')
          .replace(/\$.*/, '');
        
        const cleanPath = routerPath
          .replace(/\^\\\//g, '/')
          .replace(/\\\//g, '/')
          .replace(/\$$/g, '')
          .replace(/\?.*$/g, '');
        
        extractRoutes(middleware.handle.stack, basePath + cleanPath);
      }
    });
  };
  
  extractRoutes(app._router.stack);
  return routes;
};

// Function to log all routes at startup
export const logRegisteredRoutes = (app) => {
  const routes = listRoutes(app);
  logger.info('=== REGISTERED ROUTES ===');
  routes.forEach(route => {
    logger.info(`${route.methods.join(', ')} ${route.path}`);
  });
  logger.info(`=== TOTAL ROUTES: ${routes.length} ===`);
  
  return routes;
};