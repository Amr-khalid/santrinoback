import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import venueRoutes from './routes/venue.routes.js';
import facilityRoutes from './routes/facility.routes.js';
import activityRoutes from './routes/activity.routes.js';
import fieldRoutes from './routes/field.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import superadminRoutes from './routes/superadmin.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Connect Database on startup
connectDB();

// Ensure DB is connected for every serverless request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// CORS configuration to accept any origin
app.use(
  cors({
    origin: (origin, callback) => callback(null, true), // Allow all origins dynamically
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  })
);
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Santrino Sports & Activities Booking Platform API',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/superadmin', superadminRoutes);

// Root route for Vercel
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Santrino Backend API is running smoothly on Vercel',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `الرابط المطلوب غير موجود: ${req.originalUrl}`,
  });
});

// Central Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Only listen locally, avoid listening on Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Santrino Server running on http://localhost:${PORT}`);
  });
}

export default app;
