export interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  confirmationUrl: string;
  validationUrl: string;
  environment: 'sandbox' | 'production';
}

export interface STKPushRequest {
  phone: string;
  amount: number;
  accountNumber?: string;
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface STKCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: {
    Item: Array<{
      Name: string;
      Value: string | number;
    }>;
  };
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string | {
    message: string;
    [key: string]: any;
  };
}