# Booking relay

Portal sign-ins are verified with Google by the Worker. The Worker and Apps Script
share an `ADMIN_ASSERTION_KEY` secret stored only in their service settings.
Assertions expire after 60 seconds, bind the exact action and payload, and can be
used once. No Google ID token is forwarded to Apps Script on this path. Keep the
allowed account lists aligned in both files. Never commit the signing key.

The static site cannot call the team-owned Apps Script web app directly from a Chrome profile signed into multiple Google accounts. Google rewrites the URL to an account-specific path before the booking script runs. This Worker makes the request server-to-server so the visitor's Google cookies do not affect booking.

The Worker holds no Google credentials. It accepts only the site and local-test origins, POSTs an allowlisted method to the existing Apps Script endpoint, and returns JSON. The Apps Script service still enforces booking availability and verifies Google ID tokens for admin operations.

## Deployment

1. Create a free Cloudflare Worker using `worker.mjs`.
2. Add a Worker text variable named `BOOKING_SCRIPT_URL` containing the deployed team-owned Apps Script `/exec` URL.
3. Deploy the updated Apps Script `Code.gs` containing `doPost` as a new version of the existing Test web app. Keep its existing owner and permissions.
4. Set `window.RALEIGH_BOOKING_RELAY_URL` in `assets/js/booking-relay-config.js` and `bookingRelayUrl` in `assets/js/raleigh-chat-config.js` to the Worker `/booking` URL.
5. Test portal sign-in, appointments, analytics, consultation slots, and chat booking in the user's normal Chrome profile before promoting to main.

Run `node scripts/booking-relay/worker.test.mjs` for the Worker request and origin checks.

## Device sessions (deployed October 30, 2026)

The original portal reused Google's short-lived ID token for every request and never established its own device session. The deployed service exchanges a freshly verified Google identity for a random 256-bit `ps1` bearer token valid for 30 days. Apps Script stores only its SHA-256 digest and verifies expiry and the current email allowlist on every private request. The Worker forwards these opaque tokens unchanged, without issuing an identity assertion for them; only the backend can validate them. Initial Google sign-ins still use the existing Google verification and 60-second, action-bound signed assertion. Sign out revokes that device's server record. Up to ten devices per account are retained; expired sessions are removed. The browser stores the device token locally and shares it with the same-origin scheduling frame through sessionStorage. The owner approved the 30-day device sessions and the temporary deployment token on October 30. Apps Script version 17 and the existing Worker now support this path; no account allowlist or Google permissions changed. The temporary deployment token was deleted after use. Tests cover expiry, forgery, logout revocation, account removal, and device limits.


## Admin accounts added November 3, 2026

At the owner's explicit request, `ricardo.realestate23@gmail.com` and `livinginraleighteam@gmail.com` are authorized in both the Worker Google-identity allowlist and Apps Script `ADMIN_ALLOWED_EMAILS`. Existing accounts remain authorized. Identity checks, signed action-bound assertions, backend device-session verification and the 30-day session policy remain intact. This changes portal access only; host calendars, host invitation addresses, endpoints, secrets and booking assignment rules remain unchanged.

Worker deployment `957344d3` and existing Apps Script deployment version 20 contain the update. The account checks were verified with mocked Google identities and signed assertions for both requested accounts, plus rejection of an unlisted account. No new credential was created; the already signed-in Cloudflare editor was used after the former temporary deployment token had expired. Source backups are under `backups/admin-access-20261103/`.
