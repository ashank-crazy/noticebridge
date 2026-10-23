"use client";

import { useState } from "react";
import { Check, Copy, Download, Printer } from "lucide-react";
import Modal from "./modal";
import { downloadText, familyBrief } from "@/lib/board-files";
import type { Language, NoticeAnalysis } from "@/lib/types";

export default function FamilyBrief({
  notice,
  language,
  onClose,
}: {
  notice: NoticeAnalysis;
  language: Language;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const hi = language === "hi";
  const content = familyBrief(notice, language);
  return (
    <Modal title={hi ? "घर के लिए एक पन्ना।" : "One sheet for home."} onClose={onClose} wide>
      <p className="modal-intro">
        {hi
          ? "परिवार के साथ साझा करें या प्रिंट करें। हर निर्देश के साथ उसके मूल शब्द हैं।"
          : "Copy it into the family group, save it, or stick it on the fridge. Every step keeps its source words."}
      </p>
      <div className="family-brief-paper" tabIndex={0} aria-label="Family checklist preview">
        <div className="brief-masthead">
          <span>NOTICEBRIDGE</span>
          <span>SCHOOL → HOME / v{notice.version}</span>
        </div>
        <pre>{content}</pre>
      </div>
      {error && (
        <p className="notice-warning" role="alert">
          {error}
        </p>
      )}
      <div className="modal-footer brief-tools">
        <button className="button secondary" onClick={() => window.print()}>
          <Printer size={16} />
          {hi ? "प्रिंट" : "Print sheet"}
        </button>
        <button
          className="button secondary"
          onClick={() => downloadText(content, "noticebridge-family-checklist.txt")}
        >
          <Download size={16} />
          {hi ? "सहेजें" : "Save text"}
        </button>
        <button
          className="button primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(content);
              setCopied(true);
              setError("");
            } catch {
              setError(
                hi
                  ? "कॉपी नहीं हो सका। टेक्स्ट सहेजें।"
                  : "Copy isn’t available here. Save the text instead.",
              );
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
          {copied ? (hi ? "कॉपी हुआ" : "Copied") : hi ? "चेकलिस्ट कॉपी करें" : "Copy checklist"}
        </button>
      </div>
    </Modal>
  );
}
