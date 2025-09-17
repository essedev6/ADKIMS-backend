import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { serverConfig } from './config';
import mpesaRoutes from './routes/mpesa';
import { errorHandler } from './middleware/error';

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

// Mount routes
app.use('/mpesa', mpesaRoutes);

// Error handling
app.use(errorHandler);

// Connect to MongoDB
mongoose.connect(serverConfig.mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
app.listen(serverConfig.port, () => {
  console.log(`Server running on port ${serverConfig.port} in ${serverConfig.nodeEnv} mode`);
});

export default app;