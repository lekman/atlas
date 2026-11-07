import { useId, type ReactNode } from "react";

export interface DetailsPlaceholderProps {
  /** The page's heading: what the tab is waiting for, or what went wrong. */
  title: string;
  /** A sentence under the heading that says what happens next. */
  children: ReactNode;
}

/**
 * What a task's details tab shows before it has the task: while the
 * worklist loads, or when the worklist does not have the task. It has the
 * details page's shape, the main landmark under a first-level heading, so
 * the task drops into the same place once the worklist brings it.
 */
export function DetailsPlaceholder({
  title,
  children,
}: DetailsPlaceholderProps) {
  const heading = useId();
  return (
    <main className="detail page" aria-labelledby={heading}>
      <div className="inner">
        <div className="dbar">
          <div className="dt">
            <h1 id={heading}>{title}</h1>
          </div>
        </div>
        <div className="dnote" role="status">
          {children}
        </div>
      </div>
    </main>
  );
}
