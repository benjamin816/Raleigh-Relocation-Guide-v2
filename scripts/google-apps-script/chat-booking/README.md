# Living in Raleigh chat booking service (TEST)

This is a separate Google Apps Script web app. Version 9 was deployed on October 29, 2026 at `https://script.google.com/macros/s/AKfycbysLAettKRWslMW8YgG3BxftA2eBL_gsZFdK70bN7B3xu-aG_stqdNqg3jYBB5aqoMa2g/exec`. The static site cannot read or write a private Google Calendar directly. If the bridge fails, chat offers to pass details to the team or gives the team phone number.

The service checks the Living in Raleigh Team calendar and both hosts' source calendars, uses 60-minute Eastern Time slots, and rechecks the slot under a lock. Version 3 reads each conflict calendar once for the search window, then evaluates slots in memory. It reads the existing `Appointment Assignments` ledger, favors openings for the host due next, and reserves a named Benjamin or Ricardo request only when that person is available. By default it offers an afternoon and an evening opening; a visitor can request mornings, a particular day, weekends, or a named host. On booking it creates one event on the team calendar, invites the visitor and assigned host, writes the assignment ledger, and writes the lead to `Chat Appointments`. The existing 10-minute round-robin job recognizes the ledger row and sends the team notification. The visitor does not need an emailed code.

The owner then authorized deployment for testing. The local Test site has `chatVideoBookingEnabled` and `chatRoundRobinBookingEnabled` enabled. An event created directly is not a Google Appointment Schedule booking. Version 6 includes the full admin availability feed and joint-host booking. New events are marked for the standard calendar-to-sheet and pre-call email pipeline. Older chat events are excluded from that pipeline because the chat service already emailed them directly. The existing five-minute emailer is the sole pre-call sender for new chat/admin bookings, approximately 30 minutes after the booking is logged. It reads the host from the Appointment Assignments ledger and personalizes the display name and sign-off for Benjamin or Ricardo; a Both assignment uses the Living in Raleigh Team. The sender now runs under livinginraleighteam@gmail.com. A new end-to-end portal booking and pre-call email delivery have not yet been verified.

## Deployment and verification

1. Confirm the existing Google appointment schedule's weekly availability and exceptions before deployment. The October 27 owner screenshot shows the seven-day windows below; the 60-day scheduling limit and four-hour notice in code must also be checked against the live schedule.
2. Set `CHAT_BOOKING_WINDOWS` in the Apps Script project's Script Properties to this seven-element array indexed Sunday through Saturday. Update it whenever the `/consult/` Google appointment schedule changes: `[[["14:00","17:00"]],[["12:00","14:00"],["16:00","18:00"]],[["14:00","16:00"],["18:00","20:00"]],[["13:00","14:00"],["16:00","17:00"]],[["12:00","14:00"],["18:00","20:00"]],[["11:00","13:00"],["17:00","20:00"]],[["10:00","13:00"],["15:00","17:00"]]]`.
3. Set the Apps Script project timezone to `America/New_York`, use the checked-in manifest, and deploy the web app to execute as its owner. This grants the service access to the team calendar, both hosts' conflict calendars, email for calendar invitations and repair alerts, and the Living in Raleigh lead workbook. Keep the resulting deployment URL in the website config only; never put Google credentials there.
4. Availability returned real slots in the local Test chat after version 3 deployment on October 27, including default openings and a Ricardo Saturday morning request. The iframe bridge avoids the multi-account Chrome routing error seen with an earlier direct request.
5. Still to verify: compare availability against `/consult/`, including a Benjamin-only, Ricardo-only, and both-available slot. Then make one authorized test booking, confirm the visitor and assigned host invitations, Google Meet link for video, round-robin ledger, `Chat Appointments` row, and pre-call email; remove the test event afterward.

The public service limits completed bookings to 20 per day globally and two per email per day, checks availability again before creating the event, and reuses a six-hour receipt for duplicate requests. These limits reduce accidental repeats and volume abuse, but they cannot prove that the visitor owns the email address or stop someone from entering false contact details. Monitor the calendar and raise or lower the daily cap based on real traffic. If abuse appears, add a stronger server-side challenge or return to the native Google booking page.

## Admin consultation page

`/admin/` is the three-tab portal. It uses Google Sign-In and checks each ID token on the team-owned booking service before returning appointment or analytics data or accepting transfer/cancellation commands. The Google sign-in client is in the separate Living in Raleigh Team Portal Cloud project. Its accepted test accounts are `benjamin.raleighrealtor@gmail.com` and `ricardo@triangleexperts.com`; Google rejected `benjamin.carver@exprealty.com` as a test user because it is not currently a Google account. The public client ID is saved as the booking project's `ADMIN_GOOGLE_CLIENT_ID` script property. On October 29, the team-owned script successfully ran a `UrlFetchApp.fetch` authorization check, confirming `script.external_request` access; the temporary check function was removed afterward. The standalone `/admin/consult/` page now directs staff to `/admin/`; inside the portal it unlocks only after a protected session check. Both pages are excluded from indexing.

The portal shows Schedule Consults, Upcoming Appointments, and Living website analytics. Appointments come from the team calendar, round-robin ledger, and pre-call email tracking tab; transfer/add-both and cancellation require two confirmations. Analytics reads raw Living Event Log rows and warns if real page views are stale. The read-only Apps Script check on October 29 found 5 tracked visits today, one upcoming appointment, and Ricardo next in rotation. Full sign-in and action tests remain pending: the current Benjamin (Work) Chrome profile rewrites the valid public Apps Script URL to `/macros/u/4/s/...`, which returns Page Not Found, while the clean in-app browser loads the bridge. Test in the separate regular Chrome profile for the intended admin account before publishing `/admin/` on main. Do not link to `/admin/` in booking notifications until the portal is live on main.

The page loads 30 days of openings in one server request, then displays five days at a time in vertical columns. Benjamin, Ricardo, and Both choices filter that local result immediately. The round-robin note shows who is next, but the admin explicitly selects the host. Refresh rechecks the calendars. Booking rechecks availability under the existing lock; a Both booking requires both hosts free and invites both. The event and assignment are written to the team calendar and `Appointment Assignments`, and the contact is added to `Chat Appointments`. The admin form does not use the public Google appointment schedule iframe. The 30-day list is only a preview; the booking recheck is authoritative.

## Portal analytics and saved views (October 29, 2026)

Version 15 adds `PortalAnalytics.gs`; deploy that file with `AdminPortalService.gs` and the manifest's Advanced Sheets service. The existing protected relay/sign-in path is working in Chrome. Appointment snapshots cache for 20 seconds, analytics for five minutes, and browser snapshots are scoped to the verified viewer and range for up to seven days. A saved view is shown immediately while a fresh authorized request runs; the UI refreshes the visible tab every minute. A host must be selected before the schedule grid appears.

Analytics scans bounded raw-log chunks without assuming event-date order. Page views and sessions are distinct; total leads deduplicate normalized email addresses across Website Direct Leads, the relocation guide, Website Chat Leads and Appointments Booked Directly. Historical guide/booking records cannot distinguish website attribution from directly shared links. Visible time accepts only corrected `metrics_v2` timing; earlier background-tab timing is excluded. Chat starts and confirmed bookings use an anonymous conversation ID in interaction_source; local/hidden-preview test chats are excluded. No conversation text or contact information is added to analytics. Historical chat conversion cannot be reconstructed. The new browser collection code remains on Test until promoted; real production timing and chat metrics begin after that promotion. Chat booking authority remains paused separately.

## Future team-calendar availability policy

Booking service version 16 and the existing round-robin trigger apply Free transparency only to new consults created on/after October 29, 2026, 6:10:37 p.m. Eastern. The team account remains the organizer; host transfers explicitly protect it. The existing October 30, 11 a.m. appointment (`0k0km3phn87a8g0m8f2pguhf3k`) is additionally excluded by ID. Older appointments are unchanged. Only the team copy is marked Free; transparency is private to each calendar copy. Availability and admin transfer checks also reserve each assigned host directly from team-calendar appointments, regardless of RSVP or host-copy transparency. Unknown pending bookings fail closed in the booking service. The round-robin script includes assigned consults in host conflict windows and preserves its existing trigger and notification receipt logic. Native Google appointment-schedule slots remain single-booking slots; this does not change that Google limitation. Public chatbot booking authority remains paused.


### Test: out-of-state seller referral phone calls

The Test widget first qualifies how long a relocating visitor plans to rent. Three months or less routes straight to a normal exploration call about the eventual purchase. Six to twelve months or longer routes confirmed out-of-state sellers to rental resources and a quick listing-agent referral phone call; a vague rental plan is clarified before offering slots. Local property sales, bridge rentals before buying, investors, rental-only visitors without a home to sell, and refusals keep their existing routes.

`Code.gs` now advertises `referralMinutes: 15` on slot results. A `book` request with `appointmentType: "seller_referral"`, `durationMinutes: 15`, `callType: "phone"`, and `purpose: "Sell"` creates a 15-minute event through the same host selection, assignment ledger, lead sheet, idempotency protection and standard pre-call email pipeline. Other calls remain 60 minutes. Availability remains conservatively limited to existing full-length bookable openings; the new route does not open extra hours.

This source update needs deployment to the existing booking web app before live referral writes are supported. The widget checks the slot capability marker and will not submit a short-call booking to an older service that would silently create 60 minutes. Keep `CHAT_BOOKING_TEST_READ_ONLY=true` until the owner explicitly restores booking authority. Do not create a second deployment or email sender merely for this track.


## Remembered admin devices (deployed October 30, 2026)

The existing Test web app now runs version 17, adding revocable 30-day admin device sessions. Initial Google authentication is unchanged; a valid Google identity is exchanged for an opaque device token. Every subsequent private request verifies the stored token digest, expiry and current allowed email list. Signing out revokes the device session. The existing Cloudflare Worker forwards these device tokens to Apps Script for validation; it never turns an unverified device token into an identity assertion. Its existing URL binding and signing secret were preserved.

The local Test portal was verified in Chrome after one normal Google sign-in: a newly created tab opened Upcoming Appointments automatically under the same authorized account with a fresh data update. Browser tests cover reopening with empty tab storage; service tests cover expiry, invalid tokens, logout and account removal. The temporary deployment token was deleted and its local temporary copy removed. Public chatbot booking authority remains paused; the separate 15-minute referral-call source changes were not deployed with this session-only update. No Test-to-main merge was performed.

## November 2, 2026 live release

The owner authorized restoring public chat booking authority and promoting Test
to main. Existing web-app deployment updated to version 18 under the same team
account and URL. `CHAT_BOOKING_TEST_READ_ONLY` is now `false`. Version 18 includes
15-minute seller-referral phone calls and `midday` availability (11 a.m.–before
3 p.m. Eastern), within the existing appointment windows and individual host
conflict checks. Existing normal exploration calls remain 60 minutes.

A real 15-minute phone test assigned Benjamin, created the calendar event and
verified both the Assignment and Chat Appointments rows and standard pre-call
marker. The event and exact test rows were immediately removed. No existing
appointment was changed. The temporary owner verification function was removed
before deployment. The pre-call emailer remains the single existing sender;
this verification did not wait for or send a test pre-call email.

Rollback copies of both branches and current live Code.gs are in the verified
local backup `backups/chat-live-20261102-155810/`. Its Git bundle preserves local
Test, remote Test and remote main history before promotion. Version 17 remains
available in Apps Script deployment history.


## Private admin custom times (November 3, 2026)

Each of the five visible day columns has a bottom `+` control after a host is chosen. The dialog accepts a custom date and Eastern time, checks calendars, then lets the admin select the checked time and finish the normal client-details form. These are one-off 60-minute appointments within the next 365 days; they do not change public schedule windows or add inventory.

`customCheck` and `customBook` are actions inside `adminPortalRequest`, after the existing account/device-session verification. They are not public bridge methods. `customBook` uses the same event/invitation, host assignment, ledger, lead and pre-call pipeline as normal bookings. It checks calendars again under the existing booking lock immediately before creation and preserves idempotency. A conflict or calendar-read failure prevents booking; there is no override.

For the selected host(s), every overlapping real source-calendar event blocks a custom time, including events marked Free. Synthetic mirror blocks are ignored; assigned team appointments still reserve their assigned host even when the shared-calendar event is Free. Adjacent events are allowed. Conflict responses include only host names and start/end times, never calendar titles, descriptions, attendee lists or calendar IDs. Both requires both hosts to be clear. DST skipped or repeated local start times are rejected explicitly rather than guessed.

Focused tests: `node --test tests/admin-custom-time.test.cjs tests/admin-custom-time-ui.test.cjs`. The backend calendars, writes and UI fetch calls are all in-memory fixtures; no real appointments or invitations are created during verification. Isolated browser fixture/screenshots live under ignored `output/admin-custom-time-review/`.


Release verification: Test implementation commit `824e728a` was pushed and its consult script blob matched the remote Test branch. The existing team-owned booking deployment was updated from version 18 to **version 19** on November 3, 2026 at 9:57 a.m. Eastern, retaining the endpoint, execution account, scopes, calendars and access settings. Live `Code.gs` and `AdminPortalService.gs` were backed up under `backups/admin-custom-time-20261103/` and matched the previous repository baseline. Saved release readback matched the tested source. A temporary owner-only read-only check exercised the real calendars for Benjamin, Ricardo and Both (zero writes), then was removed before deployment. No real appointment, calendar event or invitation was created during testing. Local verification passed 33 site/test suites and 6 booking/relay suites, including the two focused custom-time suites.
