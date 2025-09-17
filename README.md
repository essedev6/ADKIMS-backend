# ADKIMS Backend with M-Pesa Integration

This backend service handles M-Pesa payments for the ADKIMS WiFi hotspot system.

## Prerequisites

- Node.js (LTS version)
- TypeScript
- Safaricom Daraja API credentials

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment file:
   ```bash
   cp src/.env.example .env
   ```

3. Update the `.env` file with your Daraja API credentials:
   - `MPESA_CONSUMER_KEY`: Your Daraja API consumer key
   - `MPESA_CONSUMER_SECRET`: Your Daraja API consumer secret
   - `MPESA_SHORTCODE`: Your M-Pesa shortcode (default sandbox: 174379)
   - `MPESA_PASSKEY`: Your M-Pesa passkey
   - `API_BASE_URL`: Your backend API URL (e.g., http://localhost:5000)

## Development

Start the development server:
```bash
npm run dev
```

## Production Build

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## API Endpoints

### M-Pesa STK Push
- **POST** `/mpesa/stkpush`
  - Initiates an M-Pesa STK push request
  - Request body:
    ```json
    {
      "phone": "0712345678",
      "amount": 100,
      "accountNumber": "ADKIMS HOTSPOT"
    }
    ```

### M-Pesa Callback
- **POST** `/mpesa/callback`
  - Handles M-Pesa payment callbacks
  - Called by Safaricom after successful/failed payments

## Testing

Run the test suite:
```bash
npm test
```

## Security Considerations

1. Always use environment variables for sensitive credentials
2. Validate all input using Zod schemas
3. Use HTTPS in production
4. Implement rate limiting for the STK push endpoint
5. Keep your Daraja API credentials secure

## Error Handling

The API returns structured error responses:
```json
{
  "success": false,
  "error": "Error message",
  "details": {} // Optional validation errors
}
```

## Troubleshooting

1. **STK Push not working**
   - Verify phone number format (should start with 07 or 01)
   - Check Daraja API credentials
   - Ensure sufficient funds in test account (for sandbox)

2. **Callback not received**
   - Verify callback URL is accessible
   - Check server logs for errors
   - Ensure proper error handling