# Google Apps Script Reference

This folder keeps the website-facing Apps Script exports as plain text for easy review and updates.

## Current exports

- `website-to-sheet-apps-script.txt`
- `website-analytics-apps-script.txt`
- `suburb-hood-quiz-results-email-apps-script.txt` — combined suburb + neighborhood quiz results email export
- `appsscript.json`
- `boldtrail-lead-sheet-apps-script.txt`
- `boldtrail-lead-sheet-appsscript.json`

## Website analytics runtime (October 27, 2026)

- Live Apps Script project: https://script.google.com/home/projects/18DUT2ovTLBkHX-i7aX9gNxcanQKYXlQJnUpWdqVlCAVNu7LAcYZRoS3l/edit
- Web app receiver: https://script.google.com/macros/s/AKfycbyHpfCG_6Dv9u_IopAZ9J5MbFF37AqgSBVsOJHDK2OsVQKzyNN_yw_nkYBpXIV-Ll12/exec
- The public web app accepts analytics POSTs. Its GET is a health check; it does not run public diagnostics or summary rebuilds.
- Raw events are inserted newest-first at row 2 of each audience's separate `Event Log`: Living sheet `1onTitTejjU9UxZP6TW5pFj0TFdFq0cewPPIS52cieRE`; Investing sheet `1KmVkIfisuPaOnkYdXygJh0BdA6na5uXksR6neiEB_do`.
- Raw ingestion does not rebuild summary tabs on every visit. A Head time trigger runs `refreshAnalyticsSummaries` daily between 3 and 4 a.m. Eastern for both sheets and sends immediate failure notifications.
- Weekly and monthly snapshot emails are handled by Codex automations reading raw events. No Apps Script email trigger is installed.
- The checked-in `website-analytics-apps-script.txt` is an older reference export and lacks later investor routing. Export the live project before using it for a future deployment.


## Cross-check rule

When a website change touches any form, field name, consent checkbox, payload key, or analytics event, review the matching script export here before publishing. Confirm that:

1. The submitted field names still match the payload the website sends.
2. Required consent behavior still matches the script expectation.
3. Any new validation or renamed fields are reflected in the script logic.
4. Analytics event names and form identifiers still line up with the website.

The fourth script mentioned in earlier discussion is intentionally not tracked here.

The manifest file is included as the current scope reference for the live Apps Script project. If the deployed script project does not already have these OAuth scopes, paste them into that project's `appsscript.json` and reauthorize after saving.
The Relo Guide attachment helper now expects the compressed PDF to be reachable at the public HTTPS URL in the script, with a `www` fallback. If that URL returns 404, the attachment will not be included until the file is actually published there.

## Layout editor snapshots

The in-browser layout editor now keeps a per-page snapshot trail in localStorage instead of only storing one overwrite-only state. Use the `Snapshots` list in the toolbar to roll back to earlier saved states.

The `Reset` button returns the layout to its default baseline and records that as a new snapshot, so the history stays intact.

## Current Living newsletter subscriber sync (October 27, 2026)

- The live `LEAD SHEET to BoldTrail` Apps Script project now also contains `LivingSenderSync.gs`, sourced from this folder. Its `livingSenderSyncLeads` trigger runs every 15 minutes.
- The Sender API token is stored only in the project's `SENDER_API_TOKEN` Script Property and an optional current-user encrypted Windows credential for approved campaign scheduling. Never commit it or paste it into a source file.
- The Sender audience is the `Living in Raleigh Weekly Newsletter` group, ID `dJ2y5D`. The sync reads only the Living Master Leads spreadsheet and excludes local test records and investor paths or lead types. It never opens the Investor Master Lead Sheet or reactivates suppressed subscribers.
- The historical Living-to-BoldTrail trigger `syncUnsentWebsiteLeadsToBoldTrail` was removed. The separate investor BoldTrail trigger remains active.
- New Living newsletter campaigns are prepared from explicitly approved HTML through `scripts/sender/Publish-LivingNewsletter.ps1`, in Thursday 10 a.m. Eastern slots. The publisher checks the approved file hash, Sender unsubscribe link, group ID, and existing scheduled campaigns. It needs a current-user encrypted Sender token installed with `scripts/sender/Install-SenderToken.ps1`.
- Sending-domain authentication in Squarespace DNS must be verified before any campaign is scheduled. The existing Squarespace email-forwarding SPF preset must not be duplicated or removed casually.

## Historical BoldTrail lead sheet sync

The separate BoldTrail script is tracked here as its own export so it stays independent from the website intake webhook.

Set these script properties in the BoldTrail Apps Script project:

- `BOLDTRAIL_API_KEY`
- `BOLDTRAIL_SPREADSHEET_ID`

The ongoing BoldTrail trigger reads the workbook by exact tab name:

- `Website Direct Leads`
- `Appointments Booked Directly`

The legacy `2026 Relocation Guide - Kit` tab is handled only by the manual `syncLegacyKitLeadsToBoldTrailOnce()` migration helper. It is not scanned by the scheduled trigger.

Routing rules:

- Relo Guide website leads write into `Website Direct Leads`, send the guide email immediately, and sync to BoldTrail with `30_day_blitz_relo`
- The direct Relo Guide source label is `Relo Guide Direct from Website`
- The guide email uses the compressed PDF asset in `assets/downloads/` as an attachment when it can be fetched
- Website leads sync immediately; leads with a phone get `monthly_newsletter`, leads without a phone get `30_day_blitz_no_phone`
- Direct booking leads sync immediately and always get `monthly_newsletter`
- Leads with a phone are pushed into BoldTrail as Prospect-equivalent contacts with text opted in; leads without a phone stay in the lead bucket
- BoldTrail status is set explicitly on the contact record and tags are attached through the contact tags endpoint after the upsert
- Existing BoldTrail contacts that already have a phone remain Prospect-equivalent and keep phone/text enabled when a later email-only submission arrives
- Every synced contact also receives one or more `lead_source_*` hashtags identifying the exact intake, including buyer page, seller page, call-me popup, new construction, relocation guide, suburb quiz, neighborhood quiz, and direct consult booking

Use `resetBoldTrailLeadSyncState()` if you want to clear BoldTrail sync columns from the two ongoing lead tabs and rerun a clean test.
Use `resetLegacyKitBoldTrailMigration()` only when you intentionally need to clear and rerun the one-time Kit migration.
Run `backfillBoldTrailLeadSourceHashtagsOnce()` after installing this version to add the new source hashtags to historical BoldTrail contacts. The function stores its cursor and can be run again if its result says more work remains.
Use `resetBoldTrailLeadSourceHashtagBackfill()` only when you intentionally want to rerun that historical hashtag backfill from the beginning.
The sync is keyed by email in BoldTrail, so repeated rows for the same person will update one contact instead of creating a second one.

To rebuild the trigger, run `resetBoldTrailLeadTrigger()` and then `installBoldTrailLeadTrigger()` in the BoldTrail Apps Script project.

For the Relo Guide delivery test helper, you can optionally set `RELO_GUIDE_TEST_EMAIL` in the website-to-sheet Apps Script project. If it is blank, the test helper falls back to `benjamin.raleighrealtor@gmail.com`.
If you want the guide email to send from a different existing Gmail alias, set `RELO_GUIDE_FROM_ALIAS` to that alias in Script Properties. The alias still has to already exist on the connected Gmail account.
