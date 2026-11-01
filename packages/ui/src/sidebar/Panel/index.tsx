import { useId, type ReactNode } from "react";

export interface PanelProps {
  title: string;
  /** Beside the title: a count or a short state. */
  sub?: ReactNode;
  /** Controls in the header, after the title. */
  controls?: ReactNode;
  /** Notes above the content. */
  notes?: ReactNode;
  /** Under the content: where the data came from and how old it is. */
  fresh?: string;
  /** While nothing has arrived: grey bars in place of the content. */
  loading?: boolean | number;
  children?: ReactNode;
}

/** One of the sidebar's sections: a titled card with notes and a freshness line. */
export function Panel({
  title,
  sub,
  controls,
  notes,
  fresh,
  loading,
  children,
}: PanelProps) {
  const heading = useId();
  const bars = loading === true ? 2 : loading ? loading : 0;
  return (
    <section className="panel" aria-labelledby={heading}>
      <div className="ph">
        <h2 id={heading}>{title}</h2>
        {controls}
        {sub !== undefined && <span className="sub">{sub}</span>}
      </div>
      {notes}
      {bars > 0 ? (
        <div role="status" aria-busy="true">
          <span className="sr">Loading {title}</span>
          {Array.from({ length: bars }, (_, i) => (
            <div key={i} className="skel" aria-hidden="true" />
          ))}
        </div>
      ) : (
        children
      )}
      {fresh && <div className="fresh">{fresh}</div>}
    </section>
  );
}
