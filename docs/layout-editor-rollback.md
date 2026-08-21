# Layout Editor Rollback

The visual layout editor now keeps a snapshot trail per page in browser storage.

## What changed

- Every drag or resize records a new snapshot when the edit is committed.
- The `Save` button records a named snapshot.
- The `Reset` button returns the page to its default baseline and keeps the history intact.
- The snapshot list in the toolbar can be used to restore earlier states.

## Pages covered

- `2026`
- `consult`

## Important note

The snapshot trail is local to the browser profile that created it.
For a durable project-level rollback, the HTML and editor files should still be kept under git history.

## Current baseline

- The `2026` page has been restored to the pre-JSON version that was pasted back into the repo.
- The editor now keeps a usable trail so future layout edits can be stepped back without losing the earlier state.
- The 2026 layout-editor state now uses a fresh versioned storage key so old experiments do not leak into the new header baseline.
