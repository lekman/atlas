/**
 * Which tabs the sidebar shows for a client focus, and which one is open.
 *
 * A client's own tab shows only when every client is shown or that client
 * is chosen. With one client chosen, its tabs are named after their source
 * ("Jira" rather than the client's name), and a focus-only tab, such as a
 * client's release status, appears. A selected tab that is hidden by the
 * focus falls back to that client's main tab, then to the focused client's
 * first tab, then to the first tab.
 */

export interface SidebarView {
  id: string;
  /** The client this tab belongs to; none for tabs every client shares. */
  client?: string;
  /** Shown only when this tab's client is the one chosen. */
  focusOnly?: boolean;
  /** The name with every client shown, and with one client chosen. */
  labels: readonly [all: string, focused: string];
}

export interface VisibleViews {
  /** The tabs to show, each with the name for this focus. */
  views: Array<SidebarView & { label: string }>;
  selected: string;
}

/** `focus` is a client key, or `"all"`. */
export function visibleViews(
  views: readonly SidebarView[],
  focus: string,
  selected: string,
): VisibleViews {
  const focused = focus !== "all";
  const shown = (v: SidebarView) =>
    !(v.client && focused && v.client !== focus) && !(v.focusOnly && !focused);
  const visible = views
    .filter(shown)
    .map((v) => ({ ...v, label: v.labels[focused ? 1 : 0] }));

  if (visible.some((v) => v.id === selected)) {
    return { views: visible, selected };
  }
  const current = views.find((v) => v.id === selected);
  const parent =
    !focused && current?.client
      ? visible.find((v) => v.client === current.client && !v.focusOnly)
      : undefined;
  const fallback =
    parent ?? visible.find((v) => v.client === focus) ?? visible[0];
  return { views: visible, selected: fallback?.id ?? selected };
}
