/**
 * The sidebar's remembered choices, under the keys the previous page used,
 * so a switch-over keeps them: the VS Code view hands its saved
 * `localStorage` to the page, and keeps `db.focus` per workspace.
 */
export const KEYS = {
  focus: "db.focus",
  view: "db.view",
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
