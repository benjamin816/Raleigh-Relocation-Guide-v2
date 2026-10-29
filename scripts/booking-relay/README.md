# Booking relay

The static site cannot call the team-owned Apps Script web app directly from a Chrome profile signed into multiple Google accounts. Google rewrites the URL to an account-specific path before the booking script runs. This Worker makes the request server-to-server so the visitor's Google cookies do not affect booking.

The Worker holds no Google credentials. It accepts only the site and local-test origins, POSTs an allowlisted method to the existing Apps Script endpoint, and returns JSON. The Apps Script service still enforces booking availability and verifies Google ID tokens for admin operations.

## Deployment

1. Create a free Cloudflare Worker using `worker.mjs`.
2. Add a Worker text variable named `BOOKING_SCRIPT_URL` containing the deployed team-owned Apps Script `/exec` URL.
3. Deploy the updated Apps Script `Code.gs` containing `doPost` as a new version of the existing Test web app. Keep its existing owner and permissions.
4. Set `window.RALEIGH_BOOKING_RELAY_URL` in `assets/js/booking-relay-config.js` and `bookingRelayUrl` in `assets/js/raleigh-chat-config.js` to the Worker `/booking` URL.
5. Test portal sign-in, appointments, analytics, consultation slots, and chat booking in the user's normal Chrome profile before promoting to main.

Run `node scripts/booking-relay/worker.test.mjs` for the Worker request and origin checks.
