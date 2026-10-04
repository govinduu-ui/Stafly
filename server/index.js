import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { seed } from './db/seed.js';
import authRoutes from './routes/auth.js';
import organizationRoutes from './routes/organizations.js';
import employeeRoutes from './routes/employees.js';
import departmentRoutes from './routes/departments.js';
import attendanceRoutes from './routes/attendance.js';
import leaveRoutes from './routes/leaves.js';
import financeRoutes from './routes/finance.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';
import ticketRoutes from './routes/tickets.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON Parsing
app.use(cors());
app.use(express.json());

// API Routes Registration
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack || err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Initialize DB & Start Server
async function startServer() {
  try {
    console.log('Initializing Staffly Multi-Tenant Backend Server...');
    await seed();
    app.listen(PORT, () => {
      console.log(`Staffly Multi-Tenant Backend Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
