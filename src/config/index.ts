import { config } from 'dotenv';
import { MpesaConfig } from '../types/mpesa';

// Load environment variables
config();

function validateEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const mpesaConfig: MpesaConfig = {
  consumerKey: validateEnvVar('MPESA_CONSUMER_KEY'),
  consumerSecret: validateEnvVar('MPESA_CONSUMER_SECRET'),
  shortcode: validateEnvVar('MPESA_SHORTCODE'),
  passkey: validateEnvVar('MPESA_PASSKEY'),
  callbackUrl: validateEnvVar('CALLBACK_URL'),
  confirmationUrl: validateEnvVar('CONFIRMATION_URL'),
  validationUrl: validateEnvVar('VALIDATION_URL'),
  environment: (process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox') as MpesaConfig['environment'],
};

export const serverConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wifi-billing',
};