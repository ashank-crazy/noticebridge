import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWithAI } from "./ai";
import { sampleDocument } from "./sample";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const fixture = {
  title: "Museum visit",
  audience: "Classes 6–8",
  summary: "A school trip.",
  summaryHi: "स्कूल की यात्रा।",
  actions: [
    {
      kind: "submit",
      summary: "Submit the consent form",
      summaryHi: "सहमति पत्र दें",
      obligation: "required",
      quote: "Please submit the signed consent form to your class teacher by 24 October 2026.",
    },
  ],
};

function provider(output: unknown = fixture, status = "completed") {
  vi.stubEnv("OPENAI_API_KEY", "test-key-never-a-real-secret");
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        status,
        output: [
          { type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("optional AI source validation", () => {
  it("requests strict structured output without storing the model response", async () => {
    const fetch = provider();
    const result = await analyzeWithAI(sampleDocument());
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.store).toBe(false);
    expect(payload.text.format.strict).toBe(true);
    expect(payload.text.format.type).toBe("json_schema");
    expect(payload.input[0].content[0].text).not.toContain("test-key-never-a-real-secret");
    expect(result.mode).toBe("ai");
    expect(result.actions[0].dueDate).toBe("2026-10-24");
    expect(
      result.document.text.slice(result.actions[0].evidence.start, result.actions[0].evidence.end),
    ).toBe(fixture.actions[0].quote);
  });
  it("drops unsupported quotes and tells the user", async () => {
    provider({
      ...fixture,
      actions: [
        ...fixture.actions,
        { ...fixture.actions[0], quote: "The fee is one million rupees." },
      ],
    });
    const result = await analyzeWithAI(sampleDocument());
    expect(result.actions).toHaveLength(1);
    expect(result.warning).toContain("could not be validated");
  });
  it("requires manual review when quoted dates lack a year", async () => {
    const document = {
      ...sampleDocument(),
      text: "Please submit the signed consent form by 24 October.",
    };
    provider({ ...fixture, actions: [{ ...fixture.actions[0], quote: document.text }] });
    const result = await analyzeWithAI(document);
    expect(result.actions[0].dueDate).toBeNull();
    expect(result.actions[0].dateIssue).toContain("year is missing");
  });
  it("does not return incomplete provider output as a successful result", async () => {
    provider(fixture, "incomplete");
    await expect(analyzeWithAI(sampleDocument())).rejects.toThrow("incomplete");
  });
  it("handles provider errors without leaking the raw response body", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key-never-a-real-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ private: "do-not-forward-provider-body" }, { status: 401 }),
        ),
    );
    await expect(analyzeWithAI(sampleDocument())).rejects.toThrow(
      "Check the server API configuration",
    );
  });
});
