import type { ActionItem, NoticeAnalysis, SourceDocument } from "./types";

const MONTH_NAMES = "January February March April May June July August September October November December".split(" ");
const MONTHS = Object.fromEntries(MONTH_NAMES.flatMap((name, i) => [[name.toLowerCase(), i + 1], [name.slice(0, 3).toLowerCase(), i + 1]]));
const MONTH_PATTERN = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

export function stableId(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

export function validDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

export function extractDate(text: string): { dueDate: string | null; dueLabel: string | null; dateIssue: string | null; index: number } {
  const candidates: { raw: string; iso: string | null; issue: string | null; index: number }[] = [];
  const occupied: [number, number][] = [];
  const add = (match: RegExpMatchArray, year: number, month: number, day: number, issue: string | null = null) => {
    const index = match.index!;
    if (occupied.some(([start, end]) => index < end && index + match[0].length > start)) return;
    occupied.push([index, index + match[0].length]);
    const iso = issue ? null : validDate(year, month, day);
    candidates.push({ raw: match[0], iso, issue: issue ?? (iso ? null : "This calendar date is invalid. Check the original notice."), index });
  };
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(m, +m[1], +m[2], +m[3]);
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:[ ,]+(\\d{4}))?\\b`, "gi"))) {
    add(m, +m[3], MONTHS[m[2].toLowerCase()], +m[1], m[3] ? null : "The year is missing. Confirm the full date before saving a reminder.");
  }
  for (const m of text.matchAll(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[ ,]+(\\d{4}))?\\b`, "gi"))) {
    add(m, +m[3], MONTHS[m[1].toLowerCase()], +m[2], m[3] ? null : "The year is missing. Confirm the full date before saving a reminder.");
  }
  for (const m of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const a = +m[1], b = +m[2];
    const ambiguous = a <= 12 && b <= 12 && a !== b;
    add(m, +m[3], a > 12 ? b : a, a > 12 ? a : b,
      ambiguous ? "This numeric date could mean two different days. Check the original and choose a date." : null);
  }
  if (candidates.length) {
    candidates.sort((a, b) => a.index - b.index);
    const first = candidates[0];
    const uniqueDates = new Set(candidates.map((c) => c.iso ?? c.raw));
    if (uniqueDates.size > 1) return { dueDate: null, dueLabel: candidates.map((c) => c.raw).join(" / "), dateIssue: "More than one date appears in this instruction. Confirm which date the reminder is for.", index: first.index };
    return { dueDate: first.iso, dueLabel: first.raw, dateIssue: first.issue, index: first.index };
  }
  const relative = text.match(/\b(?:tomorrow|today|next\s+(?:week|month|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
  return {
    dueDate: null,
    dueLabel: relative?.[0] ?? null,
    dateIssue: relative ? "Only a relative day is given. Confirm the exact calendar date." : null,
    index: relative?.index ?? -1,
  };
}

const KINDS: [ActionItem["kind"], RegExp][] = [
  ["submit", /\b(?:submit|return|upload|hand in|fill (?:out|in)|complete|sign)\b/i],
  ["pay", /\b(?:pay|deposit|remit)\b/i],
  ["bring", /\b(?:bring|carry|pack|wear)\b/i],
  ["attend", /\b(?:attend|arrive|report to|reach|join|collect)\b/i],
  ["confirm", /\b(?:confirm|register|respond|rsvp|book)\b/i],
];

function sampleHindi(summary: string, kind: ActionItem["kind"]): string | null {
  if (/signed consent form to your class teacher/i.test(summary)) return "हस्ताक्षर किया हुआ सहमति पत्र कक्षा शिक्षक को दें";
  if (kind === "pay" && /trip fee.*school office/i.test(summary)) return `स्कूल कार्यालय में यात्रा शुल्क ${summary.match(/₹[\d,]+/)?.[0] ?? ""} जमा करें`;
  if (kind === "bring" && /a packed lunch and a water bottle/i.test(summary)) return "दोपहर का खाना और पानी की बोतल साथ लाएँ";
  if (kind === "bring" && /a packed lunch, a water bottle, and a school ID card/i.test(summary)) return "दोपहर का खाना, पानी की बोतल और स्कूल पहचान पत्र साथ लाएँ";
  return null;
}

export function analyzeLocal(document: SourceDocument): NoticeAnalysis {
  const actions: ActionItem[] = [];
  // Keep decimals and dotted numeric dates intact while splitting paragraphs.
  const segments = [...document.text.matchAll(/[^\n]+/g)].flatMap((line) =>
    [...line[0].matchAll(/.+?(?:[.!?](?=\s+[A-Z]|\s*$)|$)/g)].map((part) => ({ 0: part[0], index: line.index! + part.index! })),
  );
  for (const segment of segments) {
    const raw = segment[0];
    const quote = raw.trim().replace(/^[•\-*]\s*/, "");
    if (quote.length < 12 || quote.length > 1600) continue;
    const entry = KINDS.find(([, pattern]) => pattern.test(quote));
    if (!entry) continue;
    // Quoted prohibitions remain literal; never turn "do not bring" into "bring".
    const negative = /\b(?:do not|don't|must not|should not|need not|no need to|not required to)\b/i.test(quote);
    const kind = negative ? "other" : entry[0];
    const start = segment.index! + raw.indexOf(quote);
    const date = extractDate(quote);
    let summary = quote;
    if (date.index > 0) {
      const before = quote.slice(0, date.index);
      const connector = before.match(/\s+(?:by|before|on|no later than|not later than)\s*$/i);
      if (connector) summary = before.slice(0, connector.index);
    }
    if (!negative) {
      summary = summary.replace(/^(?:please\s+|students\s+(?:must|should|are requested to)\s+|parents\s+(?:must|should|are requested to)\s+)/i, "");
    }
    summary = summary.replace(/[.;,\s]+$/, "");
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);
    if (actions.some((a) => a.evidence.quote === quote)) continue;
    actions.push({
      id: stableId(`${document.id}:${start}:${quote}`), kind, summary,
      summaryHi: negative ? null : sampleHindi(summary, kind),
      evidence: { quote, start, end: start + quote.length },
      dueDate: date.dueDate, dueLabel: date.dueLabel, dateIssue: date.dateIssue,
      completed: false, reviewed: false,
      obligation: /\b(?:optional|may|if you wish|if applicable)\b/i.test(quote) ? "optional" : "required",
      change: null,
    });
    if (actions.length >= 60) break;
  }
  const lines = document.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const heading = lines.find((l, i) => i > 0 && l.length > 8 && l.length < 100 && l === l.toUpperCase() && /[A-Z]/.test(l) && !/^(?:CIRCULAR|NOTICE NO|DATE)/.test(l));
  const title = heading ? heading.toLowerCase().replace(/(^|\s)\p{L}/gu, (s) => s.toUpperCase()) : document.name.replace(/\.[a-z0-9]+$/i, "");
  const audience = lines.find((l) => /^for\s+(?:students|parents|class|families)/i.test(l)) ?? "For students & families";
  const intro = lines.find((l) => /\b(?:will visit|will be held|invited|scheduled|pleased to|happy to)\b/i.test(l));
  return {
    id: document.id, document, title, audience,
    summary: intro ?? (actions.length ? `${actions.length} next step${actions.length === 1 ? "" : "s"} found in this notice. Check the original wording before confirming dates.` : "No clear action instructions were found. Read the original notice for context."),
    summaryHi: document.kind === "sample" ? "30 अक्टूबर को विज्ञान संग्रहालय की यात्रा है। सहमति पत्र, यात्रा शुल्क और साथ लाने वाली चीज़ों की जानकारी यहाँ देखें।" : null,
    actions, mode: "local", version: 1,
  };
}

const STOP = new Set("a an the to your my our for by on of at in and or with through please must should students parents school class teacher 2026 2027".split(" "));
function tokens(summary: string) {
  return new Set(summary.toLowerCase().replace(/\d+/g, " ").match(/[\p{L}]+/gu)?.filter((w) => !STOP.has(w)) ?? []);
}
function similarity(a: ActionItem, b: ActionItem): number {
  if (a.kind !== b.kind) return 0;
  const left = tokens(a.summary), right = tokens(b.summary);
  const intersection = [...left].filter((w) => right.has(w)).length;
  return intersection / (new Set([...left, ...right]).size || 1);
}
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}₹]+/gu, " ").trim();

export function compareRevision(previous: NoticeAnalysis, incoming: NoticeAnalysis): NoticeAnalysis {
  const pairs = incoming.actions.flatMap((next, ni) => previous.actions.map((old, oi) => ({ ni, oi, score: similarity(old, next) })))
    .filter((pair) => pair.score >= 0.26).sort((a, b) => b.score - a.score);
  const matches = new Map<number, number>(), used = new Set<number>();
  for (const pair of pairs) {
    if (!matches.has(pair.ni) && !used.has(pair.oi)) { matches.set(pair.ni, pair.oi); used.add(pair.oi); }
  }
  const actions = incoming.actions.map((action, index): ActionItem => {
    const oldIndex = matches.get(index);
    if (oldIndex === undefined) return { ...action, change: "added" };
    const old = previous.actions[oldIndex];
    const changed = normalize(old.summary) !== normalize(action.summary) || old.dueDate !== action.dueDate || old.dueLabel !== action.dueLabel || old.dateIssue !== action.dateIssue || old.obligation !== action.obligation;
    return {
      ...action, id: old.id, change: changed ? "updated" : "unchanged",
      reviewed: changed ? false : old.reviewed,
      completed: changed ? false : old.completed,
      ...(changed ? { previous: { summary: old.summary, dueDate: old.dueDate, dueLabel: old.dueLabel } } : {}),
    };
  });
  const removed = previous.actions.filter((_, i) => !used.has(i));
  return {
    ...incoming, id: previous.id, version: previous.version + 1, actions,
    revision: { previousTitle: previous.title, previousDocument: previous.document, removed, changedCount: actions.filter((a) => a.change !== "unchanged").length + removed.length },
  };
}

export function formatDate(iso: string | null, language = "en", options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return language === "hi" ? "तारीख़ नहीं दी गई" : "No date given";
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-GB", options ?? { day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));
}
