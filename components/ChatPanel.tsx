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
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <div className="text-base font-semibold text-neutral-900">GC Page Builder</div>
          <div className="text-xs text-neutral-500">
            Conversational Canada.ca prototyping
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
          title="Start a new page"
        >
          New page
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900">
          <span className="flex-1">{error}</span>
          <button
            onClick={onDismissError}
            aria-label="Dismiss"
            className="rounded text-red-600 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !pending && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="mb-2 font-semibold text-neutral-900">Try a prompt:</div>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed">
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
          <div className="my-3 flex items-center gap-2 text-sm text-neutral-500">
            <Spinner /> Thinking...
          </div>
        )}
      </div>

      <FileAttachments
        attachments={attachments}
        onAdd={(a) => setAttachments((list) => [...list, a])}
        onRemove={(i) => setAttachments((list) => list.filter((_, idx) => idx !== i))}
        onError={(msg) => {
          onDismissError();
          console.error(msg);
          alert(msg);
        }}
      />

      <div className="border-t border-neutral-200 bg-neutral-50/50 p-3">
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
          className="w-full resize-none rounded-lg border border-neutral-300 bg-white p-3 text-sm leading-relaxed shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Ctrl/Cmd + Enter to send
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
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
    <div className={"mb-3 flex " + (isUser ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm " +
          (isUser
            ? "rounded-br-md bg-blue-600 text-white"
            : "rounded-bl-md bg-white text-neutral-900 ring-1 ring-neutral-200")
        }
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {message.attachments.map((a, i) => (
              <li
                key={i}
                className={
                  "rounded-md px-2 py-0.5 text-[11px] " +
                  (isUser
                    ? "bg-white/20 text-white"
                    : "bg-neutral-100 text-neutral-700")
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
      <div className="mt-2 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
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
        "mt-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium " +
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
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600"
      aria-hidden
    />
  );
}
