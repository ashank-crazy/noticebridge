"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays, Check,
  CheckCheck, ChevronDown, ChevronRight, CircleHelp, ClipboardList, FileCheck2,
  FileText, GitCompareArrows, Heart, Headphones, Languages, Leaf, Menu, Plus,
  ShieldCheck, Sparkles, Users, VolumeX, Wallet, X, Backpack, MapPin, AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ImportDialog from "./import-dialog";
import SourcePanel from "./source-panel";
import CalendarView from "./calendar-view";
import Modal from "./modal";
import { analyzeLocal, compareRevision, formatDate } from "@/lib/engine";
import { createCalendar } from "@/lib/calendar";
import { sampleDocument } from "@/lib/sample";
import { isoDate, workspaceSchema, type ActionItem, type NoticeAnalysis, type Workspace } from "@/lib/types";

const STORAGE_KEY = "noticebridge.workspace.v1";
const ICONS: Record<ActionItem["kind"], LucideIcon> = { submit: FileCheck2, pay: Wallet, bring: Backpack, attend: MapPin, confirm: CheckCheck, other: ClipboardList };
const initialNotice = analyzeLocal(sampleDocument());
const initial: Workspace = { version: 1, notices: [initialNotice], activeId: initialNotice.id, language: "en" };

function BrandMark() {
  return <svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><rect width="44" height="44" rx="13" fill="currentColor" /><path d="M10 29V20a7 7 0 0 1 14 0v9M21 29V20a7 7 0 0 1 14 0v9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /><path d="M8 30h29" stroke="#c5dcaa" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function DateReview({ action, onConfirm, onClose }: { action: ActionItem; onConfirm: (date: string) => void; onClose: () => void }) {
  const [date, setDate] = useState(action.dueDate ?? "");
  return <form className="date-review" onSubmit={(event) => { event.preventDefault(); if (isoDate.safeParse(date).success) onConfirm(date); }}>
    <label htmlFor={`date-${action.id}`}><strong>Check the date against the source</strong><span>{action.dateIssue ?? "Confirm the calendar date below. Reminders are all-day; check the notice for exact times."}</span></label>
    <div><input id={`date-${action.id}`} type="date" required value={date} onChange={(event) => setDate(event.target.value)} aria-label="Confirm reminder date" /><button type="submit" className="button primary small" disabled={!isoDate.safeParse(date).success}><Check size={14} /> Confirm</button><button type="button" className="icon-button" onClick={onClose} aria-label="Cancel date review"><X size={16} /></button></div>
  </form>;
}

export default function NoticeBridge() {
  const [workspace, setWorkspace] = useState<Workspace>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<"notices" | "calendar">("notices");
  const [importMode, setImportMode] = useState<"new" | "revision" | null>(null);
  const [help, setHelp] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [filter, setFilter] = useState<"todo" | "done">("todo");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(initialNotice.actions[0]?.id ?? null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [sourcePrevious, setSourcePrevious] = useState(false);
  const [toast, setToast] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);
  const hi = workspace.language === "hi";
  const notice = workspace.notices.find((n) => n.id === workspace.activeId) ?? workspace.notices[0];
  const pending = notice?.actions.filter((a) => !a.completed) ?? [];
  const completed = notice?.actions.filter((a) => a.completed) ?? [];
  const shown = filter === "todo" ? pending : completed;
  const allActions = workspace.notices.flatMap((n) => n.actions);
  const datesToReview = allActions.filter((a) => !a.completed && !a.reviewed && (a.dueLabel || a.dateIssue)).length;
  const selectedAction = notice?.actions.find((a) => a.id === selectedActionId);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const result = workspaceSchema.safeParse(JSON.parse(raw));
        if (result.success && result.data.notices.length) { setWorkspace(result.data); setSelectedActionId(null); }
        else setToast("Saved notices could not be restored. The sample is available while you start again.");
      }
    } catch { setToast("This browser could not restore saved notices. Changes will stay in this session."); }
    setHydrated(true);
    fetch("/api/config").then((r) => r.json()).then((r) => setAiAvailable(r.aiAvailable === true)).catch(() => {});
    return () => window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); }
    catch { setToast("Your browser storage is full or unavailable. Keep this tab open to retain this session’s notices."); }
    document.documentElement.lang = workspace.language;
  }, [workspace, hydrated]);

  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(""), 7000); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, [workspace.activeId, sourcePrevious]);

  function activate(id: string) {
    setWorkspace((w) => ({ ...w, activeId: id })); setView("notices"); setFilter("todo");
    setSelectedActionId(null); setEditingDate(null); setSourcePrevious(false); setSidebarOpen(false);
  }

  function updateAction(id: string, update: Partial<ActionItem>) {
    setWorkspace((w) => ({ ...w, notices: w.notices.map((n) => n.id === notice.id ? { ...n, actions: n.actions.map((a) => a.id === id ? { ...a, ...update } : a) } : n) }));
  }

  function showSource(action: ActionItem) {
    setSelectedActionId(action.id); setSourcePrevious(false);
    if (window.innerWidth < 1050) sourceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function loadSample() {
    const sample = analyzeLocal(sampleDocument());
    setWorkspace((w) => ({ ...w, activeId: sample.id, notices: w.notices.some((n) => n.id === sample.id) ? w.notices : [...w.notices, sample] }));
    setImportMode(null); setView("notices"); setFilter("todo"); setSourcePrevious(false); setSelectedActionId(sample.actions[0]?.id ?? null);
  }

  function imported(incoming: NoticeAnalysis) {
    if (importMode === "revision") {
      const compared = compareRevision(notice, incoming);
      setWorkspace((w) => ({ ...w, notices: w.notices.map((n) => n.id === notice.id ? compared : n) }));
      setToast(`${compared.revision!.changedCount} change${compared.revision!.changedCount === 1 ? "" : "s"} found. Review the updated steps below.`);
    } else {
      if (workspace.notices.length >= 20) { setToast("This workspace holds 20 notices. Use a revision to update an existing notice."); return; }
      setWorkspace((w) => ({ ...w, notices: [...w.notices, incoming], activeId: incoming.id }));
      setToast(incoming.actions.length ? `${incoming.actions.length} next steps found. You’re ready to review them.` : "Notice added. No clear action instructions were found; read the source text.");
    }
    setImportMode(null); setView("notices"); setFilter("todo"); setSourcePrevious(false); setEditingDate(null); setSelectedActionId(incoming.actions[0]?.id ?? null);
  }

  function sampleRevision() {
    const compared = compareRevision(notice, analyzeLocal(sampleDocument(true)));
    setWorkspace((w) => ({ ...w, notices: w.notices.map((n) => n.id === notice.id ? compared : n) }));
    setFilter("todo"); setSourcePrevious(false); setEditingDate(null); setSelectedActionId(compared.actions[0]?.id ?? null);
    setToast("Two changes caught: the consent deadline and the packing list. Have a look below.");
  }

  function exportCalendar() {
    const { content, count } = createCalendar(workspace.notices);
    if (!count) { setToast("Review and confirm a step’s date first. Only unfinished steps with confirmed dates are exported."); return; }
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "noticebridge-reminders.ics";
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast(`${count} all-day reminder${count === 1 ? "" : "s"} downloaded. Open the file in your calendar app to add them.`);
  }

  function listen(text: string, hindi = hi) {
    if (!("speechSynthesis" in window)) { setToast("Read-aloud isn’t available in this browser. You can still read every instruction here."); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith(hindi ? "hi" : "en"));
    if (hindi && voices.length && !voice) { setToast("A Hindi voice isn’t installed on this device. The Hindi text is still available to read."); return; }
    const speech = new SpeechSynthesisUtterance(text); speech.lang = hindi ? "hi-IN" : "en-IN"; speech.rate = 0.9;
    if (voice) speech.voice = voice;
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => { setSpeaking(false); setToast("Read-aloud could not start. Check the voices installed on your device."); };
    window.speechSynthesis.speak(speech); setSpeaking(true);
  }

  function readSteps() {
    const hasHindi = notice.actions.every((a) => a.summaryHi);
    if (hi && !hasHindi) { setToast("Some steps are only available in the original language. Reading them in English."); }
    const useHindi = hi && hasHindi;
    listen(notice.actions.map((a) => `${useHindi ? a.summaryHi : a.summary}. ${a.dueDate ? formatDate(a.dueDate, useHindi ? "hi" : "en", { day: "numeric", month: "long", year: "numeric" }) : a.dueLabel ?? ""}.`).join("\n"), useHindi);
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to your notices</a>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <button className="brand" onClick={() => { setView("notices"); setSidebarOpen(false); }} aria-label="NoticeBridge home"><BrandMark /><span>notice<span>bridge</span><small>A LITTLE CLARITY, EVERY DAY</small></span></button>
      <button className="button primary new-notice" onClick={() => { setImportMode("new"); setSidebarOpen(false); }}><Plus size={18} />{hi ? "नई सूचना" : "New notice"}<span className="plus-key">+</span></button>
      <p className="nav-label">{hi ? "आपका कार्यक्षेत्र" : "YOUR WORKSPACE"}</p>
      <nav aria-label="Main navigation"><button className={`nav-item ${view === "notices" ? "active" : ""}`} onClick={() => { setView("notices"); setSidebarOpen(false); }}><ClipboardList size={19} /><span>{hi ? "मेरी सूचनाएँ" : "My notices"}</span><span className="nav-count">{workspace.notices.length}</span></button>
        <button className={`nav-item ${view === "calendar" ? "active" : ""}`} onClick={() => { setView("calendar"); setSidebarOpen(false); }}><CalendarDays size={19} /><span>{hi ? "अगले कदमों का कैलेंडर" : "Action calendar"}</span></button>
        <button className="nav-item" onClick={() => { setHelp(true); setSidebarOpen(false); }}><CircleHelp size={19} /><span>{hi ? "यह कैसे काम करता है" : "How it works"}</span><ArrowUpRight size={14} /></button></nav>
      <div className="notice-list-heading"><p className="nav-label">{hi ? "सहेजी गई सूचनाएँ" : "YOUR NOTICES"}</p><button className="icon-button" aria-label="Add a notice" onClick={() => setImportMode("new")}><Plus size={15} /></button></div>
      <div className="sidebar-notices">{workspace.notices.map((item) => <button className={`sidebar-notice ${item.id === notice.id && view === "notices" ? "selected" : ""}`} key={item.id} onClick={() => activate(item.id)}><span className="notice-dot" /><span>{item.title}</span>{item.document.kind === "sample" && <small>DEMO</small>}</button>)}</div>
      <div className="sidebar-bottom"><div className="reassurance-card"><span className="reassurance-icon"><Leaf size={22} strokeWidth={1.6} /></span><h3>A little less on your mind.</h3><p>The important things, all in one place. You’ve got this.</p><button onClick={loadSample}>Explore the sample <ArrowRight size={14} /></button></div><div className="local-status"><span /><span>{hi ? "इस डिवाइस पर सहेजा गया" : "Saved on this device"}</span><ShieldCheck size={14} /></div></div>
    </aside>

    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><span>{hi ? "कार्यक्षेत्र" : "Workspace"}</span><ChevronRight size={14} /><strong>{view === "notices" ? (hi ? "मेरी सूचनाएँ" : "My notices") : (hi ? "कैलेंडर" : "Action calendar")}</strong></div>
      <div className="topbar-right"><div className="language-toggle" role="group" aria-label="Interface language"><Languages size={16} /><button aria-pressed={!hi} className={!hi ? "selected" : ""} onClick={() => setWorkspace((w) => ({ ...w, language: "en" }))}>English</button><span /><button aria-pressed={hi} className={hi ? "selected" : ""} onClick={() => setWorkspace((w) => ({ ...w, language: "hi" }))}>हिंदी</button></div><span className="topbar-divider" /><div className="family-profile"><span className="avatar"><Users size={18} /></span><span>{hi ? "आपका परिवार" : "Your family"}<small>{hi ? "हर कदम पर साथ" : "One step at a time"}</small></span></div></div>
    </header>

    <main id="main-content" className="main-content">
      <section className="welcome"><div><div className="eyebrow"><span />{hi ? "हर परिवार के लिए थोड़ी स्पष्टता" : "A LITTLE CLARITY FOR EVERY FAMILY"}</div><h1>{view === "calendar" ? (hi ? "ज़रूरी तारीख़ें,\nएक ही जगह।" : "The important dates.\nA little more together.") : (hi ? "स्कूल की सूचनाएँ,\nअब आसान।" : <>School updates,<br /><em>made simple.</em></>)}</h1><p>{view === "calendar" ? (hi ? "अगले कदम देखें और याद दिलाने के लिए तारीख़ों की पुष्टि करें।" : "See what’s coming up. Review a date, then make a little room for it.") : (hi ? "फ़ॉर्म, तारीख़ें और साथ लाने वाली चीज़ें। हर सूचना में अपने परिवार के अगले कदम खोजें।" : <>The forms, the dates, the things to pack.<br />Find your family’s next steps in every school notice.</>)}</p></div>
        <div className="welcome-illustration" aria-hidden="true"><div className="illustration-orbit" /><span className="ill-star star-one">✳</span><span className="ill-star star-two">✳</span><div className="ill-paper"><div className="ill-paper-top"><FileText size={18} /><span>THE SCHOOL CIRCULAR</span></div><div className="ill-lines"><i /><i /><i /><i /></div><div className="ill-highlight" /><span className="ill-paper-stamp"><BookOpen size={20} /></span></div><svg className="ill-path" viewBox="0 0 100 80"><path d="M5 45C60 80 25 0 85 30" stroke="#a4b29c" strokeWidth="2" strokeDasharray="4 5" fill="none" /><path d="m76 24 11 6-8 8" stroke="#a4b29c" strokeWidth="2" fill="none" /></svg><div className="ill-action"><span><Check size={17} /></span><div>A clear next step<small>A little peace of mind.</small></div><Heart size={15} /></div><span className="ill-leaf"><Leaf size={25} strokeWidth={1.3} /></span></div>
      </section>

      <section className="stats-row" aria-label="Workspace summary"><div className="stat"><span className="stat-icon sage"><ClipboardList size={20} /></span><div><strong>{allActions.filter((a) => !a.completed).length}<span>{hi ? "अगले कदम" : "next steps"}</span></strong><p>{hi ? "एक-एक करके करें" : "One thing at a time. You’re doing great."}</p></div></div><div className="stat"><span className="stat-icon butter"><CalendarDays size={20} /></span><div><strong>{datesToReview}<span>{hi ? "तारीख़ें जाँचनी हैं" : "dates to review"}</span></strong><p>{hi ? "पुष्टि करें, फिर कैलेंडर में जोड़ें" : "A quick check, then into your calendar."}</p></div></div><div className="stat"><span className="stat-icon peach"><FileText size={20} /></span><div><strong>{workspace.notices.length}<span>{hi ? "सूचनाएँ एक जगह" : workspace.notices.length === 1 ? "notice, kept together" : "notices, kept together"}</span></strong><p>{hi ? "ज़रूरी जानकारी यहीं है" : "The details are right here when you need them."}</p></div></div></section>

      {view === "calendar" ? <CalendarView notices={workspace.notices} language={workspace.language} onExport={exportCalendar} onOpen={(n, a) => { activate(n.id); setSelectedActionId(a.id); setEditingDate(a.id); }} /> : <>
        <div className="workspace-section-heading"><h2>{hi ? "सूचना से अगले कदम तक" : "From notice to next steps"}<span className="soft-tag">{hi ? "आसान बना दिया" : "A LITTLE LIGHTER"}</span></h2><button className="button secondary small" onClick={exportCalendar}><ArrowDownToLine size={15} />{hi ? "कैलेंडर डाउनलोड करें" : "Export calendar"}</button></div>
        {notice.revision && <div className="revision-banner"><span className="revision-banner-icon"><GitCompareArrows size={21} /></span><div><strong>{notice.revision.changedCount ? `${notice.revision.changedCount} change${notice.revision.changedCount === 1 ? "" : "s"} caught. Nothing slips through.` : "All caught up. No instruction changes found."}</strong><p>Compared with version {notice.version - 1}. Updated steps need a fresh date confirmation.</p></div><span>VERSION {notice.version}</span></div>}
        <div className="notice-workspace"><section className="actions-panel" aria-label="Your next steps"><div className="notice-overview"><div className="notice-meta"><span className="notice-type"><FileText size={13} />{notice.document.kind === "sample" ? (hi ? "उदाहरण सूचना" : "SAMPLE NOTICE") : (hi ? "स्कूल की सूचना" : "SCHOOL NOTICE")}</span>{notice.document.publishedDate && <span>{formatDate(notice.document.publishedDate, workspace.language, { day: "numeric", month: "short", year: "numeric" })}</span>}</div>
          <h2>{notice.title}</h2><p className="notice-audience"><Users size={14} />{notice.audience}</p><p className="notice-summary">{hi && notice.summaryHi ? notice.summaryHi : notice.summary}</p>
          <div className="notice-tools"><span className="extraction-tag"><span />{notice.mode === "ai" ? "AI extraction" : "Local extraction"}<span className="tag-dot">·</span>v{notice.version}</span><button className="text-button" onClick={() => setImportMode("revision")}><GitCompareArrows size={14} />{hi ? "नया संस्करण जोड़ें" : "Add a revision"}</button></div>
          {notice.document.kind === "sample" && notice.version === 1 && <button className="sample-revision" onClick={sampleRevision}><span><Sparkles size={15} /><span>What if the school changes the plan?</span></span><strong>Try a sample revision <ArrowRight size={13} /></strong></button>}
        </div>
        {notice.warning && <div className="notice-warning" role="alert"><AlertCircle size={16} />{notice.warning}</div>}
        <div className="action-tabs"><div role="group" aria-label="Step filter"><button aria-pressed={filter === "todo"} className={filter === "todo" ? "selected" : ""} onClick={() => setFilter("todo")}>{hi ? "अगले कदम" : "Next steps"}<span>{pending.length}</span></button><button aria-pressed={filter === "done"} className={filter === "done" ? "selected" : ""} onClick={() => setFilter("done")}>{hi ? "पूरे हुए" : "Completed"}<span>{completed.length}</span></button></div><button className="icon-button" aria-label={speaking ? "Stop reading" : "Read the action checklist aloud"} title="Listen to your next steps" onClick={readSteps} disabled={!notice.actions.length}>{speaking ? <VolumeX size={18} /> : <Headphones size={18} />}</button></div>
        <div className="action-list">{shown.length ? shown.map((action, index) => {
          const Icon = ICONS[action.kind];
          return <article className={`action-card ${action.completed ? "completed" : ""} ${action.change === "updated" || action.change === "added" ? "changed" : ""}`} key={action.id}>
            <div className="action-top"><span className={`action-kind ${action.kind}`}><Icon size={19} strokeWidth={1.7} /></span><span className="step-number">{hi ? "कदम" : "STEP"} {String(index + 1).padStart(2, "0")}</span>{action.change === "updated" && <span className="change-tag">Updated</span>}{action.change === "added" && <span className="change-tag">New step</span>}{action.obligation === "optional" && <span className="optional-tag">Optional</span>}<button className={`complete-button ${action.completed ? "checked" : ""}`} aria-label={`${action.completed ? "Mark incomplete" : "Mark complete"}: ${action.summary}`} aria-pressed={action.completed} onClick={() => updateAction(action.id, { completed: !action.completed })}>{action.completed && <Check size={15} />}</button></div>
            <h3>{hi && action.summaryHi ? action.summaryHi : action.summary}</h3>
            {hi && !action.summaryHi && <p className="original-language">मूल भाषा में · अनुवाद के लिए AI विकल्प इस्तेमाल करें</p>}
            {action.previous && <div className="previous-details">{action.previous.dueDate !== action.dueDate ? <><span>Previously {formatDate(action.previous.dueDate, workspace.language)}</span><ArrowRight size={12} /><strong>{action.dueDate ? formatDate(action.dueDate, workspace.language) : "Check new date"}</strong></> : <><span>Previously: {action.previous.summary}</span></>}</div>}
            <button className={`source-link ${selectedActionId === action.id && !sourcePrevious ? "selected" : ""}`} onClick={() => showSource(action)}>{hi ? "स्रोत देखें" : "See source"}<ArrowUpRight size={13} /><span>Quoted from your notice</span></button>
            <div className="action-bottom"><button className={`due-badge ${action.dateIssue ? "uncertain" : ""} ${action.reviewed ? "confirmed" : ""}`} onClick={() => { setEditingDate(editingDate === action.id ? null : action.id); showSource(action); }}><CalendarDays size={14} />{action.dueDate ? `${action.kind === "bring" || action.kind === "attend" ? (hi ? "को" : "On") : (hi ? "तक" : "By")} ${formatDate(action.dueDate, workspace.language)}` : action.dueLabel || (hi ? "तारीख़ नहीं दी गई" : "No date given")}{action.reviewed && <Check size={12} />}</button><button className={`review-date ${action.reviewed ? "reviewed" : ""}`} onClick={() => { setEditingDate(editingDate === action.id ? null : action.id); showSource(action); }}>{action.reviewed ? (hi ? "पुष्टि हो गई" : "Date confirmed") : (hi ? "तारीख़ जाँचें" : "Review date")}{action.reviewed ? <CheckCheck size={13} /> : <ChevronRight size={13} />}</button></div>
            {action.dateIssue && editingDate !== action.id && <p className="date-issue"><AlertCircle size={13} />{action.dateIssue}</p>}
            {editingDate === action.id && <DateReview key={action.id} action={action} onClose={() => setEditingDate(null)} onConfirm={(date) => { updateAction(action.id, { dueDate: date, dateIssue: null, reviewed: true }); setEditingDate(null); setToast("Date confirmed. This step can now be added to your calendar."); }} />}
          </article>;
        }) : <div className="empty-state"><CheckCheck size={32} /><h3>{filter === "done" ? "A little progress goes a long way." : notice.actions.length ? "You’re all caught up." : "No clear next steps found."}</h3><p>{filter === "done" ? "Tick a step when it’s done. It will be waiting for you here." : notice.actions.length ? "All the steps in this notice are complete. Enjoy a little peace of mind." : "Read the source text for context. In local mode, try keeping each English instruction on its own line, or use AI extraction."}</p></div>}</div>
        {notice.revision?.removed.length ? <div className="removed-steps"><strong>Removed in this revision</strong>{notice.revision.removed.map((a) => <p key={a.id}><s>{a.summary}</s></p>)}<small>If you previously added these reminders to a calendar, remove them there too.</small></div> : null}
        <div className="actions-footnote"><ShieldCheck size={15} /><span>{hi ? "पहले मूल सूचना देखें, फिर तारीख़ की पुष्टि करें।" : "Your call, always. Check the source before confirming a date."}</span></div>
        </section><div ref={sourceRef} className="source-column"><SourcePanel notice={notice} action={selectedAction} previous={sourcePrevious} onPrevious={setSourcePrevious} onListen={listen} speaking={speaking} language={workspace.language} /><div className="kind-note"><span><Heart size={16} /></span><p>{hi ? "हर परिवार तक जानकारी पहुँचना ज़रूरी है।" : <>A clear notice is a small thing.<br /><strong>Being included isn’t.</strong></>}</p><span className="kind-note-decoration">✳</span></div></div></div>
      </>}
      <footer className="page-footer"><span>Made with care, for the everyday.</span><span><span className="footer-flower">✳</span> A little bridge. A lot more clarity.</span><a href="https://github.com/ashank-crazy/noticebridge" target="_blank" rel="noreferrer">Open source <ArrowUpRight size={12} /></a></footer>
    </main></div>
    {importMode && <ImportDialog language={workspace.language} aiAvailable={aiAvailable} revision={importMode === "revision" ? notice : undefined} onClose={() => setImportMode(null)} onImport={imported} onSample={loadSample} />}
    {help && <Modal title={hi ? "सूचना से स्पष्टता तक" : "A little bridge from notice to clarity"} onClose={() => setHelp(false)}><div className="help-steps"><div><span>01</span><div><h3>Bring a notice</h3><p>Upload a PDF or an English screenshot, or paste the text. Check extracted text after OCR.</p></div></div><div><span>02</span><div><h3>Find the next steps</h3><p>Every checklist item links to its source wording. The local engine handles common English instructions. Optional AI adds richer extraction and Hindi translation.</p></div></div><div><span>03</span><div><h3>Keep the dates you confirm</h3><p>Check the original and confirm the date. Export unfinished steps as all-day calendar reminders with an alert the day before. Exact times remain in the notice.</p></div></div><div><span>04</span><div><h3>Catch a change of plan</h3><p>Add a revision to compare instructions. Changed steps need a fresh confirmation. Your previous source version stays available; calendar files must be re-imported manually.</p></div></div></div><div className="help-privacy"><ShieldCheck size={20} /><div><strong>Your notices stay close.</strong><p>Notice text is saved in this browser’s local storage. There’s no account or cloud sync. AI processing happens only when you choose it and sends extracted text to OpenAI. Don’t use shared-device storage for private student details.</p></div></div><div className="help-status"><span className="status-dot" />{aiAvailable ? "AI connection available. Choose it separately for each import." : "Local extraction is active. Optional AI setup is documented in the repository."}</div><button className="button primary" onClick={() => setHelp(false)}>Got it <Check size={16} /></button></Modal>}
    {toast && <div className="toast" role="status"><span className="toast-mark"><Bell size={17} /></span><p>{toast}</p><button className="icon-button" aria-label="Dismiss message" onClick={() => setToast("")}><X size={16} /></button></div>}
  </div>;
}
