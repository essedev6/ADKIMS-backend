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
      this.authExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Expire 1 minute early
      return this.auth;
    } catch (error) {
      console.error('Failed to get Mpesa auth token:', error);
      throw new Error('Failed to authenticate with Mpesa');
    }
  }

  private validatePhone(phone: string): string {
    // Remove any spaces or special characters
    let cleaned = phone.replace(/[^0-9]/g, '');
    
    // If number starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1);
    }
    
    // If number starts with +, remove it
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }
    
    // Validate the format (must be 12 digits starting with 254)
    const phoneRegex = /^254[7,1][0-9]{8}$/;
    if (!phoneRegex.test(cleaned)) {
      throw new Error('Invalid phone number format. Must be a valid Kenyan phone number.');
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
    return Math.round(amount); // Ensure whole number
  }

  async initiateSTKPush(data: STKPushRequest): Promise<STKPushResponse> {
    try {
      const phone = this.validatePhone(data.phone);
      const amount = this.validateAmount(data.amount);
      
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = Buffer.from(
        `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`
      ).toString('base64');

      const token = await this.getAuth();
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: mpesaConfig.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phone,
          PartyB: mpesaConfig.shortcode,
          PhoneNumber: phone,
          CallBackURL: mpesaConfig.callbackUrl,
          AccountReference: data.accountNumber || 'ADKIMS',
          TransactionDesc: 'Internet Service Payment'
        },
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