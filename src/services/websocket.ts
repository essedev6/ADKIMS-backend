import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Payment, Settings, Session } from '../models';

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketServer;

  private constructor(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: [
          'http://localhost:3000', // Client portal
          'http://localhost:3001', // Admin dashboard
          process.env.CLIENT_URL || '',
          process.env.ADMIN_URL || ''
        ],
        methods: ['GET', 'POST']
      }
    });

    this.setupEventHandlers();
  }

  public static getInstance(server: HttpServer): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(server);
    }
    return WebSocketService.instance;
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected');

      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });

      socket.on('get-plans', async () => {
        try {
          const plans = await this.getPlanData();
          socket.emit('plans-data', plans);
        } catch (error) {
          console.error('Error fetching plans:', error);
          socket.emit('error', { message: 'Failed to fetch plans' });
        }
      });

      socket.on('payment-update', async (data) => {
        try {
          const payment = await Payment.findByIdAndUpdate(
            data.paymentId,
            { $set: data.update },
            { new: true }
          );
          if (payment) {
            this.io.emit('payment-updated', payment);
          }
        } catch (error) {
          console.error('Error updating payment:', error);
        }
      });
    });
  }

  private async getPlanData() {
    try {
      const { Plan } = await import('../models');
      return await Plan.find().sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching plans:', error);
      throw error;
    }
  }

  public emitPlansUpdate() {
    this.getPlanData()
      .then(plans => {
        this.io.emit('plans-data', plans);
      })
      .catch(error => {
        console.error('Error emitting plans update:', error);
      });
  }

  // Add this missing method
  public notifyPaymentUpdate(paymentData: any): void {
    this.io.emit('payment-updated', paymentData);
  }

  public emitPaymentUpdate(payment: any): void {
    this.io.emit('payment:update', payment);
  }

  public emitSessionUpdate(session: any): void {
    this.io.emit('session:update', session);
  }
}