import axios from 'axios';
import { mpesaConfig } from '../config';
import { STKPushRequest, STKPushResponse } from '../types/mpesa';

class MpesaService {
  private baseUrl: string;
  private auth: string | null = null;
  private authExpiry: number = 0;

  constructor() {
    this.baseUrl = mpesaConfig.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  private async getAuth(): Promise<string> {
    if (this.auth && Date.now() < this.authExpiry) {
      return this.auth;
    }

    const auth = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString('base64');
    try {
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` }
      });

      this.auth = response.data.access_token;
      this.authExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      return this.auth;
    } catch (error) {
      console.error('Failed to get Mpesa auth token:', error);
      throw new Error('Failed to authenticate with Mpesa');
    }
  }

  private validatePhone(phone: string): string {
    let cleaned = phone.replace(/[^0-9]/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1);
    }
    
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }
    
    // FIXED: Proper regex for Safaricom numbers
    const phoneRegex = /^254(7|10|11)[0-9]{8}$/;
    
    if (!phoneRegex.test(cleaned)) {
      throw new Error(`Invalid Safaricom number. Expected format: 2547XXXXXXXX, 25410XXXXXXXX, or 25411XXXXXXXX. Received: ${cleaned}`);
    }
    
    return cleaned;
  }

  private validateAmount(amount: number): number {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Amount must be a valid number');
    }
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    return Math.round(amount);
  }

  async initiateSTKPush(data: STKPushRequest): Promise<STKPushResponse> {
    try {
      console.log('Initiating STK Push with data:', data);
      const phone = this.validatePhone(data.phoneNumber);
      const amount = this.validateAmount(data.amount);
      
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = Buffer.from(
        `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`
      ).toString('base64');

      // Get auth token
      console.log('Getting M-Pesa auth token...');
      const token = await this.getAuth();
      console.log('Auth token received');

      // Prepare request payload
      const payload = {
        BusinessShortCode: mpesaConfig.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: mpesaConfig.shortcode,
        PhoneNumber: phone,
        CallBackURL: data.callbackUrl || mpesaConfig.callbackUrl,
        AccountReference: data.accountReference || 'ADKIMS',
        TransactionDesc: data.transactionDesc || 'Internet Service Payment'
      };

      console.log('Sending M-Pesa request with payload:', {
        ...payload,
        Password: '******' // Hide sensitive data in logs
      });

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('STK Push Error:', error.response?.data || error.message);
      if (error.response?.data) {
        throw new Error(error.response.data.errorMessage || 'Failed to initiate payment');
      }
      throw error;
    }
  }
}

export const mpesaService = new MpesaService();