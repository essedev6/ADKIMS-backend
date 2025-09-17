"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const moment_1 = __importDefault(require("moment"));
const zod_1 = require("zod");
const router = express_1.default.Router();
// Validation schema for STK push request
const stkPushSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^0[17][0-9]{8}$/),
    amount: zod_1.z.number().positive(),
    accountNumber: zod_1.z.string()
});
// Get Daraja API access token
async function getAccessToken() {
    const consumer_key = process.env.MPESA_CONSUMER_KEY;
    const consumer_secret = process.env.MPESA_CONSUMER_SECRET;
    const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
    try {
        const response = await axios_1.default.get(url, { headers: { Authorization: `Basic ${auth}` } });
        return response.data.access_token;
    }
    catch (error) {
        console.error('Access Token Error:', error instanceof Error ? error.message : 'Unknown error');
        throw error;
    }
}
// STK Push endpoint
router.post('/stkpush', async (req, res) => {
    try {
        // Validate request body
        const { phone, amount, accountNumber } = stkPushSchema.parse(req.body);
        // Format phone number (add 254 prefix)
        const formattedPhone = phone.startsWith('0') ? '254' + phone.slice(1) : phone;
        // Get access token
        const token = await getAccessToken();
        // Generate password and timestamp
        const timestamp = (0, moment_1.default)().format('YYYYMMDDHHmmss');
        const shortcode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
        // Prepare STK push request
        const stkPushUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
        const payload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: formattedPhone,
            PartyB: shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: `${process.env.API_BASE_URL}/mpesa/callback`,
            AccountReference: accountNumber,
            TransactionDesc: 'ADKIMS HOTSPOT Payment'
        };
        // Send STK push request
        const response = await axios_1.default.post(stkPushUrl, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json({
            success: true,
            message: 'STK push initiated successfully',
            data: response.data
        });
    }
    catch (error) {
        console.error('STK Push Error:', error instanceof Error ? error.message : 'Unknown error');
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to process payment request'
        });
    }
});
// Callback endpoint for STK push
router.post('/callback', (req, res) => {
    try {
        const callback = req.body?.Body?.stkCallback;
        console.log('STK Callback received:', callback);
        // Handle callback response
        if (callback?.ResultCode === 0) {
            // Payment successful
            const items = callback.CallbackMetadata?.Item || [];
            const paymentData = {
                amount: items.find((item) => item.Name === 'Amount')?.Value,
                mpesaReceiptNumber: items.find((item) => item.Name === 'MpesaReceiptNumber')?.Value,
                transactionDate: items.find((item) => item.Name === 'TransactionDate')?.Value,
                phoneNumber: items.find((item) => item.Name === 'PhoneNumber')?.Value,
            };
            console.log('Payment successful:', paymentData);
            // TODO: Update user's access time based on the payment
        }
        else {
            // Payment failed
            console.log('Payment failed:', callback?.ResultDesc);
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Callback Error:', error instanceof Error ? error.message : 'Unknown error');
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
exports.default = router;
