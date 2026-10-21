import { describe, expect, it } from "vitest";
import { workspaceSchema } from "./types";
import { analyzeLocal } from "./engine";
import { sampleDocument } from "./sample";

describe("saved board compatibility", () => {
  it("restores existing notices and their state when adding board personalization", () => {
    const notice = analyzeLocal(sampleDocument());
    notice.actions[0].completed = true;
    notice.actions[1].reviewed = true;
    const legacy = JSON.stringify({
      version: 1,
      notices: [notice],
      activeId: notice.id,
      language: "hi",
    });
    const restored = workspaceSchema.parse(JSON.parse(legacy));
    expect(restored.notices).toEqual([notice]);
    expect(restored.language).toBe("hi");
    expect(restored.profile).toEqual({ name: "", school: "", className: "" });
  });
});
