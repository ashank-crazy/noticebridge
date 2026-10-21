"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CircleHelp,
  ClipboardList,
  FileText,
  GitCompareArrows,
  Headphones,
  Languages,
  Menu,
  Paperclip,
  PencilLine,
  Plus,
  Search,
  Trash2,
  VolumeX,
  X,
  AlertCircle,
} from "lucide-react";
import ImportDialog from "./import-dialog";
import SourcePanel from "./source-panel";
import CalendarView from "./calendar-view";
import ActionCard from "./action-card";
import ProfileDialog from "./profile-dialog";
import Modal from "./modal";
import { analyzeLocal, compareRevision, formatDate } from "@/lib/engine";
import { createCalendar } from "@/lib/calendar";
import { sampleDocument } from "@/lib/sample";
import { workspaceSchema, type ActionItem, type NoticeAnalysis, type Workspace } from "@/lib/types";

const STORAGE_KEY = "noticebridge.workspace.v1";
const initialNotice = analyzeLocal(sampleDocument());
const initial: Workspace = {
  version: 1,
  notices: [initialNotice],
  activeId: initialNotice.id,
  language: "en",
  profile: { name: "", school: "", className: "" },
};

function BrandMark() {
  return (
    <svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect width="44" height="44" rx="13" fill="currentColor" />
      <path
        d="M10 29V20a7 7 0 0 1 14 0v9M21 29V20a7 7 0 0 1 14 0v9"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M8 30h29" stroke="#c5dcaa" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function NoticeBridge() {
  const [workspace, setWorkspace] = useState<Workspace>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<"notices" | "calendar">("notices");
  const [importMode, setImportMode] = useState<"new" | "revision" | null>(null);
  const [help, setHelp] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [noticeQuery, setNoticeQuery] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [filter, setFilter] = useState<"todo" | "done">("todo");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(
    initialNotice.actions[0]?.id ?? null,
  );
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [sourcePrevious, setSourcePrevious] = useState(false);
  const [toast, setToast] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);
  const hi = workspace.language === "hi";
  const notice = workspace.notices.find((n) => n.id === workspace.activeId) ?? workspace.notices[0];
  const pending = notice?.actions.filter((a) => !a.completed) ?? [];
  const completed = notice?.actions.filter((a) => a.completed) ?? [];
  const shown = filter === "todo" ? pending : completed;
  const allActions = workspace.notices.flatMap((n) => n.actions);
  const datesToReview = allActions.filter(
    (a) => !a.completed && !a.reviewed && (a.dueLabel || a.dateIssue),
  ).length;
  const selectedAction = notice?.actions.find((a) => a.id === selectedActionId);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 780px)");
    const syncSize = () => {
      setIsMobile(media.matches);
      if (!media.matches) setSidebarOpen(false);
    };
    syncSize();
    media.addEventListener("change", syncSize);
    return () => media.removeEventListener("change", syncSize);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const result = workspaceSchema.safeParse(JSON.parse(raw));
        if (result.success && result.data.notices.length) {
          setWorkspace(result.data);
          setSelectedActionId(null);
        } else
          setToast(
            "Saved notices could not be restored. The sample is available while you start again.",
          );
      }
    } catch {
      setToast("This browser could not restore saved notices. Changes will stay in this session.");
    }
    setHydrated(true);
    fetch("/api/config")
      .then((r) => r.json())
      .then((r) => setAiAvailable(r.aiAvailable === true))
      .catch(() => {});
    return () => window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      setToast(
        "Your browser storage is full or unavailable. Keep this tab open to retain this session’s notices.",
      );
    }
    document.documentElement.lang = workspace.language;
  }, [workspace, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, [workspace.activeId, sourcePrevious]);

  function activate(id: string) {
    setWorkspace((w) => ({ ...w, activeId: id }));
    setView("notices");
    setFilter("todo");
    setSelectedActionId(null);
    setEditingDate(null);
    setSourcePrevious(false);
    setSidebarOpen(false);
  }

  function updateAction(id: string, update: Partial<ActionItem>) {
    setWorkspace((w) => ({
      ...w,
      notices: w.notices.map((n) =>
        n.id === notice.id
          ? { ...n, actions: n.actions.map((a) => (a.id === id ? { ...a, ...update } : a)) }
          : n,
      ),
    }));
  }

  function showSource(action: ActionItem) {
    setSelectedActionId(action.id);
    setSourcePrevious(false);
    if (window.innerWidth < 1050)
      sourceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openAction(item: NoticeAnalysis, action: ActionItem) {
    activate(item.id);
    setSelectedActionId(action.id);
    setEditingDate(action.id);
    window.requestAnimationFrame(() =>
      document.getElementById(`step-${action.id}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      }),
    );
  }

  function loadSample() {
    const sample = analyzeLocal(sampleDocument());
    setWorkspace((w) => ({
      ...w,
      activeId: sample.id,
      notices: w.notices.some((n) => n.id === sample.id)
        ? w.notices.map((n) => (n.id === sample.id ? sample : n))
        : [...w.notices, sample],
    }));
    setImportMode(null);
    setSidebarOpen(false);
    setView("notices");
    setFilter("todo");
    setSourcePrevious(false);
    setSelectedActionId(sample.actions[0]?.id ?? null);
  }

  function imported(incoming: NoticeAnalysis) {
    let firstActionId = incoming.actions[0]?.id ?? null;
    if (importMode === "revision") {
      const compared = compareRevision(notice, incoming);
      firstActionId = compared.actions[0]?.id ?? null;
      setWorkspace((w) => ({
        ...w,
        notices: w.notices.map((n) => (n.id === notice.id ? compared : n)),
      }));
      setToast(
        `${compared.revision!.changedCount} change${compared.revision!.changedCount === 1 ? "" : "s"} found. Review the updated steps below.`,
      );
    } else {
      if (workspace.notices.length >= 20) {
        setToast("This workspace holds 20 notices. Use a revision to update an existing notice.");
        return;
      }
      setWorkspace((w) => ({ ...w, notices: [...w.notices, incoming], activeId: incoming.id }));
      setToast(
        incoming.actions.length
          ? `${incoming.actions.length} next step${incoming.actions.length === 1 ? "" : "s"} found. Check the dates below.`
          : "Notice added. No clear action instructions were found; read the source text.",
      );
    }
    setImportMode(null);
    setView("notices");
    setFilter("todo");
    setSourcePrevious(false);
    setEditingDate(null);
    setSelectedActionId(firstActionId);
  }

  function removeNotice() {
    setWorkspace((w) => {
      const remaining = w.notices.filter((n) => n.id !== notice.id);
      const notices = remaining.length ? remaining : [analyzeLocal(sampleDocument())];
      return { ...w, notices, activeId: notices[0].id };
    });
    setDeleting(false);
    setSelectedActionId(null);
    setEditingDate(null);
    setSourcePrevious(false);
    setFilter("todo");
    setToast(
      "Notice removed from this browser. Any previously imported calendar reminders must be removed in your calendar app.",
    );
  }

  function sampleRevision() {
    const compared = compareRevision(notice, analyzeLocal(sampleDocument(true)));
    setWorkspace((w) => ({
      ...w,
      notices: w.notices.map((n) => (n.id === notice.id ? compared : n)),
    }));
    setFilter("todo");
    setSourcePrevious(false);
    setEditingDate(null);
    setSelectedActionId(compared.actions[0]?.id ?? null);
    setToast("Consent deadline and packing list updated. Check the revised circular.");
  }

  function exportCalendar() {
    const { content, count } = createCalendar(workspace.notices);
    if (!count) {
      setToast(
        "Review and confirm a step’s date first. Only unfinished steps with confirmed dates are exported.",
      );
      return;
    }
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "noticebridge-reminders.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast(
      `${count} all-day reminder${count === 1 ? "" : "s"} downloaded. Open the file in your calendar app to add them.`,
    );
  }

  function listen(text: string, hindi = hi) {
    if (!("speechSynthesis" in window)) {
      setToast(
        "Read-aloud isn’t available in this browser. You can still read every instruction here.",
      );
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith(hindi ? "hi" : "en"));
    if (hindi && voices.length && !voice) {
      setToast(
        "A Hindi voice isn’t installed on this device. The Hindi text is still available to read.",
      );
      return;
    }
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = hindi ? "hi-IN" : "en-IN";
    speech.rate = 0.9;
    if (voice) speech.voice = voice;
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => {
      setSpeaking(false);
      setToast("Read-aloud could not start. Check the voices installed on your device.");
    };
    window.speechSynthesis.speak(speech);
    setSpeaking(true);
  }

  function readSteps() {
    const hasHindi = notice.actions.every((a) => a.summaryHi);
    if (hi && !hasHindi) {
      setToast("Some steps are only available in the original language. Reading them in English.");
    }
    const useHindi = hi && hasHindi;
    listen(
      notice.actions
        .map(
          (a) =>
            `${useHindi ? a.summaryHi : a.summary}. ${a.dueDate ? formatDate(a.dueDate, useHindi ? "hi" : "en", { day: "numeric", month: "long", year: "numeric" }) : (a.dueLabel ?? "")}.`,
        )
        .join("\n"),
      useHindi,
    );
  }

  const visibleNotices = workspace.notices.filter((item) =>
    `${item.title} ${item.document.name}`.toLowerCase().includes(noticeQuery.toLowerCase()),
  );
  const pinned = workspace.notices
    .flatMap((item) =>
      item.actions
        .filter((action) => action.dueDate && !action.completed && !action.dateIssue)
        .map((action) => ({ notice: item, action })),
    )
    .sort((a, b) => a.action.dueDate!.localeCompare(b.action.dueDate!))[0];
  const schoolContext = [workspace.profile.school, workspace.profile.className]
    .filter(Boolean)
    .join(" / ");

  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape" && sidebarOpen) setSidebarOpen(false);
      }}
    >
      <a className="skip-link" href="#main-content">
        Skip to your noticeboard
      </a>
      <header className="topbar">
        <button
          className="brand"
          aria-label="NoticeBridge home"
          onClick={() => {
            setView("notices");
            setSidebarOpen(false);
          }}
        >
          <BrandMark />
          <span>
            NoticeBridge<small>SCHOOL → HOME</small>
          </span>
        </button>
        <nav className="top-navigation" aria-label="Main navigation">
          <button
            className={view === "notices" ? "active" : ""}
            onClick={() => {
              setView("notices");
              setSidebarOpen(false);
            }}
          >
            {hi ? "नोटिसबोर्ड" : "Noticeboard"}
          </button>
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => {
              setView("calendar");
              setSidebarOpen(false);
            }}
          >
            {hi ? "तारीख़ें" : "Dates"}
          </button>
          <button className="guide-nav" onClick={() => setHelp(true)}>
            {hi ? "कैसे इस्तेमाल करें" : "How to use it"}
            <ArrowUpRight size={12} />
          </button>
        </nav>
        <div className="topbar-right">
          <div className="language-toggle" role="group" aria-label="Interface language">
            <Languages size={17} />
            <button
              className={!hi ? "selected" : ""}
              aria-pressed={!hi}
              onClick={() => setWorkspace((w) => ({ ...w, language: "en" }))}
            >
              EN
            </button>
            <span>/</span>
            <button
              className={hi ? "selected" : ""}
              aria-pressed={hi}
              onClick={() => setWorkspace((w) => ({ ...w, language: "hi" }))}
            >
              हिं
            </button>
          </div>
          <button
            className="button primary header-add"
            aria-label={hi ? "सूचना जोड़ें" : "Pin a notice"}
            onClick={() => setImportMode("new")}
          >
            <Plus size={17} />
            <span>{hi ? "सूचना जोड़ें" : "Pin a notice"}</span>
          </button>
        </div>
      </header>

      <div className="board-layout">
        {sidebarOpen && (
          <button
            className="sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`sidebar ${sidebarOpen ? "open" : ""}`}
          inert={isMobile && !sidebarOpen}
          aria-label="Saved circulars"
        >
          <div className="board-label">
            <span className="pin-dot" />
            {hi ? "बोर्ड पर" : "ON THE BOARD"}
            <span className="file-count">{String(workspace.notices.length).padStart(2, "0")}</span>
          </div>
          <label className="notice-search">
            <Search size={15} />
            <input
              aria-label="Find a circular"
              placeholder={hi ? "सूचना खोजें" : "Find a circular"}
              value={noticeQuery}
              onChange={(event) => setNoticeQuery(event.target.value)}
            />
          </label>
          <div className="sidebar-notices">
            {visibleNotices.map((item, index) => (
              <button
                className={`sidebar-notice ${item.id === notice.id && view === "notices" ? "selected" : ""}`}
                key={item.id}
                onClick={() => activate(item.id)}
              >
                <span className="notice-file-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.document.kind === "sample"
                      ? "EXAMPLE CIRCULAR"
                      : item.document.kind.toUpperCase()}
                    {item.version > 1 ? ` / REV. ${item.version}` : ""}
                  </small>
                </div>
                <ChevronArrow />
              </button>
            ))}
          </div>
          {!visibleNotices.length && <p className="sidebar-empty">No circulars match that name.</p>}
          <button
            className="add-to-board"
            onClick={() => {
              setImportMode("new");
              setSidebarOpen(false);
            }}
          >
            <Plus size={15} />
            {hi ? "एक और सूचना जोड़ें" : "Add another circular"}
          </button>
          <div className="sidebar-note">
            <span className="tape" aria-hidden="true" />
            <span className="handwritten">Spot the changed date.</span>
            <p>The first circular says 24 October. The next one says 27. Compare the two.</p>
            <button onClick={loadSample}>
              {hi ? "उदाहरण फिर शुरू करें" : "Restart the sample"}
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="sidebar-bottom">
            <button
              className="board-settings"
              onClick={() => {
                setProfileOpen(true);
                setSidebarOpen(false);
              }}
            >
              <PencilLine size={16} />
              <span>{hi ? "बोर्ड अपना बनाएँ" : "Make this your board"}</span>
            </button>
            <p>
              <span className="local-dot" />
              {hi ? "इसी डिवाइस पर सहेजा गया" : "Saved on this device"}
            </p>
            <button className="sidebar-help" onClick={() => setHelp(true)}>
              <CircleHelp size={14} />
              How to use it
            </button>
          </div>
        </aside>

        <main className="main-content" id="main-content" inert={isMobile && sidebarOpen}>
          <div className="board-context">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>
              <span className="context-dot" />
              {schoolContext || (hi ? "स्कूल की सूचना, घर के लिए" : "YOUR SCHOOL CIRCULARS")}
            </span>
            <button className="personalize-link" onClick={() => setProfileOpen(true)}>
              <PencilLine size={13} />
              {workspace.profile.name
                ? hi
                  ? "बोर्ड बदलें"
                  : "Edit your board"
                : hi
                  ? "अपना नाम जोड़ें"
                  : "Put your name on it"}
            </button>
          </div>
          <section className="welcome">
            <div className="board-title">
              <span className="edition-label">
                {view === "calendar" ? "THE DATE SHEET / 02" : "THE NOTICEBOARD / 01"}
              </span>
              <h1>
                {view === "calendar" ? (
                  <>
                    {hi ? "कौन सी तारीख़" : "WHAT’S DUE"}
                    <br />
                    <span>{hi ? "याद रखनी है।" : "& WHEN."}</span>
                  </>
                ) : (
                  <>
                    {hi
                      ? workspace.profile.name
                        ? `${workspace.profile.name} का`
                        : "स्कूल का"
                      : workspace.profile.name
                        ? `${workspace.profile.name.toUpperCase()}’S`
                        : "THE SCHOOL"}
                    <br />
                    <span>{hi ? "नोटिसबोर्ड" : "NOTICEBOARD"}</span>
                  </>
                )}
              </h1>
              <p>
                {view === "calendar" ? (
                  hi ? (
                    "सूचना से तारीख़ मिलाएँ। फिर अपने कैलेंडर में जोड़ें।"
                  ) : (
                    "Check the date in the circular. Then put it in your calendar."
                  )
                ) : hi ? (
                  "सहमति पत्र, यात्रा शुल्क और साथ लाने वाली चीज़ें।\nक्लास ग्रुप की सूचनाएँ अब एक जगह।"
                ) : (
                  <>
                    Consent forms. Trip fees. One more thing to pack.
                    <br />
                    The class-group messages, finally in one place.
                  </>
                )}
              </p>
              <div className="board-tally">
                <span>
                  <strong>{allActions.filter((action) => !action.completed).length}</strong>{" "}
                  {hi ? "करने हैं" : "to do"}
                </span>
                <i />
                <span>
                  <strong>{datesToReview}</strong> {hi ? "तारीख़ें जाँचें" : "dates to check"}
                </span>
                <i />
                <span>
                  <strong>{allActions.filter((action) => action.completed).length}</strong>{" "}
                  {hi ? "पूरे हुए" : "done"}
                </span>
              </div>
            </div>
            {pinned ? (
              <button
                className="pinned-deadline"
                onClick={() => openAction(pinned.notice, pinned.action)}
                aria-label={`Review pinned deadline: ${pinned.action.summary}`}
              >
                <span className="paper-pin" aria-hidden="true" />
                <span className="deadline-label">PINNED DEADLINE</span>
                <strong>
                  {formatDate(pinned.action.dueDate, workspace.language, { day: "numeric" })}
                </strong>
                <span className="deadline-month">
                  {formatDate(pinned.action.dueDate, workspace.language, {
                    month: "long",
                  }).toUpperCase()}
                </span>
                <p>
                  {hi && pinned.action.summaryHi ? pinned.action.summaryHi : pinned.action.summary}
                </p>
                <span className="deadline-link">
                  {pinned.action.reviewed ? "DATE CONFIRMED" : "CHECK THIS DATE"}
                  <ArrowUpRight size={14} />
                </span>
              </button>
            ) : (
              <div className="pinned-deadline no-deadlines">
                <span className="paper-pin" />
                <span className="deadline-label">PINNED DEADLINES</span>
                <CalendarDays size={39} />
                <p>No dated steps waiting. Add a circular to get started.</p>
              </div>
            )}
          </section>

          {view === "calendar" ? (
            <CalendarView
              notices={workspace.notices}
              language={workspace.language}
              onExport={exportCalendar}
              onOpen={openAction}
            />
          ) : (
            <>
              <div className="workspace-section-heading">
                <div className="open-circular-label">
                  <Paperclip size={15} />
                  <h2>{hi ? "आपके बोर्ड पर खुली सूचना" : "OPEN ON YOUR BOARD"}</h2>
                </div>
                <button className="button secondary" onClick={exportCalendar}>
                  <ArrowDownToLine size={16} />
                  {hi ? "कैलेंडर डाउनलोड करें" : "Save dates to calendar"}
                </button>
              </div>
              {notice.revision && (
                <div className="revision-banner">
                  <span className="revision-stamp">
                    UPDATED
                    <br />
                    CIRCULAR
                  </span>
                  <div>
                    <strong>
                      {notice.revision.changedCount
                        ? `${notice.revision.changedCount} change${notice.revision.changedCount === 1 ? "" : "s"} since the last circular.`
                        : "Same instructions. New version filed."}
                    </strong>
                    <p>
                      Version {notice.version - 1} → {notice.version}. Changed dates need your
                      confirmation again.
                    </p>
                  </div>
                  <GitCompareArrows size={27} />
                </div>
              )}
              <div className="notice-workspace">
                <section className="actions-panel" aria-label="Your next steps">
                  <div className="sheet-edge" aria-hidden="true" />
                  <div className="sheet-label">
                    <span>01 / THE TO-DO SHEET</span>
                    <Paperclip size={20} />
                  </div>
                  <div className="notice-overview">
                    <div className="notice-meta">
                      <span className="notice-type">
                        {notice.document.kind === "sample" ? "EXAMPLE CIRCULAR" : "SCHOOL CIRCULAR"}
                      </span>
                      <span>
                        {notice.document.publishedDate
                          ? formatDate(notice.document.publishedDate, workspace.language, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "UNDATED"}
                      </span>
                    </div>
                    <h2>{notice.title}</h2>
                    <p className="notice-audience">{notice.audience}</p>
                    <div className="notice-tools">
                      <span className="extraction-tag">
                        {notice.mode === "ai" ? "AI extraction" : "English extraction"} / v
                        {notice.version}
                      </span>
                      <div className="notice-tool-buttons">
                        <button className="text-button" onClick={() => setImportMode("revision")}>
                          <GitCompareArrows size={15} />
                          {hi ? "नया संस्करण मिलाएँ" : "Compare a new version"}
                        </button>
                        <button
                          className="icon-button remove-notice"
                          aria-label="Remove current notice"
                          title="Remove this notice"
                          onClick={() => setDeleting(true)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {notice.document.kind === "sample" && notice.version === 1 && (
                    <button className="sample-revision" onClick={sampleRevision}>
                      <span className="revision-demo-mark">
                        <GitCompareArrows size={20} />
                      </span>
                      <div>
                        <strong>Try the revised circular.</strong>
                        <span>Deadline moved. Packing list changed.</span>
                      </div>
                      <span className="sample-revision-link">
                        {hi ? "नया संस्करण देखें" : "Load revised circular"}
                        <ArrowRight size={16} />
                      </span>
                    </button>
                  )}
                  {notice.warning && (
                    <div className="notice-warning" role="alert">
                      <AlertCircle size={16} />
                      {notice.warning}
                    </div>
                  )}
                  <div className="action-tabs">
                    <div role="group" aria-label="Step filter">
                      <button
                        aria-pressed={filter === "todo"}
                        className={filter === "todo" ? "selected" : ""}
                        onClick={() => setFilter("todo")}
                      >
                        {hi ? "करने हैं" : "To do"}
                        <span>{pending.length}</span>
                      </button>
                      <button
                        aria-pressed={filter === "done"}
                        className={filter === "done" ? "selected" : ""}
                        onClick={() => setFilter("done")}
                      >
                        {hi ? "पूरे हुए" : "Done"}
                        <span>{completed.length}</span>
                      </button>
                    </div>
                    <button
                      className="listen-steps"
                      aria-label={speaking ? "Stop reading" : "Read the action checklist aloud"}
                      disabled={!notice.actions.length}
                      onClick={readSteps}
                    >
                      {speaking ? <VolumeX size={16} /> : <Headphones size={16} />}
                      <span>{speaking ? "Stop" : "Read to me"}</span>
                    </button>
                  </div>
                  <div className="action-list">
                    {shown.length ? (
                      shown.map((action, index) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          index={index}
                          language={workspace.language}
                          selected={selectedActionId === action.id && !sourcePrevious}
                          editing={editingDate === action.id}
                          onToggle={() => updateAction(action.id, { completed: !action.completed })}
                          onSource={() => showSource(action)}
                          onReview={() => {
                            setEditingDate(editingDate === action.id ? null : action.id);
                            setSelectedActionId(action.id);
                            setSourcePrevious(false);
                          }}
                          onCancel={() => setEditingDate(null)}
                          onConfirm={(date) => {
                            updateAction(action.id, {
                              dueDate: date,
                              dateIssue: null,
                              reviewed: true,
                            });
                            setEditingDate(null);
                            setToast("Date confirmed. Ready for calendar export.");
                          }}
                        />
                      ))
                    ) : (
                      <div className="empty-state">
                        <Check size={32} />
                        <h3>
                          {filter === "done"
                            ? "Nothing ticked off yet."
                            : notice.actions.length
                              ? "This circular is done."
                              : "No clear instructions found."}
                        </h3>
                        <p>
                          {filter === "done"
                            ? "Completed steps will be filed here."
                            : notice.actions.length
                              ? "Every step on this sheet has been checked off."
                              : "Read the circular alongside. Try AI extraction for more complex wording."}
                        </p>
                      </div>
                    )}
                  </div>
                  {notice.revision?.removed.length ? (
                    <div className="removed-steps">
                      <strong>Crossed off in this version</strong>
                      {notice.revision.removed.map((action) => (
                        <p key={action.id}>
                          <s>{action.summary}</s>
                        </p>
                      ))}
                      <small>Remove any old reminders from your calendar too.</small>
                    </div>
                  ) : null}
                  <div className="actions-footnote">
                    <Check size={14} />
                    <span>
                      {completed.length}/{notice.actions.length} {hi ? "कदम पूरे" : "steps done"}
                    </span>
                    <div
                      className="completion-track"
                      role="progressbar"
                      aria-label="Checklist completion"
                      aria-valuenow={completed.length}
                      aria-valuemin={0}
                      aria-valuemax={Math.max(1, notice.actions.length)}
                    >
                      <span
                        style={{
                          width: `${notice.actions.length ? (completed.length / notice.actions.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </section>
                <div className="source-column" ref={sourceRef}>
                  <div className="sheet-label source-label">
                    <span>02 / AS SENT BY THE SCHOOL</span>
                    <span className="handwritten">Original stays here.</span>
                  </div>
                  <SourcePanel
                    notice={notice}
                    action={selectedAction}
                    previous={sourcePrevious}
                    onPrevious={setSourcePrevious}
                    onListen={listen}
                    speaking={speaking}
                    language={workspace.language}
                  />
                  <div className="source-annotation">
                    <svg viewBox="0 0 62 40" aria-hidden="true">
                      <path
                        d="M58 32C22 38 6 28 12 5M3 13 12 4l9 8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="handwritten">
                      {hi
                        ? "हर कदम के पीछे, मूल शब्द।"
                        : "Every step has a source.\nTap it. Check it."}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>
              <Paperclip size={13} />
              NoticeBridge · School → home.
            </span>
            <span>
              {workspace.profile.school || "A place for the things the school sends home."}
            </span>
            <a href="https://github.com/ashank-crazy/noticebridge" target="_blank" rel="noreferrer">
              GitHub
              <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      </div>
      {importMode && (
        <ImportDialog
          language={workspace.language}
          aiAvailable={aiAvailable}
          revision={importMode === "revision" ? notice : undefined}
          onClose={() => setImportMode(null)}
          onImport={imported}
          onSample={loadSample}
        />
      )}
      {profileOpen && (
        <ProfileDialog
          profile={workspace.profile}
          language={workspace.language}
          onClose={() => setProfileOpen(false)}
          onSave={(profile) => {
            setWorkspace((w) => ({ ...w, profile }));
            setProfileOpen(false);
            setToast("Board details saved on this device.");
          }}
        />
      )}
      {deleting && (
        <Modal title="Remove this circular?" onClose={() => setDeleting(false)}>
          <p className="modal-intro">
            <strong>{notice.title}</strong> and its checklist will be removed from this browser.
            Calendar reminders you already imported stay in your calendar app. If this is your last
            notice, the sample will be shown.
          </p>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setDeleting(false)}>
              Keep it
            </button>
            <button className="button primary" onClick={removeNotice}>
              <Trash2 size={16} />
              Remove circular
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="Circular in. Instructions out." onClose={() => setHelp(false)}>
          <div className="help-steps">
            <div>
              <span>01</span>
              <div>
                <h3>Pin a notice.</h3>
                <p>
                  Upload a PDF, screenshot, or pasted text. Check the extracted wording before
                  continuing.
                </p>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <h3>Check the instructions.</h3>
                <p>
                  Tick off completed steps. Use “See source” to find the original instruction.
                  Confirm dates before saving them to your calendar.
                </p>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <h3>Compare the next circular.</h3>
                <p>
                  Use “Compare a new version” when the school sends a revision. Changed instructions
                  are marked and the previous circular stays available.
                </p>
              </div>
            </div>
          </div>
          <p className="help-privacy">
            Your board is saved in this browser. AI processing is optional and sends the notice text
            to OpenAI. Calendar files need to be imported manually.
          </p>
          <div className="help-status">
            <span className="local-dot" />
            {aiAvailable
              ? "AI extraction available when you choose it."
              : "Local English extraction is active."}
          </div>
          <button className="button primary" onClick={() => setHelp(false)}>
            Back to the board
            <ArrowRight size={15} />
          </button>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Bell size={17} />
          <p>{toast}</p>
          <button className="icon-button" aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronArrow() {
  return <ArrowUpRight size={13} />;
}
