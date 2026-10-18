/** World units to screen pixels: `screen = world * scale + offset`. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const minimumScale = 0.08;
export const maximumScale = 2.5;

export function clampScale(scale: number): number {
  return Math.min(maximumScale, Math.max(minimumScale, scale));
}

export function fitCamera(
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
): Camera {
  const scale = Math.min(
    (width - padding * 2) / (bounds.right - bounds.left),
    (height - padding * 2) / (bounds.bottom - bounds.top),
  );
  return {
    scale,
    x: width / 2 - ((bounds.left + bounds.right) / 2) * scale,
    y: height / 2 - ((bounds.top + bounds.bottom) / 2) * scale,
  };
}

export function worldToScreen(camera: Camera, point: Point): Point {
  return {
    x: point.x * camera.scale + camera.x,
    y: point.y * camera.scale + camera.y,
  };
}

export function screenToWorld(camera: Camera, point: Point): Point {
  return {
    x: (point.x - camera.x) / camera.scale,
    y: (point.y - camera.y) / camera.scale,
  };
}

/** Zoom about a screen point, keeping that point still. */
export function zoomAt(camera: Camera, screen: Point, factor: number): Camera {
  const scale = clampScale(camera.scale * factor);
  return {
    scale,
    x: screen.x - ((screen.x - camera.x) * scale) / camera.scale,
    y: screen.y - ((screen.y - camera.y) * scale) / camera.scale,
  };
}

/** Centre a world point, nudged by `offset` screen pixels to clear a panel. */
export function focusOn(
  point: Point,
  scale: number,
  width: number,
  height: number,
  offset: Point = { x: 0, y: 0 },
): Camera {
  return {
    scale,
    x: width / 2 - point.x * scale + offset.x,
    y: height / 2 - point.y * scale + offset.y,
  };
}

export function interpolateCamera(
  from: Camera,
  to: Camera,
  progress: number,
): Camera {
  const eased = 1 - Math.pow(1 - progress, 3);
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    scale: from.scale + (to.scale - from.scale) * eased,
  };
}
