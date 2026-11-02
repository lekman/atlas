import { useEffect, useId, useRef, type ReactNode } from "react";

import { Icon } from "../Icon";
import { waitingSource, type WaitingItem } from "../waiting/model";

export interface AskViewProps {
  item: WaitingItem;
  /** The client's name, for the line under the title. */
  clientName: string;
  /** The answer form. */
  children: ReactNode;
  onClose: () => void;
}

/**
 * An ask from Commander or a worker, over the sidebar, for asks that have
 * no task to open: who asks, since when, the context, and the answer form.
 * The form shows the context. Back or Escape returns to where it was opened.
 */
export function AskView({ item, clientName, children, onClose }: AskViewProps) {
  const title = useId();
  const back = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      from?.focus?.();
    };
  }, []);
  const who = item.kind === "question" ? "Commander" : item.worker || "Worker";
  return (
    <div
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title}
    >
      <div className="inner">
        <div className="dbar">
          <button
            ref={back}
            type="button"
            className="dback"
            aria-label="Back to Atlas"
            onClick={onClose}
          >
            <Icon name="back" />
            <span aria-hidden="true">Back</span>
          </button>
          <div className="dt">
            <h2 id={title}>{who} asks</h2>
            <div className="sub">
              {waitingSource(item, clientName)
                .filter((part) => part !== "Commander asks")
                .join(" · ")}
            </div>
          </div>
        </div>
        <div className="dbody">{children}</div>
      </div>
    </div>
  );
}
