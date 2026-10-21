"use client";

import { FileText, Headphones, Highlighter, VolumeX } from "lucide-react";
import type { ActionItem, Language, NoticeAnalysis } from "@/lib/types";

export default function SourcePanel({ notice, action, previous, onPrevious, onListen, speaking, language }: {
  notice: NoticeAnalysis; action?: ActionItem; previous: boolean; onPrevious: (value: boolean) => void;
  onListen: (text: string, hindi?: boolean) => void; speaking: boolean; language: Language;
}) {
  const hi = language === "hi";
  const document = previous && notice.revision ? notice.revision.previousDocument : notice.document;
  let offset = 0;
  const lines = document.text.split("\n").map((text) => {
    const result = { text, start: offset }; offset += text.length + 1; return result;
  });
  const quote = !previous && action ? action.evidence : null;
  return <section className="source-panel" aria-label={hi ? "मूल सूचना का टेक्स्ट" : "Source notice text"}>
    <div className="source-heading"><div className="source-title"><FileText size={18} /><h2>{hi ? "मूल शब्द" : "The original wording"}</h2></div>
      <button className={`icon-button ${speaking ? "is-active" : ""}`} aria-label={speaking ? "Stop reading" : "Read original notice aloud"} title={speaking ? "Stop reading" : "Read original notice aloud"} onClick={() => onListen(document.text, false)}>{speaking ? <VolumeX size={19} /> : <Headphones size={19} />}</button>
    </div>
    <div className="source-file"><span className="file-mini">{document.kind === "image" ? "IMG" : document.kind === "pdf" ? "PDF" : "TXT"}</span><div><strong>{document.name}</strong><span>{document.kind === "sample" ? (hi ? "उदाहरण सूचना" : "Sample notice") : (hi ? "निकाला गया स्रोत टेक्स्ट" : "Extracted source text")} · {document.text.length.toLocaleString()} characters</span></div><span className="version-tag">v{previous ? notice.version - 1 : notice.version}</span></div>
    {notice.revision && <div className="source-version-tabs" role="group" aria-label="Notice version"><button onClick={() => onPrevious(false)} aria-pressed={!previous} className={!previous ? "selected" : ""}>Current version</button><button onClick={() => onPrevious(true)} aria-pressed={previous} className={previous ? "selected" : ""}>Previous version</button></div>}
    <div className="source-paper" tabIndex={0} aria-label="Read the source text. Highlighted text supports the selected action.">
      <div className="paper-school-mark" aria-hidden="true"><span /><FileText size={14} /><span /></div>
      {lines.map((line, index) => {
        const overlap = quote && quote.start < line.start + line.text.length && quote.end > line.start;
        const start = overlap ? Math.max(0, quote.start - line.start) : 0;
        const end = overlap ? Math.min(line.text.length, quote.end - line.start) : 0;
        return <div key={index} className={`paper-line ${!line.text.trim() ? "blank" : ""} ${index === 0 ? "school-name" : ""} ${index === 1 ? "school-tagline" : ""} ${line.text.length > 8 && line.text === line.text.toUpperCase() && /[A-Z]/.test(line.text) && index > 1 ? "paper-title" : ""}`}>
          {overlap ? <>{line.text.slice(0, start)}<mark>{line.text.slice(start, end)}</mark>{line.text.slice(end)}</> : line.text || "\u00a0"}
        </div>;
      })}
    </div>
    <div className="source-footnote"><Highlighter size={15} /><p>{hi ? "किसी अगले कदम पर “स्रोत देखें” दबाएँ और उसके मूल शब्द यहाँ देखें।" : "Tap “See source” on a step to find the exact words behind it."}</p></div>
  </section>;
}
