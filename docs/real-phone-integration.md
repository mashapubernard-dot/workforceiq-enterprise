# WorkforceIQ Real Phone Integration (VoIP)

WorkforceIQ uses Twilio Voice SDK for real browser-based internet calls. This is separate from the existing call log UI.

## Required Vercel environment variables

Add these under the WorkforceIQ Vercel project's Environment Variables, for Preview and Production as appropriate:

- `TWILIO_ACCOUNT_SID` — Twilio account SID (AC...)
- `TWILIO_API_KEY_SID` — Twilio API key SID (SK...)
- `TWILIO_API_KEY_SECRET` — secret for that API key
- `TWILIO_TWIML_APP_SID` — TwiML App SID
- `TWILIO_AUTH_TOKEN` — Twilio account auth token (used only to validate Twilio webhook signatures)
- `TWILIO_CALLER_ID` — a Twilio phone number or verified caller ID in E.164 format
- Existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must already be set.

Never place Twilio secrets in a `NEXT_PUBLIC_*` variable or in client-side code.

## Twilio Console setup

1. Create a Twilio account and enable Programmable Voice.
2. Create an API key and keep its secret private.
3. Create a TwiML App.
4. Set the TwiML App's Voice Request URL to `https://YOUR-PRODUCTION-DOMAIN/api/telephony/twiml`, HTTP method **POST**.
5. Set the caller ID to a Twilio number or verified outbound caller ID allowed by the account.
6. Add the environment variables above to Vercel, then redeploy.
7. Test first with numbers permitted by the account. Trial accounts may require the destination number to be verified. Ensure Voice geographic permissions allow the destinations you intend to call.

The token endpoint verifies the caller's Supabase session and creates a short-lived (one-hour) Twilio access token. The TwiML endpoint validates Twilio's request signature and only dials E.164 destination numbers.

## Current scope and limitations

- The new Real Internet Calling panel in `/dialer` initiates actual Twilio Voice SDK calls once configured.
- Mute and hang-up operate on the live SDK call.
- The existing Workforce Dialer and call outcome logging remain in place.
- Existing simulated call controls in the legacy dialer have not been converted into real telephony controls; use the new **Real Internet Calling** panel for actual VoIP.
- Call recording, transfer, hold, supervisor monitoring, and automated call outcome reconciliation are not enabled.
- Outbound call charges and applicable South African telecoms/privacy requirements may apply.
