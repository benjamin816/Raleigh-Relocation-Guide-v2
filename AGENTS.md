# Website rollback policy

Direct owner instruction, November 25, 2026:

- Keep only one current full website rollback package locally, under the sibling `Raleigh-Relocation-Guide-v2-backups/current-rollback` directory. Do not accumulate dated full ZIPs, duplicate repository copies, or backup/rollback Git branches.
- Before replacing the current package, build and verify its replacement. Preserve the current Main and Test commits plus any unfinished local edits, untracked source files, and existing stash needed to restore the pre-change state. Verify Git bundle integrity and saved-file hashes before discarding anything.
- After the new package is verified, purge older full website backups and retired backup refs unless the owner explicitly requests an exception. Check resolved absolute paths before any recursive removal. Do not delete unrelated projects, live worktrees, source transcripts, deployment receipts, or review/approval evidence as though they were redundant full backups.
- Before syncing Test from Main, preserve Test-only and uncommitted work in that package. Do not promote unfinished Test changes to Main. Verify the remote branches and the active Test checkout match after the sync.
- No SEO changes are authorized by the backup/sync request alone.
