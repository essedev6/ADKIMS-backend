import fs from 'fs/promises';
import path from 'path';
import { Payment, GuestUser, Session, User } from '../models';
import { WebSocketService } from './websocket';
import mongoose from 'mongoose';
import { Server } from 'http';

export class TransactionService {
  private static instance: TransactionService;
  private wsService: WebSocketService;
  private callbackLogPath: string;

  private constructor(server: Server) {
    this.wsService = WebSocketService.getInstance(server);
    this.callbackLogPath = path.join(process.cwd(), 'stkcallback.json');
  }

  public static getInstance(server: Server): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService(server);
    }
    return TransactionService.instance;
  }

  public async createTransaction(data: {
    planId: string;
    amount: number;
    planName: string;
    type: string;
    status: string;
    phoneNumber: string;
    userId?: string;
  }) {
    try {
      console.log('TransactionService: Creating transaction with data:', data);

      // Create a temporary user for guest payments if userId is not provided
      let userId = data.userId;
      if (!userId) {
        console.log('Creating guest user for phone:', data.phoneNumber);
        const guestUser = await GuestUser.create({
          phone: data.phoneNumber,
          username: `guest_${Date.now()}`,
          role: 'guest'
        });

        console.log('Guest user created:', guestUser);
        userId = guestUser._id.toString();
      }

      console.log('Using userId:', userId);

      // Create payment data
      const paymentData: any = {
        userId: userId,
        amount: data.amount,
        status: data.status,
        phoneNumber: data.phoneNumber,
        transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`
      };

      // Handle planId based on type
      if (data.type === 'direct') {
        console.log('Processing direct payment');
        paymentData.planName = 'Direct Payment';
      } else {
        console.log('Processing plan-based payment');
        paymentData.planId = new mongoose.Types.ObjectId(data.planId);
        paymentData.planName = data.planName;
      }

      console.log('Creating payment with data:', paymentData);
      const payment = await Payment.create(paymentData);

      console.log('Payment created successfully:', payment);
      return payment;
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      console.error('Error stack:', error.stack);
      
      if (error instanceof mongoose.Error.ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new Error(`Validation error: ${Object.values(error.errors).map(e => e.message).join(', ')}`);
      } else if (error.code === 11000) {
        throw new Error('Duplicate transaction record');
      } else {
        console.error('Detailed error:', {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        throw new Error(`Failed to create transaction record: ${error.message}`);
      }
    }
  }

  private async readCallbackLog(): Promise<any[]> {
    try {
      const data = await fs.readFile(this.callbackLogPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, return empty array
      return [];
    }
  }

  private async writeCallbackLog(data: any[]): Promise<void> {
    await fs.writeFile(this.callbackLogPath, JSON.stringify(data, null, 2));
  }

  public async logTransaction(callbackData: any): Promise<void> {
    try {
      const logs = await this.readCallbackLog();
      
      logs.push({
        timestamp: new Date().toISOString(),
        data: callbackData
      });

      await this.writeCallbackLog(logs);

      const payment = await this.updatePaymentRecord(callbackData);

      if (payment) {
        this.wsService.emitPaymentUpdate(payment);
      }
    } catch (error) {
      console.error('Error logging transaction:', error);
      throw error;
    }
  }

  private async updatePaymentRecord(callbackData: any): Promise<any> {
    try {
      const { Body } = callbackData;
      if (!Body?.stkCallback) return null;

      const {
        MerchantRequestID,
        CheckoutRequestID,
        ResultCode,
        ResultDesc,
        CallbackMetadata
      } = Body.stkCallback;

      const payment = await Payment.findOne({
        $or: [
          { merchantRequestId: MerchantRequestID },
          { checkoutRequestId: CheckoutRequestID }
        ]
      });

      if (!payment) {
        console.warn('Payment not found for callback:', MerchantRequestID);
        return null;
      }

      payment.resultCode = ResultCode;
      payment.resultDesc = ResultDesc;
      payment.status = ResultCode === 0 ? 'completed' : 'failed';
      payment.callbackPayload = Body.stkCallback;

      if (CallbackMetadata?.Item) {
        const metadata = new Map();
        CallbackMetadata.Item.forEach((item: any) => {
          metadata.set(item.Name, item.Value);
        });
        payment.callbackMetadata = metadata;

        const mpesaReceiptNumber = metadata.get('MpesaReceiptNumber');
        if (mpesaReceiptNumber) {
          payment.mpesaReceiptNumber = mpesaReceiptNumber;
        }
      }

      await payment.save();
      return payment;
    } catch (error) {
      console.error('Error updating payment record:', error);
      throw error;
    }
  }

  public async getTransactionLogs(): Promise<any[]> {
    return this.readCallbackLog();
  }

  public async getPaymentById(paymentId: string): Promise<any> {
    return Payment.findById(paymentId);
  }

  public async getRevenueReport(startDate: Date, endDate: Date): Promise<any> {
    try {
      const pipeline = [
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $lookup: {
            from: 'plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'planDetails'
          }
        },
        {
          $unwind: {
            path: '$planDetails',
            preserveNullAndEmptyArrays: true // Keep direct payments without plans
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            transactionsCount: { $sum: 1 },
            revenueByPlan: {
              $push: {
                plan: { $ifNull: ['$planDetails.name', 'Direct Payment'] },
                amount: '$amount'
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalRevenue: 1,
            transactionsCount: 1,
            revenueByPlan: 1
          }
        }
      ];

      const report = await Payment.aggregate(pipeline);
      return report.length > 0 ? report[0] : {
        totalRevenue: 0,
        transactionsCount: 0,
        revenueByPlan: []
      };
    } catch (error) {
      console.error('Error generating revenue report:', error);
      throw error;
    }
  }

  public async getDashboardData() {
    try {
      // Get completed payments data
      const completedPayments = await Payment.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalTransactions: { $sum: 1 }
          }
        }
      ]);

      // Get revenue by plan/payment type
      const revenueByPlan = await Payment.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$planName',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            name: { $ifNull: ['$_id', 'Direct Payment'] },
            revenue: 1,
            count: 1
          }
        }
      ]);

      // Get recent transactions
      const recentTransactions = await Payment.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('amount status phoneNumber planName createdAt');

      // Get payment statistics
      const paymentStats = await Payment.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Format the response
      return {
        totalRevenue: completedPayments[0]?.totalRevenue || 0,
        totalTransactions: completedPayments[0]?.totalTransactions || 0,
        revenueByPlan,
        recentTransactions,
        paymentStats: paymentStats.reduce((acc: any, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }
}