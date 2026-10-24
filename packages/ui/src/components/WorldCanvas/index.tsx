/**
 * The live map. Draws a scene with a world's painter on every animation
 * frame, and turns pointer input into pan, zoom, pinch and taps.
 *
 * In `compact` detail the map does not pan or zoom: it is a glance, and a tap
 * anywhere asks the parent to open the full view on whatever was tapped.
 */
import {
  clampScale,
  fitCamera,
  fitCentredOn,
  focusOn,
  hitTest,
  interpolateCamera,
  paintScene,
  smallestOrbit,
  zoomAt,
  type Bounds,
  type Camera,
  type HitTarget,
  type Lighting,
  type Scene,
  type World,
} from "@atlas/worlds";
import { useEffect, useRef } from "react";

export interface WorldCanvasProps {
  /** The dataset, its layout and what is moving; stepped every frame. */
  scene: Scene;
  /** Whose painter draws the map. */
  world: World;
  /** Compact draws names only and holds the camera still. */
  detail: "compact" | "full";
  /** Day or night; a world without a night mode draws its day. */
  lighting?: Lighting;
  /** The record ringed as selected, if any. */
  selectedId: string | null;
  /** A tap: the record under the pointer, or null for empty space. */
  onSelect(id: string | null): void;
  /**
   * A double tap on a client in compact detail: the parent opens the full
   * view and passes the client back as `zoomClientId`.
   */
  onOpenSystem?(clientId: string): void;
  /** Fly in to this client's system. Change `zoomRequest` to ask again. */
  zoomClientId?: string | null;
  /** Any new value repeats the flight to `zoomClientId`. */
  zoomRequest?: number;
  /** Fly to this record when it changes. */
  focusId?: string | null;
  /**
   * Records to keep in view beside `focusId`, such as the work a question
   * blocks. The flight zooms out just enough to show them all.
   */
  focusWith?: readonly string[];
  /**
   * The part of the map no panel covers, in screen pixels from the canvas's
   * top left corner. A record flown to lands at its centre rather than at
   * the centre of the canvas. Without it, the canvas centre is used.
   */
  focusArea?(): Bounds | null;
  /** Called a few times a second while the camera moves, for the HUD. */
  onCameraChange?(camera: Camera): void;
  /**
   * Where to look at start, as the map point in the middle of the canvas
   * and a scale, for a page restoring its view after a reload. The map
   * then stays where it was put instead of fitting itself.
   */
  initialView?: { x: number; y: number; scale: number } | null;
  /** What a screen reader hears for the map as a whole. */
  label: string;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
/** How close a flight to a record comes: near enough to read its labels. */
const focusScale = 2.3;
/** Space kept around the records flown to, in screen pixels. */
const focusMargin = 90;
/** An area narrower or shorter than this is ignored, and the canvas is used. */
const smallestFocusArea = 160;
const doubleTapMilliseconds = 300;
/**
 * How far past a client's workstream orbit a double tap still counts as
 * its system, and how much room a flight to a system leaves round the
 * orbit, in world units: enough for the captions above the top marker.
 */
const systemMargin = 70;
/** Room above a workstream marker for its caption, in world units. */
const captionRoom = 95;

export function WorldCanvas(props: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  live.current = props;
  const camera = useRef<Camera>({ x: 0, y: 0, scale: 0.2 });
  const flight = useRef<{
    from: Camera;
    to: Camera;
    start: number;
    duration: number;
  } | null>(null);
  const userMoved = useRef(false);
  const hits = useRef<HitTarget[]>([]);
  const zoomedSystem = useRef<string | null>(null);
  const size = useRef({ width: 0, height: 0, pixelRatio: 1 });

  const restored = useRef(false);
  const fit = (animate: boolean) => {
    const { width, height } = size.current;
    if (width === 0 || height === 0) return;
    const view = live.current.initialView;
    if (view && !restored.current) {
      restored.current = true;
      userMoved.current = true;
      camera.current = {
        x: width / 2 - view.x * view.scale,
        y: height / 2 - view.y * view.scale,
        scale: view.scale,
      };
      flight.current = null;
      return;
    }
    const { detail, scene } = live.current;
    const padding = detail === "full" ? (width < 760 ? 14 : 70) : 12;
    // The full map opens on home, in the middle of the canvas, at the
    // largest scale that still shows every client. The log and the HUD may
    // cover its edges: home in the centre comes first.
    const home = scene.dataset.clients.find((client) => client.home === true);
    const centre = home ? scene.layout.clients.get(home.id) : undefined;
    const target =
      detail === "full" && centre
        ? fitCentredOn(scene.layout.bounds, centre, width, height, padding)
        : fitCamera(scene.layout.bounds, width, height, padding);
    if (animate)
      flight.current = {
        from: { ...camera.current },
        to: target,
        start: performance.now() / 1000,
        duration: 0.6,
      };
    else {
      camera.current = target;
      flight.current = null;
    }
  };

  // Size, orientation and the frame loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const motionPreference = window.matchMedia?.(reducedMotionQuery);

    const resize = () => {
      // The layout size, not the drawn one: the full view opens with a
      // short scale-up, and a size measured during it would be 1.5% small
      // for good, since a transform does not trigger the observer.
      const rectangle = {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      };
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      size.current = {
        width: rectangle.width,
        height: rectangle.height,
        pixelRatio,
      };
      canvas.width = Math.round(rectangle.width * pixelRatio);
      canvas.height = Math.round(rectangle.height * pixelRatio);
      const portrait = rectangle.height > rectangle.width * 1.15;
      const before = live.current.scene.layout.orientation;
      live.current.scene.setOrientation(portrait ? "portrait" : "landscape");
      if (before !== live.current.scene.layout.orientation)
        userMoved.current = false;
      // Until the reader moves the map, it stays fitted, even when the size
      // changes in the middle of the opening flight.
      if (!userMoved.current) fit(flight.current !== null);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    let last = performance.now() / 1000;
    let lastReport = 0;
    const draw = () => {
      const time = performance.now() / 1000;
      const seconds = Math.min(0.1, time - last);
      last = time;
      const { scene, world, detail, selectedId, onCameraChange } = live.current;
      const reducedMotion = motionPreference?.matches ?? false;
      if (flight.current) {
        const progress = Math.min(
          1,
          (time - flight.current.start) / flight.current.duration,
        );
        camera.current = interpolateCamera(
          flight.current.from,
          flight.current.to,
          reducedMotion ? 1 : progress,
        );
        if (progress >= 1 || reducedMotion) flight.current = null;
      }
      scene.step(time, seconds, reducedMotion);
      if (size.current.width > 0) {
        hits.current = paintScene(
          {
            context,
            camera: camera.current,
            pixelRatio: size.current.pixelRatio,
            width: size.current.width,
            height: size.current.height,
            detail,
            time,
            reducedMotion,
            lighting: live.current.lighting ?? "day",
            scene,
            selectedId,
          },
          world,
        );
      }
      if (onCameraChange && time - lastReport > 0.25) {
        lastReport = time;
        onCameraChange({ ...camera.current });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // The loop reads everything through `live`, so it starts once and never
    // restarts when a prop changes.
  }, []);

  // Refit when the view changes between compact and full, but not on the
  // first render: the size effect has fitted, or restored a saved view.
  const shownDetail = useRef(props.detail);
  useEffect(() => {
    if (shownDetail.current === props.detail) return;
    shownDetail.current = props.detail;
    userMoved.current = false;
    zoomedSystem.current = null;
    const timer = window.setTimeout(() => fit(true), 30);
    return () => window.clearTimeout(timer);
  }, [props.detail]);

  /** The client whose system is under a screen point, if any. */
  const systemAt = (x: number, y: number): string | null => {
    const world = {
      x: (x - camera.current.x) / camera.current.scale,
      y: (y - camera.current.y) / camera.current.scale,
    };
    const { scene } = live.current;
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const client of scene.dataset.clients) {
      const centre = scene.layout.clients.get(client.id);
      if (!centre) continue;
      const reach =
        (scene.layout.orbits.get(client.id) ?? smallestOrbit) + systemMargin;
      const distance = Math.hypot(world.x - centre.x, world.y - centre.y);
      if (distance < reach && distance < bestDistance) {
        best = client.id;
        bestDistance = distance;
      }
    }
    return best;
  };

  const flyToSystem = (clientId: string) => {
    const { scene } = live.current;
    const centre = scene.layout.clients.get(clientId);
    if (!centre) return;
    const { width, height } = size.current;
    // The whole orbit, with room above each marker for its caption and
    // below for its items. Labels run sideways off the orbit, so they are
    // left to pan to: a busy system on a laptop then opens close enough
    // to read its items' labels.
    const orbit = scene.layout.orbits.get(clientId) ?? smallestOrbit;
    const box = {
      left: centre.x - orbit - systemMargin,
      right: centre.x + orbit + systemMargin,
      top: centre.y - orbit,
      bottom: centre.y + orbit,
    };
    for (const marker of scene.layout.markers) {
      if (marker.clientId !== clientId) continue;
      box.top = Math.min(box.top, marker.position.y - captionRoom);
      box.bottom = Math.max(box.bottom, marker.position.y + systemMargin);
    }
    const scale = clampScale(
      Math.min(width / (box.right - box.left), height / (box.bottom - box.top)),
    );
    const middle = {
      x: (box.left + box.right) / 2,
      y: (box.top + box.bottom) / 2,
    };
    userMoved.current = true;
    zoomedSystem.current = clientId;
    flight.current = {
      from: { ...camera.current },
      to: focusOn(middle, scale, width, height),
      start: performance.now() / 1000,
      duration: 0.6,
    };
  };

  const flyToGalaxy = () => {
    zoomedSystem.current = null;
    userMoved.current = false;
    fit(true);
  };

  // Fly in to a system when the parent asks (after a double tap in compact).
  useEffect(() => {
    const id = props.zoomClientId;
    if (!id) return;
    const timer = window.setTimeout(() => flyToSystem(id), 120);
    return () => window.clearTimeout(timer);
  }, [props.zoomClientId, props.zoomRequest]);

  // Fly to a record when asked, close enough to read it, and centred in the
  // part of the map that no panel covers.
  useEffect(() => {
    const id = props.focusId;
    if (!id) return;
    const timer = window.setTimeout(() => {
      const target = hits.current.find((candidate) => candidate.id === id);
      if (!target) return;
      const { width, height } = size.current;
      const toWorld = (point: { x: number; y: number }) => ({
        x: (point.x - camera.current.x) / camera.current.scale,
        y: (point.y - camera.current.y) / camera.current.scale,
      });
      const points = [
        target,
        ...(live.current.focusWith ?? []).flatMap((other) =>
          hits.current.filter((candidate) => candidate.id === other),
        ),
      ].map(toWorld);
      const box = {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)),
        bottom: Math.max(...points.map((point) => point.y)),
      };
      const measured = live.current.focusArea?.() ?? null;
      const area =
        measured &&
        measured.right - measured.left >= smallestFocusArea &&
        measured.bottom - measured.top >= smallestFocusArea
          ? measured
          : { left: 0, top: 0, right: width, bottom: height };
      const room = {
        width: Math.max(1, area.right - area.left - focusMargin * 2),
        height: Math.max(1, area.bottom - area.top - focusMargin * 2),
      };
      const scale = clampScale(
        Math.min(
          focusScale,
          room.width / Math.max(1, box.right - box.left),
          room.height / Math.max(1, box.bottom - box.top),
        ),
      );
      const offset = {
        x: (area.left + area.right) / 2 - width / 2,
        y: (area.top + area.bottom) / 2 - height / 2,
      };
      userMoved.current = true;
      flight.current = {
        from: { ...camera.current },
        to: focusOn(
          {
            x: (box.left + box.right) / 2,
            y: (box.top + box.bottom) / 2,
          },
          scale,
          width,
          height,
          offset,
        ),
        start: performance.now() / 1000,
        duration: 0.6,
      };
    }, 80);
    return () => window.clearTimeout(timer);
  }, [props.focusId]);

  // Pointer input.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { x: number; y: number; camera: Camera; moved: boolean } | null =
      null;
    let pinch: {
      distance: number;
      camera: Camera;
      centre: { x: number; y: number };
    } | null = null;
    const local = (event: PointerEvent | WheelEvent) => {
      const rectangle = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rectangle.left,
        y: event.clientY - rectangle.top,
      };
    };
    const full = () => live.current.detail === "full";

    const down = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      const point = local(event);
      pointers.set(event.pointerId, point);
      if (pointers.size === 2 && full()) {
        const [first, second] = [...pointers.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        pinch = {
          distance: Math.hypot(first.x - second.x, first.y - second.y),
          camera: { ...camera.current },
          centre: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
        };
        drag = null;
        return;
      }
      drag = { ...point, camera: { ...camera.current }, moved: false };
    };
    const move = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      const point = local(event);
      pointers.set(event.pointerId, point);
      if (pinch && pointers.size === 2) {
        const [first, second] = [...pointers.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        const factor =
          Math.hypot(first.x - second.x, first.y - second.y) / pinch.distance;
        camera.current = zoomAt(pinch.camera, pinch.centre, factor);
        flight.current = null;
        userMoved.current = true;
        return;
      }
      if (!drag || !full()) return;
      const dx = point.x - drag.x;
      const dy = point.y - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) {
        camera.current = {
          ...drag.camera,
          x: drag.camera.x + dx,
          y: drag.camera.y + dy,
        };
        flight.current = null;
        userMoved.current = true;
        canvas.dataset.dragging = "true";
      }
    };
    // A double click or double tap flies in to the system under it; on empty
    // space, or on the system already in view, back out to the whole map.
    // In the full view a single click on empty space also goes back to the
    // whole map, after a pause to see whether it is half of a double click.
    let lastTap = { time: 0, x: 0, y: 0 };
    let pendingTap: number | undefined;
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      delete canvas.dataset.dragging;
      if (pointers.size < 2) pinch = null;
      if (drag && !drag.moved && event.type === "pointerup") {
        const point = local(event);
        const now = performance.now();
        const isDouble =
          now - lastTap.time < doubleTapMilliseconds &&
          Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < 30;
        lastTap = isDouble ? { time: 0, x: 0, y: 0 } : { time: now, ...point };
        const selected = hitTest(hits.current, point.x, point.y)?.id ?? null;
        if (isDouble) {
          window.clearTimeout(pendingTap);
          const system = systemAt(point.x, point.y);
          if (!full()) {
            if (system) live.current.onOpenSystem?.(system);
            else live.current.onSelect(null);
          } else if (system && system !== zoomedSystem.current)
            flyToSystem(system);
          else flyToGalaxy();
        } else if (full() && selected) {
          live.current.onSelect(selected);
        } else if (full()) {
          pendingTap = window.setTimeout(() => {
            flyToGalaxy();
            live.current.onSelect(null);
          }, doubleTapMilliseconds);
        } else {
          // In compact detail a tap opens the full view, so wait a moment to
          // see whether it is the first half of a double tap.
          pendingTap = window.setTimeout(
            () => live.current.onSelect(selected),
            doubleTapMilliseconds,
          );
        }
      }
      drag = null;
    };
    const wheel = (event: WheelEvent) => {
      if (!full()) return;
      event.preventDefault();
      const mouseWheel =
        event.deltaMode !== 0 ||
        (event.deltaX === 0 && Math.abs(event.deltaY) >= 50);
      if (event.ctrlKey || mouseWheel) {
        const factor = Math.exp(
          -event.deltaY * (event.ctrlKey ? 0.01 : 0.0016),
        );
        camera.current = zoomAt(camera.current, local(event), factor);
        camera.current.scale = clampScale(camera.current.scale);
      } else {
        camera.current = {
          ...camera.current,
          x: camera.current.x - event.deltaX,
          y: camera.current.y - event.deltaY,
        };
      }
      flight.current = null;
      userMoved.current = true;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="atlas-canvas"
      data-detail={props.detail}
      role="img"
      aria-label={props.label}
    />
  );
}
