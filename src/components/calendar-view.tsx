"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/engine";
import type { ActionItem, Language, NoticeAnalysis } from "@/lib/types";

export default function CalendarView({
  notices,
  language,
  onExport,
  onOpen,
}: {
  notices: NoticeAnalysis[];
  language: Language;
  onExport: () => void;
  onOpen: (notice: NoticeAnalysis, action: ActionItem) => void;
}) {
  const hi = language === "hi";
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12);
  });
  const [day, setDay] = useState<string | null>(null);
  const entries = notices.flatMap((notice) =>
    notice.actions.filter((a) => a.dueDate && !a.completed).map((action) => ({ notice, action })),
  );
  const startOffset = (month.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startOffset + total) / 7) * 7 }, (_, i) => {
    const number = i - startOffset + 1;
    return number > 0 && number <= total
      ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(number).padStart(2, "0")}`
      : null;
  });
  const visible = entries
    .filter(({ action }) =>
      day
        ? action.dueDate === day
        : action.dueDate?.startsWith(
            `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
          ),
    )
    .sort((a, b) => a.action.dueDate!.localeCompare(b.action.dueDate!));
  const shift = (delta: number) => {
    setDay(null);
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12));
  };
  return (
    <div className="calendar-layout">
      <section className="calendar-card">
        <div className="section-heading">
          <h2>
            {month.toLocaleDateString(hi ? "hi-IN" : "en-GB", { month: "long", year: "numeric" })}
          </h2>
          <div className="calendar-nav">
            <button className="icon-button" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft size={19} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
                setDay(null);
              }}
            >
              {hi ? "आज" : "Today"}
            </button>
            <button className="icon-button" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {(hi
            ? ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          ).map((name) => (
            <span className="weekday" key={name}>
              {name}
            </span>
          ))}
          {cells.map((date, index) =>
            date ? (
              <button
                key={date}
                onClick={() => setDay(day === date ? null : date)}
                className={`calendar-day ${day === date ? "selected" : ""} ${date === new Date().toLocaleDateString("en-CA") ? "today" : ""}`}
                aria-label={`${formatDate(date, language, { dateStyle: "full" })}, ${entries.filter((e) => e.action.dueDate === date).length} steps`}
                aria-pressed={day === date}
              >
                <span>{Number(date.slice(-2))}</span>
                <div className="day-dots">
                  {entries
                    .filter((e) => e.action.dueDate === date)
                    .slice(0, 4)
                    .map(({ action }) => (
                      <i key={action.id} className={action.reviewed ? "confirmed" : ""} />
                    ))}
                </div>
              </button>
            ) : (
              <div className="calendar-day empty" key={`empty-${index}`} />
            ),
          )}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="confirmed" /> Confirmed date
          </span>
          <span>
            <i /> Needs your review
          </span>
        </div>
      </section>
      <section className="calendar-agenda">
        <div className="section-heading">
          <h2>
            {day
              ? formatDate(day, language, { day: "numeric", month: "long" })
              : hi
                ? "इस महीने के अगले कदम"
                : "Coming up this month"}
          </h2>
          <CalendarDays size={19} />
        </div>
        {visible.length ? (
          visible.map(({ notice, action }) => (
            <button
              className="agenda-item"
              key={`${notice.id}-${action.id}`}
              onClick={() => onOpen(notice, action)}
            >
              <div className="agenda-date">
                <strong>{Number(action.dueDate!.slice(-2))}</strong>
                <span>{formatDate(action.dueDate, language, { month: "short" })}</span>
              </div>
              <div>
                <strong>{hi && action.summaryHi ? action.summaryHi : action.summary}</strong>
                <p>{notice.title}</p>
                <span className={action.reviewed ? "confirmed-label" : "review-label"}>
                  {action.reviewed ? "Date confirmed" : "Review this date"}
                </span>
              </div>
              <ArrowUpRight size={16} />
            </button>
          ))
        ) : (
          <div className="empty-state">
            <CalendarDays size={30} />
            <h3>No steps for these dates</h3>
            <p>Choose another day or add a school notice.</p>
          </div>
        )}
        <div className="calendar-export">
          <p>
            {hi
              ? "तारीख़ों की पुष्टि करने के बाद अपने कैलेंडर में जोड़ें।"
              : "Keep these dates in your calendar. Only steps with confirmed dates are exported."}
          </p>
          <button className="button primary" onClick={onExport}>
            <Download size={16} />
            {hi ? "कैलेंडर डाउनलोड करें" : "Export calendar"}
          </button>
        </div>
      </section>
    </div>
  );
}
