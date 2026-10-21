"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Modal from "./modal";
import { profileSchema, type BoardProfile, type Language } from "@/lib/types";

export default function ProfileDialog({
  profile,
  language,
  onSave,
  onClose,
}: {
  profile: BoardProfile;
  language: Language;
  onSave: (profile: BoardProfile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const hi = language === "hi";
  return (
    <Modal title={hi ? "अपना नोटिसबोर्ड" : "Put your name on it."} onClose={onClose}>
      <p className="modal-intro">
        {hi
          ? "नाम, स्कूल और कक्षा इस ब्राउज़र में सहेजे जाते हैं।"
          : "Name your board. Add your school and class if you want them on the cover."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const result = profileSchema.safeParse({
            name: draft.name.trim(),
            school: draft.school.trim(),
            className: draft.className.trim(),
          });
          if (result.success) onSave(result.data);
        }}
      >
        <label className="field">
          <span>{hi ? "आपका नाम या परिवार का नाम" : "Your first name or family name"}</span>
          <input
            autoFocus
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            maxLength={28}
            placeholder="e.g. Ashank"
          />
        </label>
        <label className="field">
          <span>{hi ? "स्कूल (वैकल्पिक)" : "School (optional)"}</span>
          <input
            value={draft.school}
            onChange={(event) => setDraft({ ...draft, school: event.target.value })}
            maxLength={70}
            placeholder="Your school"
          />
        </label>
        <label className="field">
          <span>{hi ? "कक्षा / सेक्शन (वैकल्पिक)" : "Class / section (optional)"}</span>
          <input
            value={draft.className}
            onChange={(event) => setDraft({ ...draft, className: event.target.value })}
            maxLength={30}
            placeholder="e.g. Class 8 · Section B"
          />
        </label>
        <div className="modal-footer">
          <span className="fine-print">Saved on this device.</span>
          <button type="submit" className="button primary">
            <Check size={16} />
            {hi ? "बोर्ड सहेजें" : "Save my board"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
