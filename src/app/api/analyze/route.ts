import { z } from "zod";
import { analyzeWithAI } from "@/lib/ai";
import { documentSchema } from "@/lib/types";

export const runtime = "nodejs";
const input = z.object({ document: documentSchema, consent: z.literal(true) });
const buckets = new Map<string, { count: number; until: number }>();

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Please make requests from NoticeBridge." }, { status: 403, headers });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "AI extraction is not configured. Use local extraction or add an API key on the server." }, { status: 503, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Expected a JSON notice." }, { status: 415, headers });
  try {
    // Bound the body while streaming, before JSON decoding or model invocation.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "The notice is missing." }, { status: 400, headers });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 220000) { await reader.cancel(); return Response.json({ error: "This notice is too large." }, { status: 413, headers }); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    const parsed = input.safeParse(JSON.parse(body.toString("utf8")));
    if (!parsed.success) return Response.json({ error: "Please provide a valid notice and agree to AI processing." }, { status: 400, headers });
    const now = Date.now();
    if (buckets.size > 2000) for (const [id, bucket] of buckets) if (bucket.until < now) buckets.delete(id);
    const id = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const current = buckets.get(id);
    const bucket = current && current.until > now ? current : { count: 0, until: now + 15 * 60 * 1000 };
    if (bucket.count >= 12) return Response.json({ error: "The AI request limit has been reached. Try again in 15 minutes or use local extraction." }, { status: 429, headers });
    bucket.count++; buckets.set(id, bucket);
    const analysis = await analyzeWithAI(parsed.data.document);
    return Response.json({ analysis }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "The notice could not be read. Try again." }, { status: 400, headers });
    return Response.json({ error: error instanceof Error && !/Zod|JSON|schema/i.test(error.message) ? error.message : "AI extraction could not finish. Try local extraction." }, { status: 502, headers });
  }
}
