"use client";

import { useEffect, useRef, useState } from "react";
import { FileAttachments, type PendingAttachment } from "./FileAttachments";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Only present on user turns — shown as chips under the message */
  attachments?: PendingAttachment[];
  /** Only present on assistant turns — which output mode the LLM used */
  mode?: "edit" | "full";
  /** Only present when mode === "edit" — how many ops landed */
  editsApplied?: number;
  /** Only present when mode === "edit" and some ops failed */
  editsFailed?: string[];
}

interface Props {
  messages: ChatMessage[];
  pending: boolean;
  onSend: (message: string, attachments: PendingAttachment[]) => void;
  onReset: () => void;
  error: string | null;
  onDismissError: () => void;
}

export function ChatPanel({
  messages,
  pending,
  onSend,
  onReset,
  error,
  onDismissError,
}: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  function submit() {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments);
    setInput("");
    setAttachments([]);
  }

  return (
    <div className="flex h-full flex-col border-r border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <div>
          <div className="text-sm font-semibold">GC Page Builder</div>
          <div className="text-[11px] text-neutral-500">
            Conversational Canada.ca prototyping
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
          title="Start a new page"
        >
          New page
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          <span className="flex-1">{error}</span>
          <button onClick={onDismissError} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !pending && (
          <div className="rounded bg-neutral-50 p-3 text-xs text-neutral-600">
            <div className="mb-1 font-semibold">Try a prompt:</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>Create a topic page about disability benefits with a services-and-information section with 6 doormats.</li>
              <li>Add a warning alert at the top about a processing-time delay.</li>
              <li>Rewrite the intro in plain language.</li>
              <li>Attach a Word doc and ask Claude to convert it to a Canada.ca page.</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {pending && (
          <div className="my-2 flex items-center gap-2 text-xs text-neutral-500">
            <Spinner /> Thinking...
          </div>
        )}
      </div>

      <FileAttachments
        attachments={attachments}
        onAdd={(a) => setAttachments((list) => [...list, a])}
        onRemove={(i) => setAttachments((list) => list.filter((_, idx) => idx !== i))}
        onError={(msg) => {
          /* bubble up via the error banner */
          onDismissError();
          // reuse onDismissError as a "set error" shim is ugly — instead, fire
          // a custom event. Simpler: push an inline attachment error.
          console.error(msg);
          alert(msg);
        }}
      />

      <div className="border-t border-neutral-200 p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="Describe the page, or ask for a change..."
          className="w-full resize-none rounded border border-neutral-300 p-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            Ctrl/Cmd + Enter to send
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={
        "mb-2 rounded px-3 py-2 text-sm " +
        (isUser ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-900")
      }
    >
      <div className="whitespace-pre-wrap">{message.content}</div>
      {message.attachments && message.attachments.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {message.attachments.map((a, i) => (
            <li
              key={i}
              className={
                "rounded px-1 py-0.5 text-[10px] " +
                (isUser ? "bg-white/20" : "bg-neutral-200")
              }
            >
              {a.filename}
            </li>
          ))}
        </ul>
      )}
      {!isUser && message.mode && (
        <ModeBadge
          mode={message.mode}
          editsApplied={message.editsApplied}
          editsFailed={message.editsFailed}
        />
      )}
    </div>
  );
}

function ModeBadge({
  mode,
  editsApplied,
  editsFailed,
}: {
  mode: "edit" | "full";
  editsApplied?: number;
  editsFailed?: string[];
}) {
  if (mode === "full") {
    return (
      <div className="mt-1 inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600">
        Full rewrite
      </div>
    );
  }
  const failed = editsFailed?.length ?? 0;
  const label =
    `${editsApplied ?? 0} edit${editsApplied === 1 ? "" : "s"} applied` +
    (failed > 0 ? ` · ${failed} failed` : "");
  return (
    <div
      className={
        "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] " +
        (failed > 0
          ? "bg-amber-100 text-amber-900"
          : "bg-emerald-100 text-emerald-900")
      }
      title={failed > 0 ? editsFailed?.join("\n") : "All ops applied cleanly"}
    >
      {label}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"
      aria-hidden
    />
  );
}
