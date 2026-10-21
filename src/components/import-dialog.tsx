"use client";

import { useRef, useState } from "react";
import { ArrowRight, FileText, Image, LoaderCircle, LockKeyhole, Sparkles, UploadCloud } from "lucide-react";
import Modal from "./modal";
import { analyzeLocal } from "@/lib/engine";
import { readNoticeFile } from "@/lib/import";
import { analysisSchema, type Language, type NoticeAnalysis, type SourceDocument } from "@/lib/types";

export default function ImportDialog({ language, aiAvailable, revision, onClose, onImport, onSample }: {
  language: Language; aiAvailable: boolean; revision?: NoticeAnalysis; onClose: () => void;
  onImport: (analysis: NoticeAnalysis) => void; onSample: () => void;
}) {
  const hi = language === "hi";
  const [tab, setTab] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const [name, setName] = useState(revision ? `${revision.title} — updated` : "");
  const [kind, setKind] = useState<SourceDocument["kind"]>("text");
  const [publishedDate, setPublishedDate] = useState("");
  const [useAI, setUseAI] = useState(false);
  const [replaces, setReplaces] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function read(file?: File) {
    if (!file || busy) return;
    setError(""); setBusy(true); setProgress("Opening your notice…");
    try {
      const result = await readNoticeFile(file, setProgress);
      if (result.text.trim().length < 10) throw new Error("We couldn’t find enough text. Try a clearer image, or paste the notice text.");
      if (result.text.length > 50000) throw new Error("Please keep the notice under 50,000 characters.");
      setText(result.text); setKind(result.kind);
      if (!revision) setName(file.name.replace(/\.[^.]+$/, "").slice(0, 200));
    } catch (error) { setError(error instanceof Error ? error.message : "This file could not be read. Try pasting the text."); }
    finally { setBusy(false); setProgress(""); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (revision && !replaces) { setError("Please confirm that this circular replaces the selected notice."); return; }
    setBusy(true); setProgress(useAI ? "Finding your next steps and translating into Hindi…" : "Finding your next steps…");
    const document: SourceDocument = { id: crypto.randomUUID(), name: name.trim(), text: text.trim(), kind, publishedDate: publishedDate || null, createdAt: new Date().toISOString() };
    try {
      let analysis: NoticeAnalysis;
      if (useAI) {
        const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(55000), body: JSON.stringify({ document, consent: true }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "AI extraction could not finish. Try local extraction.");
        analysis = analysisSchema.parse(result.analysis);
      } else analysis = analyzeLocal(document);
      onImport(analysis);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not read this notice. Please try again."); }
    finally { setBusy(false); setProgress(""); }
  }

  return <Modal title={revision ? (hi ? "सूचना का नया संस्करण जोड़ें" : "A new version of this notice") : (hi ? "नई सूचना जोड़ें" : "Let’s make this notice simple")} onClose={onClose} wide busy={busy}>
    <p className="modal-intro">{revision ? "We’ll compare the instructions, show what changed, and keep your previous version for reference." : "A school circular, a screenshot, a note from class. Bring it here and find your next steps."}</p>
    <form onSubmit={submit}>
      <div className="segmented import-tabs" role="group" aria-label="Import method">
        <button type="button" aria-pressed={tab === "file"} className={tab === "file" ? "selected" : ""} onClick={() => setTab("file")}><UploadCloud size={16} />{hi ? "फ़ाइल अपलोड करें" : "Upload a file"}</button>
        <button type="button" aria-pressed={tab === "text"} className={tab === "text" ? "selected" : ""} onClick={() => { setTab("text"); if (!text) setKind("text"); }}><FileText size={16} />{hi ? "टेक्स्ट पेस्ट करें" : "Paste text"}</button>
      </div>
      {tab === "file" && <>
        <input type="file" className="sr-only" ref={fileInput} accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.bmp" onChange={(event) => read(event.target.files?.[0])} aria-label="Choose a notice file" />
        <button type="button" disabled={busy} className={`dropzone ${dragging ? "dragging" : ""}`} onClick={() => fileInput.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); read(event.dataTransfer.files[0]); }}>
          <span className="upload-icon"><UploadCloud size={28} strokeWidth={1.5} /></span>
          <strong>{hi ? "सूचना यहाँ छोड़ें या फ़ाइल चुनें" : "Drop your notice here, or browse files"}</strong>
          <span>PDF, JPG, PNG, WebP or TXT · up to 10 MB · 8 pages</span>
          <span className="dropzone-formats"><FileText size={14} /> Circulars <span>·</span><Image size={14} /> Screenshots <span>·</span> Photos</span>
        </button>
      </>}
      {(tab === "text" || text) && <label className="field"><span>{text && tab === "file" ? "Check the extracted text before continuing" : (hi ? "सूचना का टेक्स्ट" : "Notice text")}</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the complete notice here, including any dates and instructions…" rows={7} required maxLength={50000} disabled={busy} />
        <small>{text.length.toLocaleString()} / 50,000 characters{kind === "image" || kind === "pdf" ? " · Check names, amounts, and dates after text recognition." : ""}</small>
      </label>}
      <div className="form-grid">
        <label className="field"><span>{hi ? "सूचना का नाम" : "Give it a name"}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Science museum visit" required maxLength={200} disabled={busy} /></label>
        <label className="field"><span>{hi ? "जारी करने की तारीख़ (वैकल्पिक)" : "Issue date (optional)"}</span><input type="date" value={publishedDate} onChange={(event) => setPublishedDate(event.target.value)} disabled={busy} /></label>
      </div>
      {revision && <label className="consent-row"><input type="checkbox" checked={replaces} onChange={(event) => setReplaces(event.target.checked)} required disabled={busy} /><span>This circular replaces <strong>{revision.title}</strong>. I want to compare it as a revision.</span></label>}
      {aiAvailable ? <label className="ai-option"><input type="checkbox" checked={useAI} onChange={(event) => setUseAI(event.target.checked)} disabled={busy} /><div><strong><Sparkles size={15} /> Use AI extraction & Hindi translation</strong><p>Send this notice’s text to OpenAI for richer instructions and translation. Your API key stays on the server.</p></div></label>
        : <div className="local-explainer"><LockKeyhole size={16} /><p><strong>Local mode, ready to use.</strong> Basic English extraction runs in your browser. The sample includes Hindi translations; full translation for your own notices needs the optional AI connection.</p></div>}
      <p className="fine-print">Files are read in your browser. Image recognition supports English and downloads a recognition model on first use. Your notices are saved on this device.</p>
      {error && <div className="form-error" role="alert">{error}{useAI && <button type="button" className="text-button" onClick={() => { setUseAI(false); setError(""); }}>Switch to local extraction</button>}</div>}
      {busy && <div className="import-progress" role="status"><LoaderCircle size={17} className="spin" />{progress}</div>}
      <div className="modal-footer">
        {!revision && <button type="button" className="text-button" disabled={busy} onClick={onSample}>{hi ? "उदाहरण देखें" : "Just exploring? Try a sample"}</button>}
        <button className="button primary" type="submit" disabled={busy || text.trim().length < 10 || !name.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}{revision ? (hi ? "बदलाव देखें" : "Compare this revision") : (hi ? "अगले कदम खोजें" : "Find my next steps")}</button>
      </div>
    </form>
  </Modal>;
}
