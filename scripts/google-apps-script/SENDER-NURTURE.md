# Sender nurture deployment

The incumbent `livingSenderSyncLeads` 15-minute trigger calls `LirSenderNurture.run`. Do not create a second trigger or reset the cutover. `SenderNurture.gs` contains the pure routing policy and persistent provider adapter. The live website receiver file contains additive optional email opt-in capture; service emails and CRM intake remain independent.

Protected Master Leads tabs: Mailing Configuration, Mailing Evidence, Mailing Stages and Mailing Audit. Mode QA accepts only owner-controlled `benjamin.raleighrealtor+sender-...@gmail.com` identities and never enters production blitz workflows. LIVE excludes those QA identities. New qualifying evidence must be later than the production cutover and source watermarks. Historical rows are never backfilled.

Workflow dGZ5KJ uses relocation group b8xZP5; dLg8Br uses general group dwA19g. Both have seven group-membership guards, repeat disabled, unchanged day 0/1/3/7/14/21/30 messages and a final copy to existing weekly group dJ2y5D. Only the two named staff work accounts may enter both for internal experience. Never infer permission from a phone number, SMS choice, Raw JSON, or a booking.

The receipt is server-created and bound to the accepted source row; email-update permission requires the optional unchecked email-updates checkbox on the accepted form (notice v2). No address-confirmation emails are sent; retired confirmation links are read-only. Existing suppression always wins. Unknown provider write outcomes are reconciled by reads, never automatically reposted. A real contact or calendar booking latches contact status, removes blitz groups and joins weekly only when verified email permission permits.

Do not edit an active workflow's content while recipients are queued. Do not reactivate suppressed QA or client addresses. Provider membership is not proof of delivered email; verify send events and actual mailbox receipts for QA.

## Verified production cutover — November 25, 2026

Both existing workflows are ACTIVE. LIVE cutover: 2026-11-25T17:06:20.215Z (12:06 p.m. Eastern). Source watermarks: Website Direct Leads 95, Kit 57, Appointments Booked Directly 27, Website Chat 2, Chat Appointments 2. Do not reset these to backfill. The incumbent automatic run completed at 12:12:15 p.m. Eastern in 5.605 seconds; no additional scheduler was created.

The explicitly authorized internal profiles 4LqpZB7 and Wqlg4rn entered both groups. Sender recorded both day-zero sends for each at 12:08:34 p.m. Eastern: transactional campaigns aAQRv1 and dJY40l. Their protected Mailing Stages records include these send-event references. Existing weekly membership was retained once per profile. QA workflow b48Rvx is DRAFT; its owned unsubscribed test profile remains suppressed.

## Client-facing sender inventory

| Email | From | Verification |
| --- | --- | --- |
| Relocation nurture | hello@raleighncguide.com | Sender configuration, native content and actual QA headers |
| General nurture | hello@raleighncguide.com | Sender configuration, native content and actual QA headers |
| Weekly newsletter | hello@raleighncguide.com | Actual November 23 message headers |
| Requested relocation guide | livinginraleighteam@gmail.com | Live receiver v32; actual November 25 guide headers |
| Suburb quiz results | livinginraleighteam@gmail.com | Existing script updated and Gmail permission authorized; read-only alias check passed; no queued client mail manually run |
| Neighborhood quiz results | livinginraleighteam@gmail.com | Same authorized script and fail-closed team alias helper |
| What To Know Before Our Call | livinginraleighteam@gmail.com | Existing other-user trigger retained; team-sender test receipt after October 29 migration |
| Calendar booking/update invitations | livinginraleighteam@gmail.com | Actual November 12 invitation headers |

Contact/intake and chatbot code inspected in this repository send internal alerts to the team; they do not introduce a separate client acknowledgment email. FUB intake remains independent and unchanged. This inventory concerns website automation, not manually sent agent emails or unrelated CRM campaigns.

The three address-confirmation emails were sent only to owned QA aliases; none went to real leads. Confirmation sending was removed entirely. The guide and quiz helpers hold rather than fall back to a personal sender if the team alias is unavailable. Display names can still identify the assigned agent; the email address must remain one of the two approved senders above.
