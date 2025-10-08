import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { serverConfig } from './config';
import mpesaRoutes from './routes/mpesa';
import authRoutes from './routes/auth'; // Import auth routes
import paymentRoutes from './routes/payment';
import userRoutes from './routes/user'; // Import user routes
import planTemplateRoutes from './routes/planTemplate';
import planPageRoutes from './routes/planPage';
import { errorHandler } from './middleware/error';
import { WebSocketService } from './services/websocket';
import { PlanTemplateService } from './services/PlanTemplateService';
import { TransactionService } from './services/transaction';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ADKIMS Backend API is running',
    environment: serverConfig.nodeEnv
  });
});

// Mount hizo routes
app.use('/esse', mpesaRoutes);

// Mount auth routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/plan-templates', planTemplateRoutes);
app.use('/api/users', userRoutes); // Mount user routes

// Mount mpesa routes
app.use('/api/mpesa', mpesaRoutes);

// Mount plan page routes
app.use('/api/plan-pages', planPageRoutes);

// Handle hio error ikue bie
app.use(errorHandler);

//  MongoDB , DB ingine gwenje
mongoose.connect(serverConfig.mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket service
const wsService = WebSocketService.getInstance(server);

// Initialize PlanTemplateService
const planTemplateService = PlanTemplateService.getInstance(server);

// Initialize TransactionService
const transactionService = TransactionService.getInstance(server);

// Start server
server.listen(serverConfig.port, () => {
  console.log(`Server running on port ${serverConfig.port} in ${serverConfig.nodeEnv} mode`);
  console.log('WebSocket server initialized');
});

export { app, wsService, planTemplateService, transactionService };