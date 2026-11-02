/**
 * The sidebar's remembered choices, under the keys the previous page used,
 * so a switch-over keeps them: the VS Code view hands its saved
 * `localStorage` to the page, and keeps `db.focus` per workspace.
 */
export const KEYS = {
  focus: "db.focus",
  view: "db.view",
  /** "1" when the GitHub list shows only the operator's issues. */
  githubMine: "db.ghMine",
  /** The GitHub groups folded, as a JSON list of labels prefixed `lb:`. */
  githubFolded: "db.gCollapsed",
} as const;

export function load(
  key: string,
  valid: (v: string) => boolean,
): string | null {
  try {
    const value = localStorage.getItem(key);
    return value !== null && valid(value) ? value : null;
  } catch {
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage refused (a private window, a sandbox): the choice lasts this visit.
  }
}

/** A set saved as a JSON list; empty when missing or unreadable. */
export function loadSet(key: string): Set<string> {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return new Set(
      Array.isArray(list) ? list.filter((x) => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}

export function saveSet(key: string, set: ReadonlySet<string>): void {
  save(key, JSON.stringify([...set]));
}
