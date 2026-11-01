import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

export interface ClientChoice {
  key: string;
  name: string;
  /** A CSS colour, `var(--client-1)` and so on. */
  colour: string;
}

export interface ClientPillProps {
  clients: readonly ClientChoice[];
  /** A client key, or `"all"`. */
  focus: string;
  onChoose: (focus: string) => void;
}

/**
 * The client filter, in the next-up card's corner. "Clients" while every
 * client shows; the client's name, in its colour, while one is chosen. It
 * opens a menu of every client, with the current choice checked.
 */
export function ClientPill({ clients, focus, onChoose }: ClientPillProps) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const pill = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const chosen = clients.find((c) => c.key === focus);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) pill.current?.focus();
  };

  // Under the pill, right-aligned, kept inside the window.
  useLayoutEffect(() => {
    if (!open || !pill.current || !menu.current) return;
    const r = pill.current.getBoundingClientRect();
    const m = menu.current.getBoundingClientRect();
    setPlace({
      left: Math.max(
        8,
        Math.min(window.innerWidth - m.width - 8, r.right - m.width),
      ),
      top: r.bottom + 4,
    });
    const first =
      menu.current.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
      menu.current.querySelector<HTMLButtonElement>("button");
    first?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !pill.current?.contains(target)) {
        close(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === "ArrowDown"
        ? (at + 1) % items.length
        : e.key === "ArrowUp"
          ? (at - 1 + items.length) % items.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : -1;
    if (to >= 0) {
      e.preventDefault();
      items[to]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close(true);
    }
  };

  const choose = (key: string) => {
    close(true);
    onChoose(key);
  };

  const option = (key: string, label: string, colour: string) => (
    <button
      key={key}
      type="button"
      role="menuitemradio"
      aria-checked={focus === key}
      style={{ "--c": colour } as CSSProperties}
      onClick={() => choose(key)}
    >
      <span className="dot" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <>
      <button
        ref={pill}
        type="button"
        className={chosen ? "pill on" : "pill"}
        style={{ "--c": chosen?.colour ?? "var(--accent)" } as CSSProperties}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          chosen
            ? `Showing ${chosen.name} only. Change client`
            : "Showing all clients. Choose a client"
        }
        onClick={() => setOpen((was) => !was)}
      >
        {chosen ? chosen.name : "Clients"}
        <i className="chev" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          className="menu"
          role="menu"
          aria-label="Choose a client"
          style={place}
          onKeyDown={onMenuKey}
        >
          {option("all", "All clients", "var(--muted)")}
          <hr />
          {clients.map((c) => option(c.key, c.name, c.colour))}
        </div>
      )}
    </>
  );
}
