# NoticeBridge

**School notices → clear actions, in your language.**

NoticeBridge is a family workspace for school circulars. Upload a PDF or screenshot, or paste a notice. Find the next steps, check the source wording, compare a revised circular, and export the dates you confirm.

Built for NextSpark Hacks 2026. The school and circulars in the demo are fictional.

## Run locally

Use Node.js 22 or newer (Node 24 recommended).

```sh
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). No account or API key is needed for the local extraction engine or the sample demo.

```sh
npm test             # Extraction, date uncertainty, revisions, calendar exports
npm run typecheck   # TypeScript checks
npm run build       # Production build
npm start           # Serve the production build
```

The install script copies the matching PDF.js worker into `public/`. Run `npm install` after changing the PDF.js dependency.

## Try the demo

1. Start with the science museum sample, clearly labeled **Sample notice**.
2. Select **See source** on an instruction. Its exact supporting text is highlighted.
3. Select **Review date**, check the source, and confirm it.
4. Select **Export calendar**. Open the downloaded `.ics` file in your calendar app.
5. Select **Try a sample revision**. The consent deadline changes from 24 to 27 October; the packing list gains a school ID card. Both changed steps need fresh confirmation, while unchanged steps keep their completion state.
6. Switch to **हिंदी**. The sample has Hindi translations. Read-aloud uses the voices installed on your device.
7. Add your own notice using **New notice**. Files are extracted in the browser, and the extracted text is editable before analysis.

## Optional AI extraction and Hindi translation

Copy `.env.example` to `.env.local`, add your own `OPENAI_API_KEY`, and restart the server. Never commit your key. `OPENAI_MODEL` defaults to `gpt-4.1-mini` and can be set to a Responses API model supporting structured outputs.

AI processing is **off by default**. Each import offers a checkbox explaining that extracted notice text will be sent to OpenAI. Local imports never call the analysis endpoint. The server uses the Responses API with a strict output schema and `store: false`. This setting disables response storage, and is not a promise of zero provider retention; review your provider account’s data policies.

The server rejects AI actions whose quoted evidence is not an exact substring of the uploaded notice text. Calendar dates come from deterministic parsing of that evidence, not from dates invented by the model. This validates quotation locations, not every semantic claim or translation; people should still review the notice.

AI errors remain visible and offer local extraction as an explicit alternative. There is no silent fallback presented as an AI result.

## What works

- English notice extraction for common action verbs, preserving exact source spans.
- English and Hindi interface controls; sample Hindi translations; full notice translation with the optional AI connection.
- Text PDFs, English image OCR, scanned-PDF OCR, and pasted or `.txt` text.
- PDF.js parsing and Tesseract.js recognition in the browser; files are limited to 10 MB and PDFs to eight pages.
- Checklists, completion state, individual date review, and saved notices in browser local storage.
- Revision matching for additions, changes, and removals, with the immediately previous source retained.
- Month calendar and RFC 5545 calendar-file export, restricted to unfinished steps with confirmed dates.
- All-day reminders with an alert one day before; UTF-8-safe line folding and calendar text escaping.
- Responsive layout, keyboard controls, native accessible dialogs, reduced-motion support, and device-based read-aloud.

## Practical limits

- The local extractor is rule based and supports English. It can miss indirect instructions and does not generally translate user notices into Hindi. The sample’s translations are curated. It does not claim to understand every circular.
- Dates without a year, relative weekdays, ambiguous numeric dates, invalid dates, and instructions with multiple dates need manual review. Exact event times are not converted into timed calendar events.
- OCR may confuse amounts, names, and dates. Review the extracted text before analysis. English recognition requires an initial download of Tesseract’s recognition model and worker assets; there is no guarantee of offline OCR availability. Fonts also load from Google Fonts, with local font fallbacks.
- Revision matching uses action kind and token overlap. Review additions and removals, especially when wording changes substantially. Only the immediately previous source is retained.
- Calendar files do not synchronize with calendar services. Re-import behavior varies by app, and removed reminders must be deleted manually. Stable event IDs and increasing sequence numbers are included, but duplicates are possible in some importers.
- There are no browser notifications, email reminders, accounts, cloud sync, automatic WhatsApp imports, or automatic calendar updates.
- Read-aloud depends on browser and installed language voices. A Hindi voice may need to be installed on the device.
- Data is unencrypted browser storage on this device. It is not a school records system. Clearing browser storage removes saved notices. Use fictional or redacted notices on shared devices and during demos.
- The optional AI endpoint has basic process-local request throttling, input size limits, and same-origin checks. Add authentication, durable rate limiting, and an appropriate privacy policy before exposing a paid AI key to the public.

## Project structure

```text
src/app/                 Next.js App Router page and optional API endpoints
src/components/          Workspace, importer, source viewer, calendar, dialogs
src/lib/engine.ts        Local extraction, evidence spans, date parsing, revisions
src/lib/ai.ts            Optional structured AI extraction with source validation
src/lib/import.ts        Browser PDF parsing and English OCR
src/lib/calendar.ts      Confirmed-date calendar export
src/lib/types.ts         Shared types and persisted-data validation
src/lib/engine.test.ts   Regression tests for important data behavior
```

## Tools, resources, and AI disclosure

- [Next.js](https://nextjs.org/) and [React](https://react.dev/) for the app.
- [PDF.js](https://github.com/mozilla/pdf.js) for browser PDF extraction.
- [Tesseract.js](https://github.com/naptha/tesseract.js) for English OCR.
- [Lucide](https://lucide.dev/) for interface icons.
- [Zod](https://zod.dev/) for runtime validation and the optional model output schema.
- [Vitest](https://vitest.dev/) for regression tests.
- DM Sans and DM Serif Display, served through [Google Fonts](https://fonts.google.com/).
- Optional [OpenAI Responses API](https://developers.openai.com/api/docs/guides/structured-outputs) for semantic extraction and Hindi translation.
- OpenAI Codex assisted with ideation, implementation, design, documentation, and testing. The participant should review the code, understand the extraction and revision behavior, and describe their own contributions accurately in the hackathon submission.

The bridge mark and interface illustration are original SVG/CSS graphics. No private school documents or third-party school identities are included in the demo.
