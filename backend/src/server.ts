import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import authRoutes from './routes/auth.routes';
import donationRoutes from './routes/donation.routes';
import matchingRoutes from './routes/matching.routes';
import notificationRoutes from './routes/notification.routes';
import volunteerRoutes from './routes/volunteer.routes';
import impactRoutes from './routes/impact.routes';
import adminRoutes from './routes/admin.routes';
import { seedDatabase } from './utils/seed';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded food images
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'FoodBridge API is active and healthy',
    timestamp: new Date().toISOString(),
    databaseConnected: mongoose.connection.readyState === 1,
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/admin', adminRoutes);

// Frontend Page Routing (Clean URLs mapped to pages/ folder)
const pagesDir = path.join(__dirname, '../../frontend/pages');

app.get('/', (_req, res) => res.sendFile(path.join(pagesDir, 'index.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(pagesDir, 'login.html')));
app.get('/register', (_req, res) => res.sendFile(path.join(pagesDir, 'register.html')));
app.get('/restaurant-dashboard', (_req, res) => res.sendFile(path.join(pagesDir, 'restaurant-dashboard.html')));
app.get('/ngo-dashboard', (_req, res) => res.sendFile(path.join(pagesDir, 'ngo-dashboard.html')));
app.get('/available-food', (_req, res) => res.sendFile(path.join(pagesDir, 'available-food.html')));
app.get('/impact', (_req, res) => res.sendFile(path.join(pagesDir, 'impact.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(pagesDir, 'admin.html')));

// Catch-all 404 handler for API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Database connection & Server initialization
let mongoMemoryServer: MongoMemoryServer | null = null;

async function connectDatabase(): Promise<void> {
  const configuredUri = process.env.MONGODB_URI;

  // 1. First attempt: Connect to configured MongoDB URI (local mongod or MongoDB Atlas)
  if (configuredUri && !configuredUri.includes('localhost:27017')) {
    try {
      console.log(`Attempting connection to configured MongoDB: ${configuredUri.split('@')[1] || configuredUri}...`);
      await mongoose.connect(configuredUri, { serverSelectionTimeoutMS: 4000 });
      console.log('✅ Connected to MongoDB via configured MONGODB_URI.');
      return;
    } catch (err: any) {
      console.warn('⚠️ Could not connect to remote MONGODB_URI. Falling back to local embedded MongoDB...');
    }
  }

  // 2. Try default local mongod if running
  try {
    const localUri = 'mongodb://127.0.0.1:27017/foodbridge';
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ Connected to local MongoDB on port 27017.');
    return;
  } catch (_e) {
    // Local daemon not active, continue to in-memory instance
  }

  // 3. Fallback: Start an in-memory MongoDB server instance (Real mongod binary on macOS M4)
  try {
    console.log('⚡ Starting embedded local MongoDB database for seamless zero-setup execution...');
    mongoMemoryServer = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log(`✅ Connected to local embedded MongoDB at ${memoryUri}`);
  } catch (err: any) {
    console.error('❌ Failed to start embedded MongoDB:', err.message);
    throw err;
  }
}

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    // Seed database with realistic demo data for college demonstration
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🌿 FoodBridge server is running!`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`📦 Database: Connected (Mongoose ${mongoose.version})`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) await mongoMemoryServer.stop();
  process.exit(0);
});

startServer();
