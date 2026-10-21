# Verification notes

Checked locally on 21 October 2026.

## Automated

`npm test`: 39 passing tests across three files.

Coverage includes source offsets, passive requirements, prohibitions, optional instructions, explicit and ambiguous dates, missing years, decimals, Hindi date label order, timezone-stable dates, revision state retention and removals, calendar inclusion rules, content escaping, UTF-8 line folding, AI source-quote validation, incomplete provider output, per-import consent, request size, same-origin requests, and basic throttling.

`npm run build`: passed, including Next.js TypeScript checking and production page generation. `npm run typecheck` also passed during development. The application does not require a model key to build or run its local mode.

Provider tests use mocked Responses API replies. No live model request was made, because an API key was not configured. These tests establish request and validation behavior, not live model accuracy or translation quality.

## Browser

- Imported pasted notice text containing an explicit deadline, a relative weekday, and an ambiguous numeric date. The last two stayed unresolved and flagged for review.
- Reloaded the page and verified that notices and current selection persisted.
- Read a generated one-page text PDF in the browser and verified the extracted instructions.
- Read an English PNG screenshot through Tesseract.js and verified its extracted text and resulting three-step checklist.
- Confirmed a date, downloaded a calendar file, and checked its real CRLF lines, event date, end date, and reminder alarm. Import into an external calendar application was not performed.
- Applied the museum sample revision and verified the extended consent deadline, changed packing list, and reset confirmation for changed steps.
- Switched the sample to Hindi and verified translated headings and all four checklist instructions.
- Opened the month calendar and verified the three dated sample steps and confirmation labels.
- Removed the fictional test notices using the app’s own controls, then restarted the sample demo.
- Inspected the 390 × 844 mobile layout and 1280 × 900 desktop layout. The desktop page did not overflow horizontally. Hidden mobile navigation is inert until opened.

The saved screenshot shows the final desktop sample state with the selected instruction highlighted in the source. Read-aloud was not played during testing; availability still depends on browser speech support and installed language voices. Scanned-PDF OCR uses the same recognition worker as PNG imports, but was not separately exercised.
