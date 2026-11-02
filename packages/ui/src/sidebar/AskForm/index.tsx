import { useId, useState } from "react";

import { formatDay, formatTime } from "../format";
import type { AskOption } from "../waiting/model";

export interface AskAnswer {
  /** The option chosen, by label; absent when the answer is the operator's own words. */
  choice?: string;
  /** The answer stands for all future asks like this one. */
  always?: boolean;
  /** The operator's own words: the Other answer, or a note with a choice. */
  text?: string;
}

export interface AskFormProps {
  /** The question, as the asker put it. */
  ask: string;
  /** Who asks, for the button and the note: "Halcyon", "Commander". */
  from: string;
  options: readonly AskOption[];
  onSend: (answer: AskAnswer) => void;
  /** What happened to the answer sent, in words; the form stays open for another. */
  status?: { text: string; tone: "ok" | "warn" | "bad" } | null;
  /** Sending now. */
  busy?: boolean;
  /** The last answer sent: when, and what was chosen or written. */
  sent?: { at: string; answer: AskAnswer } | null;
}

const OTHER = "\u0000other";

/**
 * Answer an ask the way AskUserQuestion is answered: one of the asker's
 * options, or Other in your own words. A choice can carry a note. The
 * answer goes to whoever asked; it approves nothing by itself.
 */
export function AskForm({
  ask,
  from,
  options,
  onSend,
  status,
  busy = false,
  sent,
}: AskFormProps) {
  const name = useId();
  const [choice, setChoice] = useState<string | null>(
    options.length ? null : OTHER,
  );
  const [text, setText] = useState("");
  const other = choice === OTHER;
  const ready = other ? Boolean(text.trim()) : choice !== null;
  return (
    <form
      className="askf"
      aria-label={`Answer ${from}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        const picked = options.find((o) => o.label === choice);
        onSend({
          ...(other ? {} : { choice: choice! }),
          ...(picked?.always ? { always: true } : {}),
          ...(text.trim() ? { text: text.trim().slice(0, 2000) } : {}),
        });
      }}
    >
      <div className="askq">
        <span className="ah">Waiting on you</span>
        <p>{ask}</p>
      </div>
      {sent && (
        <div className="asksent">
          <span className="ah">
            You answered {formatDay(new Date(sent.at))}{" "}
            {formatTime(new Date(sent.at))}
          </span>
          {sent.answer.choice && <strong>{sent.answer.choice}</strong>}
          {sent.answer.text && <p>{sent.answer.text}</p>}
          {status && (
            <span className={`askst ${status.tone}`} role="status">
              {status.text}
            </span>
          )}
        </div>
      )}
      <fieldset>
        <legend className="atlas-visually-hidden">Your answer</legend>
        {options.map((o) => (
          <label key={o.label} className="opt">
            <input
              type="radio"
              name={name}
              checked={choice === o.label}
              onChange={() => setChoice(o.label)}
            />
            <span>
              <strong>
                {o.label}
                {o.recommended && " (Recommended)"}
              </strong>
              {o.description && <em>{o.description}</em>}
            </span>
          </label>
        ))}
        {options.length > 0 && (
          <label className="opt">
            <input
              type="radio"
              name={name}
              checked={other}
              onChange={() => setChoice(OTHER)}
            />
            <span>
              <strong>Other</strong>
              <em>Answer in your own words.</em>
            </span>
          </label>
        )}
      </fieldset>
      <label className="asknote">
        <span>{other ? "Your answer" : "Add a note (optional)"}</span>
        <textarea
          rows={3}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="acts">
        <button type="submit" className="pri-btn" disabled={!ready || busy}>
          {sent ? `Send again to ${from}` : `Send to ${from}`}
        </button>
        {status && !sent && (
          <span className={`askst ${status.tone}`} role="status">
            {status.text}
          </span>
        )}
      </div>
    </form>
  );
}
