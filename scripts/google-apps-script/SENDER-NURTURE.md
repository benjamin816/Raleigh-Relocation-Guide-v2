# Sender nurture deployment

The incumbent `livingSenderSyncLeads` 15-minute trigger calls `LirSenderNurture.run`. Do not create a second trigger or reset the cutover. `SenderNurture.gs` contains the pure routing policy and persistent provider adapter. The live website receiver file contains additive optional email opt-in capture; service emails and CRM intake remain independent.

Protected Master Leads tabs: Mailing Configuration, Mailing Evidence, Mailing Stages and Mailing Audit. Mode QA accepts only owner-controlled `benjamin.raleighrealtor+sender-...@gmail.com` identities and never enters production blitz workflows. LIVE excludes those QA identities. New qualifying evidence must be later than the production cutover and source watermarks. Historical rows are never backfilled.

Workflow dGZ5KJ uses relocation group b8xZP5; dLg8Br uses general group dwA19g. Both have seven group-membership guards, repeat disabled, unchanged day 0/1/3/7/14/21/30 messages and a final copy to existing weekly group dJ2y5D. Only the two named staff work accounts may enter both for internal experience. Never infer permission from a phone number, SMS choice, Raw JSON, or a booking.

The receipt is server-created and bound to the accepted source row; email-update permission requires the optional unchecked email-updates checkbox on the accepted form (notice v2). No address-confirmation emails are sent; retired confirmation links are read-only. Existing suppression always wins. Unknown provider write outcomes are reconciled by reads, never automatically reposted. A real contact or calendar booking latches contact status, removes blitz groups and joins weekly only when verified email permission permits.

Do not edit an active workflow's content while recipients are queued. Do not reactivate suppressed QA or client addresses. Provider membership is not proof of delivered email; verify send events and actual mailbox receipts for QA.
