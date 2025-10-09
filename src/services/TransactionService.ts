import mongoose from 'mongoose';
import { Payment } from '../models';
import { WebSocketService } from './websocket';

// Type assertion interface for Payment with timestamps
interface IPaymentWithTimestamps {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId?: mongoose.Types.ObjectId;
  planName: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  phoneNumber: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  resultCode?: number;
  resultDesc?: string;
  callbackMetadata?: Map<string, any>;
  callbackPayload?: any;
  retryCount: number;
  lastRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class TransactionService {
  private static instance: TransactionService;
  private wsService: WebSocketService;

  private constructor(server: any) {
    this.wsService = WebSocketService.getInstance(server);
  }

  public static getInstance(server?: any): TransactionService {
    if (!TransactionService.instance) {
      if (!server) {
        throw new Error('Server instance is required for first initialization');
      }
      TransactionService.instance = new TransactionService(server);
    }
    return TransactionService.instance;
  }

  /**
   * Create initial pending payment (when STK push is initiated)
   */
  async createPendingPayment(paymentData: {
    userId: mongoose.Types.ObjectId;
    planId?: mongoose.Types.ObjectId;
    planName: string;
    amount: number;
    phoneNumber: string;
    merchantRequestId: string;
    checkoutRequestId: string;
    transactionId: string;
  }): Promise<IPaymentWithTimestamps> {
    console.log('🆕 Creating pending payment...');
    
    const paymentRecord = new Payment({
      ...paymentData,
      status: 'pending',
      retryCount: 0
    });

    const savedPayment = await paymentRecord.save() as unknown as IPaymentWithTimestamps;
    console.log('📝 Pending payment created with ID:', savedPayment._id);
    console.log('🔑 CheckoutRequestID:', paymentData.checkoutRequestId);
    
    return savedPayment;
  }

  /**
   * Handle M-Pesa callback and update payment status
   */
  async handleMpesaCallback(callbackData: any): Promise<void> {
    console.log('📨 M-Pesa Callback Received in TransactionService');
    console.log('📦 Raw callback:', JSON.stringify(callbackData, null, 2));
    
    try {
      const stkCallback = callbackData.Body?.stkCallback;
      
      if (!stkCallback) {
        console.log('❌ No stkCallback in callback data');
        return;
      }

      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;
      
      console.log('🔍 Callback details:', {
        checkoutRequestId,
        resultCode, 
        resultDesc,
        hasCallbackMetadata: !!stkCallback.CallbackMetadata
      });

      if (!checkoutRequestId) {
        console.log('❌ No CheckoutRequestID in callback');
        return;
      }

      // Find payment by CheckoutRequestID
      const payment = await Payment.findOne({ checkoutRequestId }) as unknown as IPaymentWithTimestamps;
      
      if (!payment) {
        console.log('❌ No payment found for CheckoutRequestID:', checkoutRequestId);
        
        // Try to find by merchantRequestId as fallback
        const merchantRequestId = stkCallback.MerchantRequestID;
        if (merchantRequestId) {
          const fallbackPayment = await Payment.findOne({ merchantRequestId }) as unknown as IPaymentWithTimestamps;
          if (fallbackPayment) {
            console.log('✅ Found payment by MerchantRequestID:', fallbackPayment._id);
            await this.updatePaymentWithCallback(fallbackPayment, stkCallback);
            return;
          }
        }
        
        console.log('❌ No payment found with any identifier');
        return;
      }

      console.log('✅ Found payment:', payment._id);
      console.log('📊 Current status:', payment.status);

      await this.updatePaymentWithCallback(payment, stkCallback);

    } catch (error: any) {
      console.error('❌ Error processing callback:', error);
      console.error('❌ Error stack:', error.stack);
    }
  }

  /**
   * Update payment with callback data
   */
  private async updatePaymentWithCallback(payment: IPaymentWithTimestamps, stkCallback: any): Promise<void> {
    try {
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      // Extract callback metadata
      const amount = this.extractCallbackValue(stkCallback, 'Amount');
      const mpesaReceiptNumber = this.extractCallbackValue(stkCallback, 'MpesaReceiptNumber');
      const transactionDate = this.extractCallbackValue(stkCallback, 'TransactionDate');
      const phoneNumber = this.extractCallbackValue(stkCallback, 'PhoneNumber');

      console.log('📋 Extracted metadata:', {
        amount,
        mpesaReceiptNumber,
        transactionDate,
        phoneNumber
      });

      // Determine new status
      let newStatus: 'pending' | 'completed' | 'failed' = 'pending';
      if (resultCode === 0) {
        newStatus = 'completed';
        console.log('✅ Payment completed successfully');
      } else if (resultCode > 0) {
        newStatus = 'failed';
        console.log('❌ Payment failed with code:', resultCode);
      } else {
        console.log('⏳ Payment still pending');
      }

      console.log('🎯 Updating payment status from', payment.status, 'to', newStatus);

      // Update payment
      const updateData: any = {
        status: newStatus,
        resultCode: resultCode,
        resultDesc: resultDesc
      };

      if (mpesaReceiptNumber) {
        updateData.mpesaReceiptNumber = mpesaReceiptNumber;
      }
      if (amount) {
        updateData.amount = amount;
      }
      if (phoneNumber) {
        updateData.phoneNumber = phoneNumber;
      }

  // Add callback metadata as Map
if (stkCallback.CallbackMetadata) {
  const callbackMetadata = new Map();
  stkCallback.CallbackMetadata.Item.forEach((item: any) => {
    callbackMetadata.set(item.Name, item.Value);
  });
  updateData.callbackMetadata = callbackMetadata;
}

      const updatedPayment = await Payment.findByIdAndUpdate(
        payment._id,
        updateData,
        { new: true }
      ) as unknown as IPaymentWithTimestamps;

      console.log('✅ Payment updated successfully');
      console.log('📊 New status:', updatedPayment.status);
      console.log('🧾 M-Pesa Receipt:', updatedPayment.mpesaReceiptNumber);

      // Send WebSocket notification if completed
      if (newStatus === 'completed') {
        console.log('🔔 Sending WebSocket notification...');
        this.wsService.notifyPaymentUpdate({
          _id: updatedPayment._id.toString(),
          status: 'completed',
          amount: updatedPayment.amount,
          phoneNumber: updatedPayment.phoneNumber,
          mpesaReceiptNumber: updatedPayment.mpesaReceiptNumber,
          resultDesc: updatedPayment.resultDesc,
          createdAt: updatedPayment.createdAt
        });
        console.log('🎊 Payment completed and notification sent!');
      }

    } catch (error: any) {
      console.error('❌ Error updating payment with callback:', error);
      throw error;
    }
  }

  /**
   * Extract value from callback metadata
   */
  private extractCallbackValue(stkCallback: any, fieldName: string): any {
    try {
      if (!stkCallback?.CallbackMetadata?.Item) {
        console.log(`⚠️ No CallbackMetadata.Item found for ${fieldName}`);
        return null;
      }
      
      const item = stkCallback.CallbackMetadata.Item.find(
        (item: any) => item.Name === fieldName
      );
      
      const value = item?.Value || null;
      console.log(`📥 Extracted ${fieldName}:`, value);
      return value;
      
    } catch (error) {
      console.error(`❌ Error extracting ${fieldName}:`, error);
      return null;
    }
  }

  /**
   * Get payment by checkoutRequestId
   */
  async getPaymentByCheckoutRequestId(checkoutRequestId: string): Promise<IPaymentWithTimestamps | null> {
    try {
      const payment = await Payment.findOne({ checkoutRequestId }) as unknown as IPaymentWithTimestamps;
      return payment;
    } catch (error) {
      console.error('Error finding payment:', error);
      return null;
    }
  }

  /**
   * Get payment by merchantRequestId
   */
  async getPaymentByMerchantRequestId(merchantRequestId: string): Promise<IPaymentWithTimestamps | null> {
    try {
      const payment = await Payment.findOne({ merchantRequestId }) as unknown as IPaymentWithTimestamps;
      return payment;
    } catch (error) {
      console.error('Error finding payment:', error);
      return null;
    }
  }

  /**
   * Manually update payment status (for testing)
   */
  async manuallyUpdatePayment(paymentId: string, status: 'completed' | 'failed', receiptNumber?: string): Promise<boolean> {
    try {
      const updated = await Payment.findByIdAndUpdate(
        paymentId,
        { 
          status: status,
          ...(receiptNumber && { mpesaReceiptNumber: receiptNumber })
        },
        { new: true }
      );
      
      console.log(`✅ Manually updated payment ${paymentId} to ${status}`);
      return !!updated;
    } catch (error) {
      console.error('Error manually updating payment:', error);
      return false;
    }
  }

  /**
   * Simulate M-Pesa callback for testing
   */
  async simulateMpesaCallback(checkoutRequestId: string, success: boolean = true): Promise<boolean> {
    try {
      console.log('🎭 Simulating M-Pesa callback for:', checkoutRequestId);
      
      const simulatedCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: "simulated-merchant-id",
            CheckoutRequestID: checkoutRequestId,
            ResultCode: success ? 0 : 1,
            ResultDesc: success ? "The service request is processed successfully." : "The balance is insufficient for the transaction",
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 5 },
                { Name: "MpesaReceiptNumber", Value: "SIM" + Date.now() },
                { Name: "TransactionDate", Value: new Date().toISOString().replace(/[-:]/g, '').split('.')[0] },
                { Name: "PhoneNumber", Value: "254757597007" }
              ]
            }
          }
        }
      };

      await this.handleMpesaCallback(simulatedCallback);
      return true;
    } catch (error) {
      console.error('Error simulating callback:', error);
      return false;
    }
  }

  /**
   * Get all payments with raw callback data
   */
  async getAllPaymentsWithCallbacks(): Promise<any[]> {
    try {
      console.log('📊 Fetching all payments from MongoDB...');
      const payments = await Payment.find()
        .sort({ createdAt: -1 })
        .select('amount phoneNumber status resultCode resultDesc mpesaReceiptNumber checkoutRequestId merchantRequestId callbackPayload createdAt')
        .limit(50) as unknown as IPaymentWithTimestamps[];
      
      console.log(`📊 Found ${payments.length} payments in database`);
      
      // Log status distribution for debugging
      const statusCount = payments.reduce((acc, payment) => {
        acc[payment.status] = (acc[payment.status] || 0) + 1;
        return acc;
      }, {} as any);
      console.log('📈 Payment status distribution:', statusCount);
      
      return payments;
    } catch (error) {
      console.error('❌ Error fetching payments:', error);
      return [];
    }
  }

  /**
   * Get specific payment with full callback data
   */
  async getPaymentWithCallback(paymentId: string): Promise<any> {
    try {
      console.log(`🔍 Fetching payment ${paymentId} from MongoDB...`);
      const payment = await Payment.findById(paymentId)
        .select('amount phoneNumber status resultCode resultDesc mpesaReceiptNumber checkoutRequestId merchantRequestId callbackPayload callbackMetadata createdAt') as unknown as IPaymentWithTimestamps;
      
      if (!payment) {
        console.log(`❌ Payment ${paymentId} not found in MongoDB`);
        return null;
      } else {
        console.log(`✅ Payment ${paymentId} found in MongoDB`);
        console.log('📊 Status:', payment.status);
        console.log('🔢 ResultCode:', payment.resultCode);
        console.log('🔑 CheckoutRequestID:', payment.checkoutRequestId);
      }
      
      return payment;
    } catch (error) {
      console.error('❌ Error fetching payment:', error);
      return null;
    }
  }

  /**
   * Test MongoDB connection and payment creation
   */
  async testMongoDBConnection(): Promise<any> {
    try {
      console.log('🧪 Testing MongoDB connection and payment creation...');
      
      // Test data
      const testData = {
        userId: new mongoose.Types.ObjectId(),
        planId: new mongoose.Types.ObjectId(),
        planName: 'Test Plan',
        amount: 100,
        phoneNumber: "254700000000",
        merchantRequestId: "test-merchant-" + Date.now(),
        checkoutRequestId: "test-checkout-" + Date.now(),
        transactionId: "TEST_TXN_" + Date.now(),
        status: 'pending' as const,
        resultCode: 0,
        resultDesc: "Test payment",
        mpesaReceiptNumber: "TEST123",
        callbackPayload: { test: true },
       callbackMetadata: new Map<string, any>([['Amount', 100], ['PhoneNumber', "254700000000"]]),
        retryCount: 0
      };

      console.log('📄 Test data:', testData);
      
      const testPayment = new Payment(testData);
      const saved = await testPayment.save() as unknown as IPaymentWithTimestamps;
      
      console.log('✅ Test payment saved successfully:', saved._id);
      console.log('🕒 Created at:', saved.createdAt);
      console.log('📊 Status:', saved.status);
      
      // Clean up test data
      await Payment.deleteOne({ _id: saved._id });
      console.log('🧹 Test payment cleaned up');
      
      return { success: true, paymentId: saved._id, createdAt: saved.createdAt, status: saved.status };
    } catch (error: any) {
      console.error('❌ Test payment failed:', error.message);
      console.error('❌ Full error:', error);
      return { success: false, error: error.message };
    }
  }
}