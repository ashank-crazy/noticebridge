import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { GET } from "../config/route";
import { analyzeWithAI } from "@/lib/ai";
import { analyzeLocal } from "@/lib/engine";
import { sampleDocument } from "@/lib/sample";

vi.mock("@/lib/ai", () => ({ analyzeWithAI: vi.fn() }));
let requestId = 0;
function request(body: unknown, options: { origin?: string; ip?: string } = {}) {
  return new Request("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin ?? "http://localhost:3000",
      "X-Forwarded-For": options.ip ?? `test-${requestId++}`,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.mocked(analyzeWithAI).mockResolvedValue({ ...analyzeLocal(sampleDocument()), mode: "ai" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("AI import endpoint", () => {
  it("requires per-import consent before invoking the provider", async () => {
    const result = await POST(request({ document: sampleDocument(), consent: false }));
    expect(result.status).toBe(400);
    expect(analyzeWithAI).not.toHaveBeenCalled();
  });
  it("accepts a valid, consented notice", async () => {
    const result = await POST(request({ document: sampleDocument(), consent: true }));
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect((await result.json()).analysis.mode).toBe("ai");
  });
  it("rejects requests originating from another site", async () => {
    const result = await POST(
      request(
        { document: sampleDocument(), consent: true },
        { origin: "https://another-site.example" },
      ),
    );
    expect(result.status).toBe(403);
    expect(analyzeWithAI).not.toHaveBeenCalled();
  });
  it("bounds the request body before parsing it", async () => {
    const result = await POST(
      request({ document: { ...sampleDocument(), text: "x".repeat(230000) }, consent: true }),
    );
    expect(result.status).toBe(413);
    expect(analyzeWithAI).not.toHaveBeenCalled();
  });
  it("throttles repeated AI requests", async () => {
    const ip = "rate-limit-test";
    for (let i = 0; i < 12; i++)
      expect(
        (await POST(request({ document: sampleDocument(), consent: true }, { ip }))).status,
      ).toBe(200);
    expect(
      (await POST(request({ document: sampleDocument(), consent: true }, { ip }))).status,
    ).toBe(429);
  });
  it("does not expose a provider key in configuration", async () => {
    expect(await GET().json()).toEqual({ aiAvailable: true });
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await GET().json()).toEqual({ aiAvailable: false });
    expect((await POST(request({ document: sampleDocument(), consent: true }))).status).toBe(503);
  });
});
