# Investor calculator lead sync

The calculator intake web app writes to the separate `INVESTOR MASTER LEAD SHEET` (`Investor Leads` tab). Its X:AC columns record the newsletter choice and CRM status. The deployed intake source is in the calculator repository at `scripts/investor-lead-apps-script.gs`.

`investor-boldtrail-sync.gs` is installed in the existing `LEAD SHEET to BoldTrail` Apps Script project and runs every five minutes. It reuses that project's `BOLDTRAIL_API_KEY` and helper functions. Every new calculator lead receives the `investor` tag plus a calculator source tag. Only rows with an explicit `Yes` in `Investor Newsletter Opt-In` receive `investor_newsletter`. Phone/text marketing flags remain off; the newsletter choice only controls investor email preference. The script records `synced`, `failed`, or `skipped_no_email` in the sheet.

Living in Raleigh newsletters must exclude contacts tagged `investor` or `investor_newsletter`, even if a contact also has the older `monthly_newsletter` tag. Investor campaigns must target `investor_newsletter` only. Verify these filters in BoldTrail before any campaign is scheduled or sent.

Investor articles use newly published videos from `https://www.youtube.com/@InvestinginRaleighNC/videos` (Saturday at 2 p.m. Eastern). The workflow obtains and verifies actual captions before drafting; the `Investing in Raleigh Transcriptions/Ready To Go` inbox is a fallback when captions are unavailable. Review pages are noindex; public articles are added under `/invest/resources/` only after owner approval.
