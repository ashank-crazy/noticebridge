import type { NoticeAnalysis } from "./types";

export function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

// RFC 5545 folds content at 75 octets, rather than 75 JavaScript characters.
export function foldCalendarLine(value: string): string {
  const encoder = new TextEncoder();
  let result = "",
    current = "",
    bytes = 0;
  for (const char of value) {
    const length = encoder.encode(char).length;
    if (bytes + length > 75) {
      result += current + "\r\n";
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += length;
  }
  return result + current;
}

export function createCalendar(
  notices: NoticeAnalysis[],
  now = new Date(),
): { content: string; count: number } {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NoticeBridge//School Notice Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  let count = 0;
  for (const notice of notices)
    for (const action of notice.actions) {
      if (!action.reviewed || !action.dueDate || action.dateIssue || action.completed) continue;
      count++;
      const date = new Date(`${action.dueDate}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      const next = date.toISOString().slice(0, 10).replaceAll("-", "");
      const uid = `${notice.id}.${action.id}`.replace(/[^a-zA-Z0-9.-]/g, "-");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}@noticebridge.local`,
        `SEQUENCE:${notice.version - 1}`,
        `DTSTAMP:${now
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}Z/, "Z")}`,
        `DTSTART;VALUE=DATE:${action.dueDate.replaceAll("-", "")}`,
        `DTEND;VALUE=DATE:${next}`,
        `SUMMARY:${escapeCalendarText(action.summary)}`,
        `DESCRIPTION:${escapeCalendarText(`${notice.title}\nOriginal instruction: ${action.evidence.quote}\nAll-day reminder. Refer to the original notice for exact times.\nRe-importing a revision depends on your calendar app; check for duplicates.`)}`,
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeCalendarText(action.summary)}`,
        "END:VALARM",
        "END:VEVENT",
      );
    }
  lines.push("END:VCALENDAR");
  return { content: lines.map(foldCalendarLine).join("\r\n") + "\r\n", count };
}
