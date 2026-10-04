require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const nocache = require('nocache');

// Import middlewares
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const borrowingRoutes = require('./routes/borrowings');
const reservationRoutes = require('./routes/reservations');
const userRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');

// Auto Cron imports
const borrowingService = require('./services/borrowingService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility Middlewares
app.use(cors());
app.use(express.json());
app.use(nocache());

// Base Static Serving for local attachments if in mock Mode
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Mount API routes
const apiPrefix = '/api';
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/books`, bookRoutes);
app.use(`${apiPrefix}/borrowings`, borrowingRoutes);
app.use(`${apiPrefix}/reservations`, reservationRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/reviews`, reviewRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Library API is running' });
});

// Front-End Static Serving configuration
if (process.env.SERVE_STATIC === 'true') {
  const frontendPath = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendPath));
  
  // SPA fallback to index.html if navigating via URL
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // Global 404 for API-only mode
  app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Resource not found' });
  });
}

// Attach Error Handler
app.use(errorHandler);

// Background cron scheduler loop wrapper
function startCronJobs() {
  // In a real environment, you might use node-cron matching '0 0 * * *' (midnight daily).
  // For easy verification and testing, we will run the check loop every 1 hour (or 1 minute in dev)
  
  const tickDelayMs = process.env.NODE_ENV === 'development' ? 60 * 1000 : 3600 * 1000; // 1 min or 1 hr
  
  setInterval(async () => {
    try {
      const results = await borrowingService.systemCalculateOverduesAndFines();
      if (results.fineUpdates > 0 || results.expiredReservations > 0) {
        console.log(`[Auto-Cron] Fines applied: ${results.fineUpdates}, Expired Reservations Released: ${results.expiredReservations}`);
      }
    } catch (err) {
      console.error("[Auto-Cron] Error running daily calculations:", err.message);
    }
  }, tickDelayMs);

  console.log(`[Auto-Cron] Daily check system registered (Tick rate: ${tickDelayMs}ms)`);
}

// Startup
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Digital Library Server running on port ${PORT}`);
  console.log(`🛡️  Mock Mode Enabled? ${process.env.MOCK_MODE === 'true'}`);
  console.log(`📁 Static Frontend Served? ${process.env.SERVE_STATIC === 'true'}`);
  console.log(`===============================================`);
  
  startCronJobs();
});
