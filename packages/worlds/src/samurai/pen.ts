/**
 * The few path commands both the canvas and the still SVG map share, so a
 * shape is described once and drawn either way.
 */
export interface Pen {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  arc(
    x: number,
    y: number,
    radius: number,
    start: number,
    end: number,
    anticlockwise?: boolean,
  ): void;
  closePath(): void;
}

const fixed = (value: number) => value.toFixed(1).replace(/\.0$/, "");

/** Collects path commands as SVG path data. Full circles only for `arc`. */
export class SvgPen implements Pen {
  data = "";

  moveTo(x: number, y: number): void {
    this.data += `M${fixed(x)} ${fixed(y)}`;
  }

  lineTo(x: number, y: number): void {
    this.data += `L${fixed(x)} ${fixed(y)}`;
  }

  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.data += `Q${fixed(cx)} ${fixed(cy)} ${fixed(x)} ${fixed(y)}`;
  }

  arc(x: number, y: number, radius: number): void {
    const r = fixed(radius);
    this.data +=
      `M${fixed(x + radius)} ${fixed(y)}` +
      `A${r} ${r} 0 1 0 ${fixed(x - radius)} ${fixed(y)}` +
      `A${r} ${r} 0 1 0 ${fixed(x + radius)} ${fixed(y)}`;
  }

  closePath(): void {
    this.data += "Z";
  }

  /** Return what was drawn and start again. */
  take(): string {
    const data = this.data;
    this.data = "";
    return data;
  }
}
