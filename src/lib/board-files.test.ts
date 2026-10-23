import { describe, expect, it } from "vitest";
import { createBoardBackup, familyBrief, readBoardBackup } from "./board-files";
import { analyzeLocal, compareRevision } from "./engine";
import { sampleDocument } from "./sample";
import type { Workspace } from "./types";

function board(): Workspace {
  const notice = analyzeLocal(sampleDocument());
  notice.actions[0].completed = true;
  notice.actions[1].reviewed = true;
  return {
    version: 1,
    notices: [notice],
    activeId: notice.id,
    language: "hi",
    profile: { name: "Ashank", school: "Greenwood", className: "8B" },
  };
}

describe("portable boards", () => {
  it("round trips source text, progress, language, and personalization", () => {
    const workspace = board();
    expect(readBoardBackup(createBoardBackup(workspace))).toEqual(workspace);
  });
  it("rejects unrelated JSON and empty boards", () => {
    expect(() => readBoardBackup('{"name":"test"}')).toThrow("not a valid");
    expect(() => readBoardBackup(createBoardBackup({ ...board(), notices: [] }))).toThrow(
      "not a valid",
    );
  });
  it("rejects conflicting IDs and broken source links", () => {
    const workspace = board();
    workspace.notices.push(workspace.notices[0]);
    expect(() => readBoardBackup(createBoardBackup(workspace))).toThrow("conflicting circulars");
    const other = board();
    other.notices[0].actions[0].evidence.quote = "a fabricated instruction";
    expect(() => readBoardBackup(createBoardBackup(other))).toThrow("source quote");
  });
  it("restores revised notices without losing comparison history", () => {
    const workspace = board();
    workspace.notices[0] = compareRevision(
      workspace.notices[0],
      analyzeLocal(sampleDocument(true)),
    );
    expect(readBoardBackup(createBoardBackup(workspace))).toEqual(workspace);
  });
});

describe("family handoff", () => {
  it("preserves exact evidence and distinguishes confirmed from unchecked dates", () => {
    const notice = board().notices[0];
    const brief = familyBrief(notice, "en");
    expect(brief).toContain("24 October 2026 (not confirmed)");
    expect(brief).toContain("26 October 2026 (confirmed)");
    expect(brief).toContain("[✓]");
    for (const action of notice.actions) expect(brief).toContain(action.evidence.quote);
  });
  it("marks the current revision and uses available Hindi summaries", () => {
    const notice = compareRevision(board().notices[0], analyzeLocal(sampleDocument(true)));
    expect(familyBrief(notice, "en")).toContain("REVISED CIRCULAR");
    expect(familyBrief(notice, "en")).toContain("27 October 2026 (not confirmed)");
    expect(familyBrief(notice, "hi")).toContain(notice.actions[0].summaryHi!);
  });
});
