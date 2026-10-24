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

/** Space kept clear on each side of the viewport, in screen pixels. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function fitCamera(
  bounds: Bounds,
  width: number,
  height: number,
  padding: number | Insets,
): Camera {
  const inset =
    typeof padding === "number"
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  const scale = Math.min(
    (width - inset.left - inset.right) / (bounds.right - bounds.left),
    (height - inset.top - inset.bottom) / (bounds.bottom - bounds.top),
  );
  return {
    scale,
    x:
      inset.left +
      (width - inset.left - inset.right) / 2 -
      ((bounds.left + bounds.right) / 2) * scale,
    y:
      inset.top +
      (height - inset.top - inset.bottom) / 2 -
      ((bounds.top + bounds.bottom) / 2) * scale,
  };
}

/**
 * Fit the bounds while keeping clear of panels floating over the map. Each
 * panel can be cleared from above or below, or from the side, or left alone
 * when the map misses it; the fit that draws the map largest wins. When
 * keeping clear would draw the map smaller than `smallest` of its plain fit,
 * as on a short, wide screen, the plain fit wins and the panels overlap.
 */
export function fitAroundPanels(
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
  panels: readonly Bounds[],
  gap = 10,
  smallest = 0.8,
): Camera {
  const plain = fitCamera(bounds, width, height, padding);
  const visible = panels.filter(
    (panel) => panel.right > panel.left && panel.bottom > panel.top,
  );
  type Choice = "none" | "vertical" | "horizontal";
  const choices: Choice[] = ["none", "vertical", "horizontal"];
  let best: Camera | null = null;
  const total = choices.length ** visible.length;
  for (let combination = 0; combination < total; combination += 1) {
    const inset = {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
    };
    let rest = combination;
    const picked = visible.map((panel) => {
      const choice = choices[rest % choices.length] ?? "none";
      rest = Math.floor(rest / choices.length);
      const nearTop = panel.top + panel.bottom < height;
      const nearLeft = panel.left + panel.right < width;
      if (choice === "vertical") {
        if (nearTop) inset.top = Math.max(inset.top, panel.bottom + gap);
        else inset.bottom = Math.max(inset.bottom, height - panel.top + gap);
      } else if (choice === "horizontal") {
        if (nearLeft) inset.left = Math.max(inset.left, panel.right + gap);
        else inset.right = Math.max(inset.right, width - panel.left + gap);
      }
      return { panel, choice };
    });
    if (width - inset.left - inset.right <= 0) continue;
    if (height - inset.top - inset.bottom <= 0) continue;
    const camera = fitCamera(bounds, width, height, inset);
    const drawn = {
      left: bounds.left * camera.scale + camera.x,
      right: bounds.right * camera.scale + camera.x,
      top: bounds.top * camera.scale + camera.y,
      bottom: bounds.bottom * camera.scale + camera.y,
    };
    const overlaps = picked.some(
      ({ panel, choice }) =>
        choice === "none" &&
        drawn.left < panel.right &&
        drawn.right > panel.left &&
        drawn.top < panel.bottom &&
        drawn.bottom > panel.top,
    );
    if (overlaps) continue;
    if (!best || camera.scale > best.scale) best = camera;
  }
  if (!best || best.scale < plain.scale * smallest) return plain;
  return best;
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

/**
 * The whole map with `centre` in the middle of the viewport: the largest
 * scale at which every edge of `bounds` is still inside, `padding` pixels
 * in. The side farthest from the centre sets the scale, so the nearer
 * sides leave empty space rather than move the centre.
 */
export function fitCentredOn(
  bounds: Bounds,
  centre: Point,
  width: number,
  height: number,
  padding: number,
): Camera {
  const reach = {
    x: Math.max(centre.x - bounds.left, bounds.right - centre.x, 1),
    y: Math.max(centre.y - bounds.top, bounds.bottom - centre.y, 1),
  };
  const scale = Math.max(
    0,
    Math.min((width / 2 - padding) / reach.x, (height / 2 - padding) / reach.y),
  );
  return focusOn(centre, scale, width, height);
}
