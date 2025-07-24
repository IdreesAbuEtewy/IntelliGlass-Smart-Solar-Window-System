/**
 * IntelliGlass - Smart Solar Window System
 * Main Backend Application
 * 
 * This is the entry point for the Node.js Express backend that connects
 * to Firebase and provides REST APIs for the IntelliGlass system.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import Firebase configuration and initialization
const { initializeFirebase } = require('./firebase/firebase-config');

// Import routes
const authRoutes = require('./routes/auth-routes');
const deviceRoutes = require('./routes/device-routes');
const sensorRoutes = require('./routes/sensor-routes');
const scheduleRoutes = require('./routes/schedule-routes');
const mlRoutes = require('./routes/ml-routes');

// Import middleware
const { authMiddleware } = require('./middleware/auth-middleware');
const { errorHandler } = require('./middleware/error-middleware');

// Import utilities
const logger = require('./utils/logger');

// Initialize Firebase
initializeFirebase();

// Create Express application
const app = express();

// Set up rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Apply middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(compression()); // Compress responses
app.use(morgan('combined')); // HTTP request logging
app.use(limiter); // Apply rate limiting

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', authMiddleware, deviceRoutes);
app.use('/api/sensors', authMiddleware, sensorRoutes);
app.use('/api/schedules', authMiddleware, scheduleRoutes);
app.use('/api/ml', authMiddleware, mlRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'IntelliGlass Smart Solar Window System API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// API documentation endpoint (can be replaced with Swagger UI)
app.get('/api-docs', (req, res) => {
  res.status(200).json({
    message: 'API documentation will be available here.',
    endpoints: [
      { path: '/api/auth', description: 'Authentication endpoints' },
      { path: '/api/devices', description: 'Device management endpoints' },
      { path: '/api/sensors', description: 'Sensor data endpoints' },
      { path: '/api/schedules', description: 'User schedule endpoints' },
      { path: '/api/ml', description: 'Machine learning prediction endpoints' }
    ]
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested resource does not exist.' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`IntelliGlass backend server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Don't exit the process in production, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // In production, you might want to gracefully restart the process
  // process.exit(1);
});

module.exports = app; // Export for testing purposes