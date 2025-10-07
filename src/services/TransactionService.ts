import mongoose from 'mongoose';
import { Payment } from '../models';
import { WebSocketService } from './websocket';

export class TransactionService {
  private static instance: TransactionService;
  private wsService: WebSocketService;

  private constructor() {
    this.wsService = WebSocketService.getInstance();
  }

  public static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * Save raw callback data directly to MongoDB
   */
  async logTransaction(callbackData: any): Promise<void> {
    console.log('🚀 START: logTransaction called');
    
    try {
      console.log('💾 Step 1: Starting MongoDB save process...');
      
      // Extract basic info for the payment record
      const stkCallback = callbackData.Body?.stkCallback;
      const checkoutRequestId = stkCallback?.CheckoutRequestID;
      const resultCode = stkCallback?.ResultCode;
      
      console.log('📋 Step 2: Extracted callback data:', {
        hasCallbackData: !!callbackData,
        hasStkCallback: !!stkCallback,
        checkoutRequestId,
        resultCode,
        merchantRequestId: stkCallback?.MerchantRequestID
      });

      // Step 3: Extract individual fields
      console.log('🔍 Step 3: Extracting individual fields...');
      const amount = this.extractAmount(stkCallback);
      const phoneNumber = this.extractPhoneNumber(stkCallback);
      const mpesaReceiptNumber = this.extractMpesaReceipt(stkCallback);
      const callbackMetadata = this.extractCallbackMetadata(stkCallback);

      console.log('📊 Extracted fields:', {
        amount,
        phoneNumber,
        mpesaReceiptNumber,
        callbackMetadataKeys: Object.keys(callbackMetadata)
      });

      // Step 4: Create payment record
      console.log('📝 Step 4: Creating Payment record...');
      
      const paymentData = {
        userId: new mongoose.Types.ObjectId(),
        planId: new mongoose.Types.ObjectId(),
        amount: amount,
        phoneNumber: phoneNumber,
        merchantRequestId: stkCallback?.MerchantRequestID,
        checkoutRequestId: checkoutRequestId,
        status: resultCode === 0 ? 'completed' : 'failed',
        resultCode: resultCode,
        resultDesc: stkCallback?.ResultDesc,
        mpesaReceiptNumber: mpesaReceiptNumber,
        callbackPayload: callbackData,
        callbackMetadata: callbackMetadata
      };

      console.log('📄 Payment data to save:', JSON.stringify(paymentData, null, 2));

      const paymentRecord = new Payment(paymentData);
      console.log('✅ Payment record instance created');

      // Step 5: Save to MongoDB
      console.log('💾 Step 5: Attempting to save to MongoDB...');
      console.log('📡 MongoDB connection state:', mongoose.connection.readyState);
      console.log('📡 MongoDB connection host:', mongoose.connection.host);

      const savedPayment = await paymentRecord.save();
      
      console.log('🎉 SUCCESS: Raw callback saved to MongoDB with ID:', savedPayment._id);
      console.log('📊 Payment status:', savedPayment.status);
      console.log('🕒 Created at:', savedPayment.createdAt);
      
      // Step 6: Notify via WebSocket if payment was successful
      if (resultCode === 0) {
        console.log('🔔 Step 6: Sending WebSocket notification...');
        this.wsService.notifyPaymentUpdate({
          _id: savedPayment._id.toString(),
          status: 'completed',
          amount: savedPayment.amount,
          phoneNumber: savedPayment.phoneNumber,
          mpesaReceiptNumber: savedPayment.mpesaReceiptNumber,
          resultDesc: savedPayment.resultDesc
        });
        
        console.log('🎊 Payment completed and fully processed!');
      }

      console.log('🏁 END: logTransaction completed successfully');

    } catch (error: any) {
      console.error('❌ ERROR: Failed to save to MongoDB');
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error stack:', error.stack);
      
      // Check for specific error types
      if (error.name === 'ValidationError') {
        console.error('🔍 VALIDATION ERROR DETAILS:');
        Object.keys(error.errors).forEach(key => {
          console.error(`  - ${key}:`, error.errors[key].message);
        });
      }
      
      if (error.name === 'MongoServerError') {
        console.error('🔍 MONGO SERVER ERROR DETAILS:');
        console.error('  - Error code:', error.code);
        console.error('  - Key pattern:', error.keyPattern);
        console.error('  - Key value:', error.keyValue);
      }

      // Step 7: Save to file as fallback
      console.log('📁 Step 7: Falling back to file save...');
      this.saveRawCallback(callbackData);
    }
  }

  /**
   * Extract amount from callback metadata
   */
  private extractAmount(stkCallback: any): number {
    try {
      if (!stkCallback?.CallbackMetadata?.Item) {
        console.log('⚠️ No CallbackMetadata.Item found for amount extraction');
        return 0;
      }
      
      const amountItem = stkCallback.CallbackMetadata.Item.find(
        (item: any) => item.Name === 'Amount'
      );
      
      const amount = amountItem?.Value || 0;
      console.log('💰 Amount extracted:', amount);
      return amount;
      
    } catch (error) {
      console.error('❌ Error extracting amount:', error);
      return 0;
    }
  }

  /**
   * Extract phone number from callback metadata
   */
  private extractPhoneNumber(stkCallback: any): string {
    try {
      if (!stkCallback?.CallbackMetadata?.Item) {
        console.log('⚠️ No CallbackMetadata.Item found for phone extraction');
        return '';
      }
      
      const phoneItem = stkCallback.CallbackMetadata.Item.find(
        (item: any) => item.Name === 'PhoneNumber'
      );
      
      const phone = phoneItem?.Value?.toString() || '';
      console.log('📞 Phone extracted:', phone);
      return phone;
      
    } catch (error) {
      console.error('❌ Error extracting phone:', error);
      return '';
    }
  }

  /**
   * Extract M-Pesa receipt number from callback metadata
   */
  private extractMpesaReceipt(stkCallback: any): string {
    try {
      if (!stkCallback?.CallbackMetadata?.Item) {
        console.log('⚠️ No CallbackMetadata.Item found for receipt extraction');
        return '';
      }
      
      const receiptItem = stkCallback.CallbackMetadata.Item.find(
        (item: any) => item.Name === 'MpesaReceiptNumber'
      );
      
      const receipt = receiptItem?.Value || '';
      console.log('🧾 Receipt extracted:', receipt);
      return receipt;
      
    } catch (error) {
      console.error('❌ Error extracting receipt:', error);
      return '';
    }
  }

  /**
   * Extract and format callback metadata
   */
  private extractCallbackMetadata(stkCallback: any): any {
    try {
      if (!stkCallback?.CallbackMetadata?.Item) {
        console.log('⚠️ No CallbackMetadata.Item found for metadata extraction');
        return {};
      }
      
      const metadata: any = {};
      stkCallback.CallbackMetadata.Item.forEach((item: any) => {
        metadata[item.Name] = item.Value;
      });
      
      console.log('📋 Metadata extracted with keys:', Object.keys(metadata));
      return metadata;
      
    } catch (error) {
      console.error('❌ Error extracting metadata:', error);
      return {};
    }
  }

  /**
   * Save raw callback to file (fallback)
   */
  private saveRawCallback(callbackData: any): void {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const logsDir = path.join(__dirname, '../../logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const filename = `callback-${Date.now()}.json`;
      const filepath = path.join(logsDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(callbackData, null, 2));
      console.log('📄 Raw callback saved to file as fallback:', filepath);

    } catch (error) {
      console.error('❌ Error saving raw callback to file:', error);
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
        .select('amount phoneNumber status resultDesc mpesaReceiptNumber callbackPayload createdAt')
        .limit(50);
      
      console.log(`📊 Found ${payments.length} payments in database`);
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
        .select('amount phoneNumber status resultDesc mpesaReceiptNumber callbackPayload callbackMetadata createdAt');
      
      if (!payment) {
        console.log(`❌ Payment ${paymentId} not found in MongoDB`);
      } else {
        console.log(`✅ Payment ${paymentId} found in MongoDB`);
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
        amount: 100,
        phoneNumber: "254700000000",
        merchantRequestId: "test-merchant-" + Date.now(),
        checkoutRequestId: "test-checkout-" + Date.now(),
        status: 'completed' as const,
        resultCode: 0,
        resultDesc: "Test payment",
        mpesaReceiptNumber: "TEST123",
        callbackPayload: { test: true },
        callbackMetadata: { Amount: 100, PhoneNumber: "254700000000" }
      };

      console.log('📄 Test data:', testData);
      
      const testPayment = new Payment(testData);
      const saved = await testPayment.save();
      
      console.log('✅ Test payment saved successfully:', saved._id);
      
      // Clean up test data
      await Payment.deleteOne({ _id: saved._id });
      console.log('🧹 Test payment cleaned up');
      
      return { success: true, paymentId: saved._id };
    } catch (error: any) {
      console.error('❌ Test payment failed:', error.message);
      console.error('❌ Full error:', error);
      return { success: false, error: error.message };
    }
  }
}