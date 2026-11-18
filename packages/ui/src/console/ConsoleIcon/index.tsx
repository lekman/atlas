import { consoleIcons, type ConsoleIconName } from "../sections";

export interface ConsoleIconProps {
  /** Which line icon to draw. */
  name: ConsoleIconName;
}

/**
 * A console line icon at 24 by 24, in the colour of the text around it.
 * Decorative: the label of the control it sits in says what it means.
 */
export function ConsoleIcon({ name }: ConsoleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="console-icon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: consoleIcons[name] }}
    />
  );
}
