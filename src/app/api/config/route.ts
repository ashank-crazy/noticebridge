export function GET() {
  return Response.json({ aiAvailable: Boolean(process.env.OPENAI_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
}
