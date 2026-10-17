// Phase 0: Configure shared Express middleware, API routes, and JSON error responses.
import cookieParser from 'cookie-parser';
import cors from 'cors';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { publicMediaDirectory } from './utils/uploadDirectories.js';
import logger from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';
import noSqlSanitizer from './middleware/noSqlSanitizer.js';
import ApiError from './utils/ApiError.js';
import routes from './routes/index.js';

const app = express();

if (env.nodeEnv === 'production') app.set('trust proxy', 1);
app.use(['/api/auth', '/api/admin/auth'], (request, response, next) => {
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
  });
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
// Log only the URL path; query strings can contain single-use account tokens.
morgan.token('safe-path', (request) => {
  return request.originalUrl.split('?', 1)[0] || '/';
});
app.use(morgan(':method :safe-path :status :response-time ms', {
  skip: (request, response) => env.nodeEnv === 'production' && response.statusCode < 400,
  stream: { write: (message) => logger.info(message.trim()) },
}));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === 'production' ? 300 : 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', success: false, data: null, message: 'Too many requests. Please try again later.' },
}));
if (env.nodeEnv === 'production') {
  app.use((request, response, next) => {
    if (request.secure) return next();
    response.redirect(308, `${env.apiPublicUrl}${request.originalUrl}`);
  });
}
app.use(cookieParser());
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }));
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({
  limit: '12mb',
  verify(request, response, buffer) {
    request.rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(noSqlSanitizer);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new ApiError(403, 'Origin is not allowed by CORS.'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-Admin-Request', 'X-Api-Key', 'X-Api-Signature'],
}));
app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});
app.use('/media', express.static(publicMediaDirectory, {
  dotfiles: 'deny',
  index: false,
  fallthrough: false,
}));
app.use('/api', routes);
app.use((request, response, next) => {
  next(new ApiError(404, 'Route not found.'));
});
app.use(errorHandler);

export default app;
