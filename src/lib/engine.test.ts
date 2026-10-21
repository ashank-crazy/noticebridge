import { describe, expect, it } from "vitest";
import { analyzeLocal, compareRevision, extractDate } from "./engine";
import { sampleDocument } from "./sample";
import { createCalendar, foldCalendarLine } from "./calendar";

describe("source-grounded extraction", () => {
  it("finds the three sample instructions with exact source spans", () => {
    const notice = analyzeLocal(sampleDocument());
    expect(notice.actions).toHaveLength(3);
    expect(notice.actions.map((a) => a.dueDate)).toEqual(["2026-10-24", "2026-10-26", "2026-10-30"]);
    for (const action of notice.actions) expect(notice.document.text.slice(action.evidence.start, action.evidence.end)).toBe(action.evidence.quote);
  });
  it("keeps negative instructions negative", () => {
    const notice = analyzeLocal({ ...sampleDocument(), text: "NOTICE\nStudents must not bring mobile phones on 30 October 2026." });
    expect(notice.actions[0].summary).toContain("must not bring");
    expect(notice.actions[0].kind).toBe("other");
  });
  it("keeps optional actions optional", () => {
    const notice = analyzeLocal({ ...sampleDocument(), text: "NOTICE\nYou may register for the optional workshop by 30 October 2026." });
    expect(notice.actions[0].obligation).toBe("optional");
  });
  it("does not lose decimal fees or dotted dates", () => {
    const notice = analyzeLocal({ ...sampleDocument(), text: "NOTICE\nPlease pay ₹350.50 by 24.10.2026." });
    expect(notice.actions[0].summary).toContain("₹350.50");
    expect(notice.actions[0].dueDate).toBe("2026-10-24");
  });
  it("keeps separate sentences in a paragraph as separate actions", () => {
    const notice = analyzeLocal({ ...sampleDocument(), text: "NOTICE\nSubmit the form by 24 October 2026. Bring lunch on 30 October 2026." });
    expect(notice.actions).toHaveLength(2);
    for (const a of notice.actions) expect(notice.document.text.slice(a.evidence.start, a.evidence.end)).toBe(a.evidence.quote);
  });
  it("returns an honest empty result for informational notices", () => {
    expect(analyzeLocal({ ...sampleDocument(), text: "School is closed for the holidays. Have a wonderful break." }).actions).toHaveLength(0);
  });
});

describe("date uncertainty", () => {
  it.each([
    ["by 24 October 2026", "2026-10-24"], ["on October 24, 2026", "2026-10-24"],
    ["by 2026-10-24", "2026-10-24"], ["by 24/10/2026", "2026-10-24"],
    ["by 10/24/2026", "2026-10-24"], ["by 12/12/2026", "2026-12-12"],
  ])("parses explicit dates: %s", (text, iso) => { expect(extractDate(text).dueDate).toBe(iso); });
  it.each(["by Friday", "by tomorrow", "by 24 October", "by 05/06/2026", "by 31 February 2026", "by 24 October 2026 or 26 October 2026"])("requires review for %s", (text) => {
    const result = extractDate(text); expect(result.dueDate).toBeNull(); expect(result.dateIssue).toBeTruthy();
  });
  it("does not manufacture a date when none is supplied", () => {
    expect(extractDate("Bring a water bottle")).toMatchObject({ dueDate: null, dueLabel: null, dateIssue: null });
  });
});

describe("revision comparison", () => {
  it("identifies the deadline and packing-list changes and retains the unchanged fee", () => {
    const before = analyzeLocal(sampleDocument());
    before.actions.forEach((a) => { a.reviewed = true; a.completed = true; });
    const revision = compareRevision(before, analyzeLocal(sampleDocument(true)));
    expect(revision.version).toBe(2);
    expect(revision.id).toBe(before.id);
    expect(revision.revision?.changedCount).toBe(2);
    expect(revision.actions.map((a) => a.change)).toEqual(["updated", "unchanged", "updated"]);
    expect(revision.actions[0].previous?.dueDate).toBe("2026-10-24");
    expect(revision.actions[0].dueDate).toBe("2026-10-27");
    expect(revision.actions[0].reviewed).toBe(false);
    expect(revision.actions[0].completed).toBe(false);
    expect(revision.actions[1].reviewed).toBe(true);
    expect(revision.actions[1].completed).toBe(true);
    expect(revision.actions[1].id).toBe(before.actions[1].id);
    expect(revision.revision?.previousDocument.text).toBe(before.document.text);
  });
  it("records removed instructions", () => {
    const before = analyzeLocal(sampleDocument());
    const doc = { ...sampleDocument(true), text: sampleDocument(true).text.replace(/Please pay[^\n]+/, "") };
    const revision = compareRevision(before, analyzeLocal(doc));
    expect(revision.revision?.removed).toHaveLength(1);
    expect(revision.revision?.removed[0].kind).toBe("pay");
  });
});

describe("calendar exports", () => {
  it("excludes unconfirmed, completed, and unresolved dates", () => {
    const notice = analyzeLocal(sampleDocument());
    expect(createCalendar([notice]).count).toBe(0);
    notice.actions[0].reviewed = true;
    notice.actions[1].reviewed = true; notice.actions[1].completed = true;
    notice.actions[2].reviewed = true; notice.actions[2].dateIssue = "Conflicting dates";
    const result = createCalendar([notice], new Date("2026-10-21T12:00:00Z"));
    expect(result.count).toBe(1);
    expect(result.content).toContain("DTSTART;VALUE=DATE:20261024\r\nDTEND;VALUE=DATE:20261025");
    expect(result.content).toContain("TRIGGER:-P1D");
  });
  it("escapes calendar control characters and prevents event injection", () => {
    const notice = analyzeLocal(sampleDocument());
    notice.actions[0].reviewed = true;
    notice.actions[0].summary = "Bring lunch, water; ID\r\nBEGIN:VEVENT";
    const result = createCalendar([notice]);
    expect(result.content.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(result.content).toContain("Bring lunch\\, water\\; ID\\nBEGIN:VEVENT");
  });
  it("folds Hindi text within the 75-byte ICS line limit", () => {
    const result = foldCalendarLine("DESCRIPTION:" + "कक्षा शिक्षक को सहमति पत्र दें ".repeat(20));
    for (const line of result.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(result.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "कक्षा शिक्षक को सहमति पत्र दें ".repeat(20));
  });
});
