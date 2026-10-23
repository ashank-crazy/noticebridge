import { z } from "zod";
import { formatDate } from "./engine";
import { workspaceSchema, type Language, type NoticeAnalysis, type Workspace } from "./types";

export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
const backupSchema = z.object({
  format: z.literal("noticebridge-board"),
  savedAt: z.string(),
  workspace: workspaceSchema,
});

export function createBoardBackup(workspace: Workspace) {
  return JSON.stringify(
    {
      format: "noticebridge-board",
      savedAt: new Date().toISOString(),
      workspace,
    },
    null,
    2,
  );
}

export function readBoardBackup(text: string): Workspace {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("This file is too large. Choose a NoticeBridge board backup under 8 MB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This file could not be read. Choose a NoticeBridge .json backup.");
  }
  const result = backupSchema.safeParse(value);
  if (!result.success || !result.data.workspace.notices.length)
    throw new Error("This is not a valid NoticeBridge board backup.");
  const board = result.data.workspace;
  const ids = new Set(board.notices.map((notice) => notice.id));
  if (ids.size !== board.notices.length || !ids.has(board.activeId))
    throw new Error("This backup has conflicting circulars. Your current board has not changed.");
  for (const notice of board.notices) {
    if (new Set(notice.actions.map((action) => action.id)).size !== notice.actions.length)
      throw new Error("This backup has conflicting steps. Your current board has not changed.");
    for (const action of notice.actions) {
      const { start, end, quote } = action.evidence;
      if (!quote || end <= start || notice.document.text.slice(start, end) !== quote)
        throw new Error(
          "A source quote in this backup could not be verified. Your current board has not changed.",
        );
    }
  }
  return board;
}

export function familyBrief(notice: NoticeAnalysis, language: Language): string {
  const hi = language === "hi";
  const lines = [notice.title, `${notice.audience} · v${notice.version}`, ""];
  if (notice.revision) {
    lines.push(
      hi
        ? "संशोधित सूचना — पुराने निर्देशों की जगह इसे देखें।"
        : "REVISED CIRCULAR — use this version in place of the previous one.",
    );
    lines.push("");
  }
  for (const action of notice.actions) {
    const summary = hi && action.summaryHi ? action.summaryHi : action.summary;
    lines.push(`${action.completed ? "[✓]" : "[ ]"} ${summary}`);
    if (action.dueDate)
      lines.push(
        `  ${hi ? "तारीख़" : "Date"}: ${formatDate(action.dueDate, language, { day: "numeric", month: "long", year: "numeric" })} (${action.reviewed ? (hi ? "पुष्टि की गई" : "confirmed") : hi ? "जाँच बाकी" : "not confirmed"})`,
      );
    else if (action.dueLabel || action.dateIssue)
      lines.push(
        `  ${hi ? "तारीख़ जाँचें" : "Check date"}: ${action.dueLabel || action.dateIssue}`,
      );
    if (action.previous) {
      const oldDate = action.previous.dueDate
        ? formatDate(action.previous.dueDate, language, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : action.previous.dueLabel;
      lines.push(
        `  ${hi ? "पहले" : "Previously"}: ${action.previous.summary}${oldDate ? ` · ${oldDate}` : ""}`,
      );
    }
    if (action.obligation === "optional") lines.push(hi ? "  वैकल्पिक" : "  Optional");
    lines.push(`  ${hi ? "मूल शब्द" : "Source"}: “${action.evidence.quote}”`, "");
  }
  if (!notice.actions.length)
    lines.push(
      hi
        ? "कोई स्पष्ट निर्देश नहीं मिले। मूल सूचना पढ़ें।"
        : "No clear instructions found. Read the original circular.",
      "",
    );
  if (notice.revision?.removed.length) {
    lines.push(hi ? "इस संस्करण में हटाए गए" : "REMOVED IN THIS VERSION");
    for (const action of notice.revision.removed) lines.push(`− ${action.summary}`);
    lines.push(
      hi ? "पुराने कैलेंडर रिमाइंडर भी हटाएँ।" : "Remove any old calendar reminders too.",
      "",
    );
  }
  lines.push(
    hi
      ? "पूरा संदर्भ जानने के लिए मूल सूचना पढ़ें।"
      : "Read the original circular for the full context.",
    `NoticeBridge · ${notice.document.name}`,
  );
  return lines.join("\n");
}

export function downloadText(content: string, name: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
