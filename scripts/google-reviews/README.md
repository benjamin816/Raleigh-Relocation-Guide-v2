# Homepage review rotation and optional Google connection

The public homepage keeps its three original testimonials as server-rendered fallback. Its rotating selection adds 13 short, attributed excerpts verified against the owner's two Google profiles on November 25, 2026. Daveion, Cesar and Nataly are mapped to their existing cards, not duplicated. Original edited testimonials remain labeled client testimonials, rather than being represented as verbatim Google reviews. No combined rating, total customer claim, or self-serving aggregate review schema is added.

Desktop shows three cards; mobile shows one. Previous/Next/Pause controls, keyboard focus, hover, hidden tabs, offscreen sections, expanded testimonials, and reduced-motion preferences govern rotation. Network/data errors leave existing testimonials available. One reviewer appears once per cycle; matching stable author identities, provider review IDs, and normalized text suppress duplicate copies across the two profiles and the legacy content.

## Automatic updates: prepared, not connected

`worker.mjs` is a separate read-only adapter suitable for the existing Cloudflare account. It does not touch the booking Worker, calendars, Gmail, or listing edits. Google Business Profile API approval, verified profiles and owner OAuth authorization are required. The existing repository has no Google Business Profile credentials. Do not describe the current manually verified selection as a live Google feed.

After authorization, configure the Worker secrets `GBP_CLIENT_ID`, `GBP_CLIENT_SECRET`, `GBP_REFRESH_TOKEN`, and `GBP_LOCATIONS` (JSON with `team` and `benjamin` exact `accounts/<id>/locations/<id>` resource names). Google uses the broad `business.manage` scope even for these read-only calls; explain that grant before authorization. Do not put credentials in the website, Git, logs, or plaintext handoff files.

If different Google accounts manage the two profiles, use the secret `GBP_REFRESH_TOKENS` JSON with separately authorized `team` and `benjamin` refresh tokens instead of the shared token. Never assume that managing Benjamin's profile grants access to the team profile.

Deploy `/reviews`, verify both source identities and real review counts, then set `data-google-reviews-endpoint` on the homepage section to the verified HTTPS endpoint. The frontend prefers the connected response, with the current selection as failure fallback. Google data is fetched at most once per 24-hour edge-cache window on demand, from Google's owner API, without a laptop or another scheduled job. New reviews enter the rotation on refresh; provider deletions/edits are reconciled by replacing the full successful snapshot. Both profiles and all pagination must succeed before caching. No rating filter is applied.

API response content is kept only in an expiring 24-hour edge cache, not a Git-backed JSON feed or repository history. Responses omit tokens, private account details, and owner replies. Only source/reviewer attribution and short excerpts are exposed. The public route cannot read the internal raw-cache key. Do not create a scraping job or add a paid widget without owner instructions.

References: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list and https://developers.google.com/my-business/content/policies
