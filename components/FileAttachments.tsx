"use client";

import { useRef } from "react";

export interface PendingAttachment {
  filename: string;
  mimeType: string;
  /** Set for non-images */
  text?: string;
  /** Set for images */
  base64?: string;
  size?: number;
}

interface Props {
  attachments: PendingAttachment[];
  onAdd: (att: PendingAttachment) => void;
  onRemove: (index: number) => void;
  onError: (msg: string) => void;
}

const ACCEPT =
  ".docx,.txt,.md,.markdown,.html,.htm,.pdf,.json,application/json,image/jpeg,image/png,image/gif,image/webp";

export function FileAttachments({ attachments, onAdd, onRemove, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/extract", { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          onError(err.error || `Failed to extract ${file.name}`);
          continue;
        }
        const payload = (await res.json()) as PendingAttachment;
        onAdd({ ...payload, size: file.size });
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="border-t border-neutral-200 bg-neutral-50 p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-100"
        >
          + Attach
        </button>
        <span className="text-xs text-neutral-500">
          .docx, .pdf, .txt, .md, .html, .json, images
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>
      {attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {attachments.map((att, i) => (
            <li
              key={i}
              className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs shadow-sm"
              title={att.mimeType}
            >
              <span className="max-w-[160px] truncate">{att.filename}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-neutral-400 hover:text-neutral-700"
                aria-label={`Remove ${att.filename}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
