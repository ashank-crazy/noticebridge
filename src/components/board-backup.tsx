"use client";

import { useRef, useState } from "react";
import { Download, FolderOpen } from "lucide-react";
import Modal from "./modal";
import {
  createBoardBackup,
  downloadText,
  MAX_BACKUP_BYTES,
  readBoardBackup,
} from "@/lib/board-files";
import type { Workspace } from "@/lib/types";

export default function BoardBackup({
  workspace,
  onRestore,
  onClose,
}: {
  workspace: Workspace;
  onRestore: (workspace: Workspace) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <Modal title="Keep a copy of your board." onClose={onClose}>
      <p className="modal-intro">
        Save your circulars, completed steps, checked dates, and board details in one file. Open it
        on another device to pick up where you left off.
      </p>
      <div className="backup-options">
        <button
          className="button primary"
          onClick={() => {
            downloadText(
              createBoardBackup(workspace),
              "noticebridge-board.json",
              "application/json",
            );
            setSaved(true);
          }}
        >
          <Download size={17} />
          {saved ? "Save another copy" : "Download board backup"}
        </button>
        <p className="fine-print">
          {saved
            ? "Backup downloaded. Keep it somewhere safe."
            : "The file includes the full text of your notices. Keep it private."}
        </p>
        <hr />
        <label className="field">
          <span>Restore a saved board</span>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              setPreview(null);
              setError("");
              if (!file) return;
              try {
                if (file.size > MAX_BACKUP_BYTES)
                  throw new Error("Choose a board backup under 8 MB.");
                setPreview(readBoardBackup(await file.text()));
              } catch (error) {
                setError(error instanceof Error ? error.message : "The backup could not be read.");
              } finally {
                if (input.current) input.current.value = "";
              }
            }}
          />
        </label>
        {error && (
          <p className="notice-warning" role="alert">
            {error}
          </p>
        )}
        {preview && (
          <div className="backup-preview">
            <strong>
              {preview.profile.name ? `${preview.profile.name}’s board` : "Saved board"}
            </strong>
            <p>
              {preview.notices.length} circular{preview.notices.length === 1 ? "" : "s"} ·{" "}
              {preview.notices.flatMap((n) => n.actions).filter((a) => a.completed).length}{" "}
              completed steps
            </p>
            <p>
              This replaces the board on this device. Download your current board first if you want
              to keep both.
            </p>
            <button className="button primary" onClick={() => onRestore(preview)}>
              <FolderOpen size={16} />
              Use this saved board
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
