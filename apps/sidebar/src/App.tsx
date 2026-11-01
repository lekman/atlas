import type { Runtime } from "@atlas/runtime";

export interface AppProps {
  runtime: Runtime;
  now?: Date;
}

/** The sidebar. Panels join it as they reach parity with the old page. */
export function App({ runtime, now = new Date() }: AppProps) {
  const today = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="wrap">
      <header className="top">
        <h1>
          Atlas <small>{today}</small>
        </h1>
        {!runtime.present && (
          <p role="status">Live connectors aren't available in this view.</p>
        )}
      </header>
    </div>
  );
}
