import { Router, Request, Response } from "express";
import * as fs from "fs";
import moment from "moment";
import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";
import { Payment } from "../models";
import { TransactionService } from "../services/TransactionService";

dotenv.config();

const router = Router();

/**
 * Helper: Get Access Token
 */
async function getAccessToken(): Promise<string> {
  const consumer_key = process.env.MPESA_CONSUMER_KEY;
  const consumer_secret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumer_key || !consumer_secret) {
    throw new Error("Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET in env");
  }

  const url =
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth = "Basic " + Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

  const resp = await axios.get(url, { headers: { Authorization: auth } });
  return resp.data.access_token;
}

/**
 * DEBUG: show how a phone will be normalized (quick check)
 */
router.post("/debug/normalize", (req: Request, res: Response) => {
  const raw = String(req.body.phone ?? "");
  const normalized = normalizePhone(raw);
  res.json({ raw, normalized, ok: /^2547\d{8}$/.test(normalized) });
});

/**
 * Normalize helper: forces phone to digits and tries to make it 2547XXXXXXXX
 */
function normalizePhone(input: string): string {
  let s = String(input || "").trim();
  s = s.replace(/^\+/, "");
  s = s.replace(/\D/g, "");

  if (s.length === 10 && s.startsWith("07")) {
    s = "254" + s.slice(1);
  } else if (s.length === 9 && s.startsWith("7")) {
    s = "254" + s;
  } else if (s.length === 12 && s.startsWith("254")) {
    // already ok
  } else if (s.length > 12 && s.startsWith("254")) {
    s = s.slice(0, 12);
  }

  return s;
}

/**
 * STK Push endpoint
 */
router.post("/stkpush", async (req: Request, res: Response) => {
  try {
    const { phone: rawPhone, amount: rawAmount, accountNumber, userId, planId } = req.body;
    const accountRef = accountNumber || "ADKIMS HOTSPOT";

    if (!rawPhone) return res.status(400).json({ error: "Phone is required" });
    if (rawAmount === undefined || rawAmount === null) return res.status(400).json({ error: "Amount is required" });

    const phone = normalizePhone(String(rawPhone));

    if (!/^2547\d{8}$/.test(phone)) {
      return res.status(400).json({
        error: "Invalid phone format. Expected 2547XXXXXXXX (12 digits).",
        received: phone,
        hint: "Try: 0712345678 or +254712345678 (will be normalized).",
      });
    }

    const amountNum = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }

    const token = await getAccessToken();
    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      (process.env.MPESA_SHORTCODE ?? "") + (process.env.MPESA_PASSKEY ?? "") + timestamp
    ).toString("base64");

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amountNum,
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: accountRef,
      TransactionDesc: "ADKIMS HOTSPOT payment",
    };

    console.log("=== STK PUSH OUTGOING PAYLOAD ===");
    console.log(JSON.stringify(payload, null, 2));

    const url = process.env.MPESA_ENV === "production"
      ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
      : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

    try {
      const mpesaResp = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      });

      console.log("=== MPESA RESPONSE ===");
      console.log(mpesaResp.status, mpesaResp.statusText);
      console.log(JSON.stringify(mpesaResp.data, null, 2));

      // Create payment record - FIXED: Provide default userId and planId
      try {
        // Create dummy ObjectIds if not provided
        const paymentUserId = userId || new mongoose.Types.ObjectId();
        const paymentPlanId = planId || new mongoose.Types.ObjectId();
        
        const payment = new Payment({
          userId: paymentUserId,
          planId: paymentPlanId,
          amount: amountNum,
          phoneNumber: phone,
          merchantRequestId: mpesaResp.data.MerchantRequestID,
          checkoutRequestId: mpesaResp.data.CheckoutRequestID,
          status: 'pending'
        });
        await payment.save();
        console.log("✅ Payment record created:", payment._id);
      } catch (dbError: any) {
        console.error("❌ Failed to create payment record:", dbError.message);
        // Don't fail the entire request if DB save fails
      }

      // Return success response to client
      return res.json({ 
        success: true, 
        message: "STK push initiated successfully",
        checkoutRequestId: mpesaResp.data.CheckoutRequestID,
        merchantRequestId: mpesaResp.data.MerchantRequestID,
        response: mpesaResp.data 
      });
    } catch (mpesaError: any) {
      const mpesaBody = mpesaError?.response?.data ?? mpesaError?.message ?? "No response body";
      console.error("MPESA ERROR STATUS:", mpesaError?.response?.status);
      console.error("MPESA ERROR BODY:", JSON.stringify(mpesaBody, null, 2));

      return res.status(mpesaError?.response?.status || 500).json({
        success: false,
        error: mpesaBody?.errorMessage || mpesaBody?.ResultDesc || "MPESA API error",
        mpesaError: mpesaBody,
      });
    }
  } catch (error: any) {
    console.error("STK Push Internal Error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
});

/**
 * STK Callback (C2B / STK responses from Safaricom) - UPDATED to save callback data
 */
router.post("/callback", async (req: Request, res: Response) => {
  console.log("✅ STK Callback Received:", req.method);
  console.log("Callback Body:", JSON.stringify(req.body, null, 2));

  try {
    const callbackData = req.body;
    
    // Log the callback for debugging
    fs.writeFileSync(`callback-${Date.now()}.json`, JSON.stringify(callbackData, null, 2));
    
    // Check if this is an STK callback
    if (callbackData.Body && callbackData.Body.stkCallback) {
      const stkCallback = callbackData.Body.stkCallback;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const callbackMetadata = stkCallback.CallbackMetadata;
      
      console.log("STK Callback Details:", {
        resultCode,
        resultDesc,
        checkoutRequestId
      });

      // Extract callback metadata and receipt number
      let extractedMetadata = {};
      let mpesaReceiptNumber = "";
      
      if (callbackMetadata && callbackMetadata.Item) {
        callbackMetadata.Item.forEach((item: any) => {
          extractedMetadata[item.Name] = item.Value;
          if (item.Name === "MpesaReceiptNumber") {
            mpesaReceiptNumber = item.Value;
          }
        });
      }

      console.log("📋 Extracted Callback Metadata:", extractedMetadata);
      console.log("🧾 M-Pesa Receipt:", mpesaReceiptNumber);

      // Update payment status based on result
      if (resultCode === 0) {
        // Payment successful
        console.log("✅ Payment successful for CheckoutRequestID:", checkoutRequestId);

        // Update payment record WITH CALLBACK DATA
        const updatedPayment = await Payment.findOneAndUpdate(
          { checkoutRequestId: checkoutRequestId },
          { 
            status: 'completed',
            resultCode: resultCode,
            resultDesc: resultDesc,
            mpesaReceiptNumber: mpesaReceiptNumber,
            callbackPayload: callbackData, // SAVE COMPLETE CALLBACK
            callbackMetadata: extractedMetadata, // SAVE EXTRACTED METADATA
            completedAt: new Date()
          },
          { new: true } // Return the updated document
        );

        if (updatedPayment) {
          console.log("✅ Payment completed successfully in database:", updatedPayment._id);
          console.log("💾 Callback data saved to database");
        } else {
          console.log("⚠️ Payment not found for checkoutRequestId:", checkoutRequestId);
          // If payment not found, use TransactionService to create it from callback
          const transactionService = TransactionService.getInstance();
          await transactionService.logTransaction(callbackData);
        }

      } else {
        // Payment failed
        console.log("❌ Payment failed for CheckoutRequestID:", checkoutRequestId, "Reason:", resultDesc);
        
        const updatedPayment = await Payment.findOneAndUpdate(
          { checkoutRequestId: checkoutRequestId },
          { 
            status: 'failed',
            resultCode: resultCode,
            resultDesc: resultDesc,
            callbackPayload: callbackData, // SAVE COMPLETE CALLBACK EVEN FOR FAILED
            callbackMetadata: extractedMetadata // SAVE EXTRACTED METADATA
          },
          { new: true }
        );

        if (!updatedPayment) {
          console.log("⚠️ Payment not found for failed checkoutRequestId:", checkoutRequestId);
        }
      }
    }

    // Always respond with success to Safaricom
    return res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Success" 
    });
  } catch (error) {
    console.error("Callback handler error:", error);
    // Still respond with success to Safaricom even if we have internal errors
    return res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Success" 
    });
  }
});

/**
 * Simple C2B confirmation & validation endpoints
 */
router.post("/confirmation", (req: Request, res: Response) => {
  console.log("C2B Confirmation:", JSON.stringify(req.body, null, 2));
  fs.writeFileSync("confirmation.json", JSON.stringify(req.body, null, 2));
  res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });
});

router.post("/validation", (req: Request, res: Response) => {
  console.log("C2B Validation:", JSON.stringify(req.body, null, 2));
  fs.writeFileSync("validation.json", JSON.stringify(req.body, null, 2));
  res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });
});

export default router;





