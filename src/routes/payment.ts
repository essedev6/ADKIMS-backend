import { Router } from 'express';
import { transactionService } from '../app';
import { mpesaService } from '../services/mpesa';

const router = Router();

// Initiate payment
router.post('/initiate', async (req, res) => {
  try {
    console.log('Payment initiation request received:', req.body);
    const { planId, amount, planName, type, phoneNumber } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount or phoneNumber'
      });
    }

    // For direct payments, we don't need planId or planName
    if (type !== 'direct' && (!planId || !planName)) {
      return res.status(400).json({
        success: false,
        message: 'Plan-based payments require planId and planName'
      });
    }

    console.log('Creating transaction with data:', {
      planId,
      amount,
      planName,
      type,
      phoneNumber: req.body.phoneNumber
    });

    // Create a pending transaction
    const transaction = await transactionService.createTransaction({
      planId,
      amount,
      planName,
      type,
      status: 'pending',
      phoneNumber: req.body.phoneNumber
    });

    console.log('Transaction created successfully:', transaction);

    // Use the environment's callback URL
    const callbackBase = process.env.CALLBACK_URL;
    if (!callbackBase) {
      throw new Error('CALLBACK_URL environment variable is not set');
    }

    // Initiate STK Push
    const stkPushResponse = await mpesaService.initiateSTKPush({
      amount: amount,
      phoneNumber: req.body.phoneNumber,
      accountReference: type === 'direct' ? 'DIRECT-PAYMENT' : `PLAN-${planId}`,
      transactionDesc: `Payment for ${type === 'direct' ? 'Direct Payment' : planName}`,
      callbackUrl: `${callbackBase}/${transaction._id}`
    });

    console.log('STK push response:', stkPushResponse);

    res.json({
      success: true,
      transactionId: transaction._id,
      checkoutRequestId: stkPushResponse.CheckoutRequestID,
      merchantRequestId: stkPushResponse.MerchantRequestID
    });
  } catch (error: any) {
    console.error('Payment initiation error:', error);
    console.error('Error stack:', error.stack);
    
    // Check for specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data provided',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate payment',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all transaction logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await transactionService.getTransactionLogs();
    res.json({ success: true, data: logs });
  } catch (error: any) {
    console.error('Error fetching transaction logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/report/revenue', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(0);
    const end = endDate ? new Date(endDate as string) : new Date();
    const report = await transactionService.getRevenueReport(start, end);
    res.json(report);
  } catch (error) {
    console.error('Error fetching revenue report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/dashboard-data', async (req, res) => {
  try {
    const dashboardData = await transactionService.getDashboardData();
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
  try {
    const payment = await transactionService.getPaymentById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    res.json({ success: true, data: payment });
  } catch (error: any) {
    console.error('Error fetching payment by ID:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;