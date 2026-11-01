import { ICONS, LOGOS, type IconName, type LogoName } from "../icons";

/**
 * A line icon. Decorative: the text beside it, or the control's label,
 * says what it means.
 */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="ic"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

/** A tracker's logo, in the text colour. Decorative, as `Icon` is. */
export function Logo({ name }: { name: LogoName }) {
  const { viewBox, body } = LOGOS[name];
  return (
    <svg
      viewBox={viewBox}
      className="logo"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
