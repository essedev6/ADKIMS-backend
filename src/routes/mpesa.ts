// routes/mpesa.ts


import { Router, Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import moment from "moment";
import dotenv from "dotenv";

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
  // remove all non-digits except leading +
  s = s.replace(/^\+/, ""); // drop leading plus if any
  s = s.replace(/\D/g, ""); // keep digits only

  // cases:
  // 07XXXXXXXX => 2547XXXXXXXX
  // 7XXXXXXXX  => 2547XXXXXXXX
  // 2547XXXXXXXX => unchanged
  if (s.length === 10 && s.startsWith("07")) {
    s = "254" + s.slice(1);
  } else if (s.length === 9 && s.startsWith("7")) {
    s = "254" + s;
  } else if (s.length === 12 && s.startsWith("254")) {
    // already ok
  } else if (s.length > 12 && s.startsWith("254")) {
    // sometimes people paste country code and extra chars — keep first 12 digits
    s = s.slice(0, 12);
  }

  return s;
}

/**
 * STK Push endpoint
 */
router.post("/stkpush", async (req: Request, res: Response) => {
  try {
    const { phone: rawPhone, amount: rawAmount, accountNumber } = req.body;
    const accountRef = accountNumber || "ADKIMS HOTSPOT";

    // basic presence checks
    if (!rawPhone) return res.status(400).json({ error: "Phone is required" });
    if (rawAmount === undefined || rawAmount === null) return res.status(400).json({ error: "Amount is required" });

    // normalize phone
    const phone = normalizePhone(String(rawPhone));

    // enforce safaricom format 2547XXXXXXXX
    if (!/^2547\d{8}$/.test(phone)) {
      // helpful debug info returned to client
      return res.status(400).json({
        error: "Invalid phone format. Expected 2547XXXXXXXX (12 digits).",
        received: phone,
        hint: "Try: 0712345678 or +254712345678 (will be normalized).",
      });
    }

    // amount -> number
    const amountNum = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }

    // get token
    const token = await getAccessToken();
    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      (process.env.MPESA_SHORTCODE ?? "") + (process.env.MPESA_PASSKEY ?? "") + timestamp
    ).toString("base64");

    // Build payload exactly as Daraja expects
    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amountNum,
      PartyA: phone, // customer MSISDN in 2547... format
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.CALLBACK_URL,
      ConfirmationURL: process.env.CONFIRMATION_URL,
      ValidationURL: process.env.VALIDATION_URL,
      AccountReference: accountRef,
      TransactionDesc: "ADKIMS HOTSPOT payment",
    };

    // LOG the payload (useful to see what we send to Safaricom)
    console.log("=== STK PUSH OUTGOING PAYLOAD ===");
    console.log(JSON.stringify(payload, null, 2));
    console.log("Auth header: Bearer <token hidden>");

    // send to Safaricom (sandbox)
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

      // log full success response for debugging
      console.log("=== MPESA RESPONSE ===");
      console.log(mpesaResp.status, mpesaResp.statusText);
      console.log(JSON.stringify(mpesaResp.data, null, 2));

      // reply to client
      return res.json({ success: true, response: mpesaResp.data });
    } catch (mpesaError: any) {
      // capture exact mpesa response body (usually contains validation errors)
      const mpesaBody = mpesaError?.response?.data ?? mpesaError?.message ?? "No response body";
      console.error("MPESA ERROR STATUS:", mpesaError?.response?.status);
      console.error("MPESA ERROR BODY:", JSON.stringify(mpesaBody, null, 2));

      // return mpesa body to client (very helpful when debugging)
      return res.status(mpesaError?.response?.status || 500).json({
        success: false,
        mpesaError: mpesaBody,
        payloadSent: payload,
      });
    }
  } catch (error: any) {
    console.error("STK Push Internal Error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
});

/**
 * STK Callback (C2B / STK responses from Safaricom)
 */
router.all("/callback", (req: Request, res: Response) => {
  console.log("✅ STK Callback Received:", req.method);
  console.log(JSON.stringify(req.body, null, 2));

  try {
    // write to disk (append)
    const cb = req.body ?? {};
    let logs: any[] = [];
    if (fs.existsSync("stkcallback.json")) {
      try {
        const raw = fs.readFileSync("stkcallback.json", "utf8");
        logs = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(logs)) logs = [];
      } catch {
        logs = [];
      }
    }

    logs.push({ receivedAt: new Date().toISOString(), body: cb });
    fs.writeFileSync("stkcallback.json", JSON.stringify(logs, null, 2));

    // respond to Safaricom immediately
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (e) {
    console.error("Callback handler error:", e);
    return res.status(500).json({ ResultCode: 1, ResultDesc: "Server Error" });
  }
});

/**
 * Simple C2B confirmation & validation endpoints (mirror for RegisterURL)
 */
router.all("/confirmation", (req: Request, res: Response) => {
  console.log("C2B Confirmation:", JSON.stringify(req.body, null, 2));
  fs.writeFileSync("confirmation.json", JSON.stringify(req.body, null, 2));
  res.status(200).json({ ResultCode: 0, ResultDesc: "Confirmation received" });
});

router.all("/validation", (req: Request, res: Response) => {
  console.log("C2B Validation:", JSON.stringify(req.body, null, 2));
  fs.writeFileSync("validation.json", JSON.stringify(req.body, null, 2));
  res.status(200).json({ ResultCode: 0, ResultDesc: "Validation successful" });
});

export default router;





