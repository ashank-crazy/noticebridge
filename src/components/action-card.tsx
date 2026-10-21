"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  X,
} from "lucide-react";
import { formatDate, formatDeadline } from "@/lib/engine";
import { isoDate, type ActionItem, type Language } from "@/lib/types";

const CATEGORY: Record<ActionItem["kind"], string> = {
  submit: "PAPERWORK",
  pay: "PAYMENT",
  bring: "PACK THIS",
  attend: "BE THERE",
  confirm: "REPLY NEEDED",
  other: "REMEMBER",
};

function DateReview({
  action,
  language,
  onConfirm,
  onClose,
}: {
  action: ActionItem;
  language: Language;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(action.dueDate ?? "");
  const hi = language === "hi";
  return (
    <form
      className="date-review"
      onSubmit={(event) => {
        event.preventDefault();
        if (isoDate.safeParse(date).success) onConfirm(date);
      }}
    >
      <label htmlFor={`date-${action.id}`}>
        <strong>{hi ? "मूल सूचना से तारीख़ मिलाएँ" : "Check it against the circular."}</strong>
        <span>
          {action.dateIssue ??
            (hi
              ? "यह पूरे दिन का रिमाइंडर होगा। समय के लिए मूल सूचना देखें।"
              : "This creates an all-day reminder. Exact times stay in the circular.")}
        </span>
      </label>
      <div>
        <input
          id={`date-${action.id}`}
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="Confirm reminder date"
        />
        <button
          type="submit"
          className="button primary small"
          disabled={!isoDate.safeParse(date).success}
        >
          <Check size={14} />
          {hi ? "पुष्टि करें" : "Confirm date"}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Cancel date review"
        >
          <X size={16} />
        </button>
      </div>
    </form>
  );
}

export default function ActionCard({
  action,
  index,
  language,
  selected,
  editing,
  onToggle,
  onSource,
  onReview,
  onConfirm,
  onCancel,
}: {
  action: ActionItem;
  index: number;
  language: Language;
  selected: boolean;
  editing: boolean;
  onToggle: () => void;
  onSource: () => void;
  onReview: () => void;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}) {
  const hi = language === "hi";
  const dateChanged = action.previous && action.previous.dueDate !== action.dueDate;
  return (
    <article
      className={`action-card ${action.completed ? "completed" : ""} ${action.change === "updated" || action.change === "added" ? "changed" : ""} ${selected ? "source-selected" : ""}`}
    >
      <div className="action-top">
        <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="action-category">{CATEGORY[action.kind]}</span>
        {action.change === "updated" && (
          <span className="change-tag">{dateChanged ? "DATE CHANGED" : "UPDATED"}</span>
        )}
        {action.change === "added" && <span className="change-tag">NEW</span>}
        {action.obligation === "optional" && <span className="optional-tag">Optional</span>}
        <button
          className={`complete-button ${action.completed ? "checked" : ""}`}
          aria-label={`${action.completed ? "Mark incomplete" : "Mark complete"}: ${action.summary}`}
          aria-pressed={action.completed}
          onClick={onToggle}
        >
          {action.completed && <Check size={17} />}
        </button>
      </div>
      <h3>{hi && action.summaryHi ? action.summaryHi : action.summary}</h3>
      {hi && !action.summaryHi && (
        <p className="original-language">मूल भाषा में · अनुवाद के लिए AI विकल्प चुनें</p>
      )}
      {action.previous && (
        <div className="previous-details">
          {dateChanged ? (
            <>
              <s>{formatDate(action.previous.dueDate, language)}</s>
              <ArrowRight size={15} />
              <strong>
                {action.dueDate ? formatDate(action.dueDate, language) : "Review new date"}
              </strong>
            </>
          ) : (
            <s>{action.previous.summary}</s>
          )}
        </div>
      )}
      <div className="action-evidence">
        <button className={`source-link ${selected ? "selected" : ""}`} onClick={onSource}>
          {hi ? "स्रोत देखें" : "See source"}
          <ArrowUpRight size={13} />
        </button>
        <span>{hi ? "मूल शब्द साथ हैं" : "Original wording attached"}</span>
      </div>
      <div className="action-bottom">
        <button
          className={`due-badge ${action.dateIssue ? "uncertain" : ""} ${action.reviewed ? "confirmed" : ""}`}
          onClick={onReview}
        >
          <CalendarDays size={14} />
          {formatDeadline(action, language)}
          {action.reviewed && <Check size={12} />}
        </button>
        <button className={`review-date ${action.reviewed ? "reviewed" : ""}`} onClick={onReview}>
          {action.reviewed
            ? hi
              ? "पुष्टि हो गई"
              : "Confirmed"
            : hi
              ? "तारीख़ जाँचें"
              : "Check date"}
          {action.reviewed ? <CheckCheck size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      {action.dateIssue && !editing && (
        <p className="date-issue">
          <AlertCircle size={14} />
          {action.dateIssue}
        </p>
      )}
      {editing && (
        <DateReview action={action} language={language} onConfirm={onConfirm} onClose={onCancel} />
      )}
    </article>
  );
}
