# Google Apps Script Reference

This folder keeps the website-facing Apps Script exports as plain text for easy review and updates.

## Current exports

- `website-to-sheet-apps-script.txt`
- `website-analytics-apps-script.txt`
- `suburb-quiz-results-email-apps-script.txt`
- `appsscript.json`

## Cross-check rule

When a website change touches any form, field name, consent checkbox, payload key, or analytics event, review the matching script export here before publishing. Confirm that:

1. The submitted field names still match the payload the website sends.
2. Required consent behavior still matches the script expectation.
3. Any new validation or renamed fields are reflected in the script logic.
4. Analytics event names and form identifiers still line up with the website.

The fourth script mentioned in earlier discussion is intentionally not tracked here.

The manifest file is included as the current scope reference for the live Apps Script project. If the deployed script project does not already have these OAuth scopes, paste them into that project's `appsscript.json` and reauthorize after saving.
