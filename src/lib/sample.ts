import type { SourceDocument } from "./types";

export const SAMPLE_TEXT = `GREENWOOD PUBLIC SCHOOL
Learning beyond the classroom

SCIENCE MUSEUM VISIT
Circular No. 042 • Issued: 21 October 2026
For students of Classes 6–8 and their parents

Dear parents,

Our students will visit the National Science Museum on 30 October 2026.

Please submit the signed consent form to your class teacher by 24 October 2026.

Please pay the trip fee of ₹350 through the school office by 26 October 2026.

Students must bring a packed lunch and a water bottle on 30 October 2026.

The bus leaves school at 8:30 am and returns at 3:00 pm. School uniform is required. Participation is optional.

For questions, contact your class teacher.

Warm regards,
The Greenwood School Team`;

export const REVISION_TEXT = SAMPLE_TEXT.replace(
  "Circular No. 042 • Issued: 21 October 2026",
  "Circular No. 042 (Revised) • Issued: 22 October 2026",
)
  .replace("SCIENCE MUSEUM VISIT", "SCIENCE MUSEUM VISIT — UPDATED")
  .replace("by 24 October 2026", "by 27 October 2026")
  .replace(
    "a packed lunch and a water bottle",
    "a packed lunch, a water bottle, and a school ID card",
  )
  .replace(
    "Dear parents,",
    "Dear parents,\n\nThis revised circular replaces the notice issued on 21 October 2026. The consent deadline has been extended and the packing list updated.",
  );

export function sampleDocument(revised = false): SourceDocument {
  return {
    id: revised ? "sample-museum-v2" : "sample-museum-v1",
    name: revised ? "Museum visit · revised circular" : "Museum visit · school circular",
    text: revised ? REVISION_TEXT : SAMPLE_TEXT,
    kind: "sample",
    publishedDate: revised ? "2026-10-22" : "2026-10-21",
    createdAt: "2026-10-21T12:00:00.000Z",
  };
}
