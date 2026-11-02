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
  /** The Jira groups folded, as a JSON list of categories prefixed `cat:`. */
  jiraFolded: "db.jCollapsed",
  /** The worklist band: today, tomorrow or backlog. */
  band: "db.band",
  /** Worklist groups folded: client keys, `q:<quadrant>` and `<quadrant>|<client>`. */
  worklistFolded: "db.collapsed",
  /** "1" when done tasks show. */
  showDone: "db.showDone",
  /** "0" when approved and merged tasks are hidden. */
  showWaiting: "db.showWaiting",
  /** "1" once the backlog has been opened, so its first folds are set once. */
  planInit: "db.planInit",
  /** The sidebar's world: astronomer or mariner. */
  world: "atlas.sidebar.world",
  /** Its lighting: automatic, day or night. */
  lighting: "atlas.sidebar.lighting",
  /** The sound settings, as JSON. */
  sound: "atlas.sidebar.sound",
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

/**
 * A set saved as a JSON list; `fallback` when nothing is saved, empty when
 * it is unreadable.
 */
export function loadSet(
  key: string,
  fallback: readonly string[] = [],
): Set<string> {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return new Set(fallback);
    const list: unknown = JSON.parse(saved);
    return new Set(
      Array.isArray(list) ? list.filter((x) => typeof x === "string") : [],
    );
  } catch {
    // Storage refused (a sandboxed frame): the fallback, as when nothing is saved.
    return new Set(fallback);
  }
}

export function saveSet(key: string, set: ReadonlySet<string>): void {
  save(key, JSON.stringify([...set]));
}
