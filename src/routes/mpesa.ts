import express from "express";
import axios from "axios";
import fs from "fs";
import moment from "moment";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// -----------------------------
// Helper: Get Access Token
// -----------------------------
async function getAccessToken(): Promise<string> {
  const consumer_key = process.env.MPESA_CONSUMER_KEY;
  const consumer_secret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumer_key || !consumer_secret) {
    throw new Error("Missing CONSUMER_KEY or CONSUMER_SECRET in .env");
  }

  const url =
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth =
    "Basic " + Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

  const response = await axios.get(url, { headers: { Authorization: auth } });
  return response.data.access_token;
}

// -----------------------------
// STK Push
// -----------------------------
router.post("/stkpush", async (req, res) => {
  try {
    let { phone, amount } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ error: "Phone and amount required" });
    }

    // Format phone number
    if (phone.startsWith("0")) phone = "254" + phone.slice(1);

    const token = await getAccessToken();
    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      (process.env.MPESA_SHORTCODE || '') + (process.env.MPESA_PASSKEY || '') + timestamp
    ).toString("base64");

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.CALLBACK_URL, // ✅ direct from .env
      AccountReference: "ADKIMS HOTSPOT",
      TransactionDesc: "STK Push Test",
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({
      success: true,
      message: "STK Push initiated",
      response: response.data,
    });
  } catch (error: any) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

// -----------------------------
// STK Callback with safe logging
// -----------------------------
router.all("/callback", (req, res) => {
  console.log("✅ STK Callback Received:", req.method);
  console.log(req.body);

  try {
    const callback = req.body?.Body?.stkCallback;

    if (callback && callback.ResultCode === 0) {
      const metadataItems = callback.CallbackMetadata?.Item || [];
      const clientIP = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip;

      const logEntry = {
        MerchantRequestID: callback.MerchantRequestID,
        CheckoutRequestID: callback.CheckoutRequestID,
        ResultCode: callback.ResultCode,
        ResultDesc: callback.ResultDesc,
        Amount: metadataItems.find((i: any) => i.Name === "Amount")?.Value || 0,
        MpesaReceiptNumber:
          metadataItems.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value || "",
        TransactionDate:
          metadataItems.find((i: any) => i.Name === "TransactionDate")?.Value || "",
        PhoneNumber:
          metadataItems.find((i: any) => i.Name === "PhoneNumber")?.Value || "",
        IP: clientIP,
        UserAgent: req.headers["user-agent"],
        Timestamp: new Date().toISOString(),
      };

      let logs: any[] = [];
      if (fs.existsSync("stkcallback.json")) {
        try {
          const data = fs.readFileSync("stkcallback.json", "utf8");
          logs = data ? JSON.parse(data) : [];
          if (!Array.isArray(logs)) logs = [];
        } catch {
          logs = [];
        }
      }

      logs.push(logEntry);
      fs.writeFileSync("stkcallback.json", JSON.stringify(logs, null, 2));

      console.log("✅ STK Callback logged successfully");
    } else {
      console.log("⚠️ STK Callback received but transaction failed or invalid");
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });
  } catch (error) {
    console.error("STK Callback Error:", error);
    res.status(500).json({ ResultCode: 1, ResultDesc: "Server Error" });
  }
});

// -----------------------------
// C2B Confirmation
// -----------------------------
router.all("/confirmation", (req, res) => {
  console.log("✅ C2B Confirmation Received:", req.method);
  console.log(req.body);

  fs.writeFileSync("confirmation.json", JSON.stringify(req.body, null, 2));

  res.status(200).json({ ResultCode: 0, ResultDesc: "Confirmation received" });
});

// -----------------------------
// C2B Validation
// -----------------------------
router.all("/validation", (req, res) => {
  console.log("🔍 C2B Validation Received:", req.method);
  console.log(req.body);

  fs.writeFileSync("validation.json", JSON.stringify(req.body, null, 2));

  res.status(200).json({ ResultCode: 0, ResultDesc: "Validation successful" });
});

// -----------------------------
// Register C2B URLs
// -----------------------------
router.get("/registerurl", async (req, res) => {
  try {
    const token = await getAccessToken();
    const payload = {
      ShortCode: process.env.MPESA_SHORTCODE,
      ResponseType: "Completed",
      ConfirmationURL: process.env.CONFIRMATION_URL,
      ValidationURL: process.env.VALIDATION_URL,
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("C2B Registration Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
