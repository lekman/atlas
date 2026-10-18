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
  focusOn,
  hitTest,
  interpolateCamera,
  paintScene,
  zoomAt,
  type Camera,
  type HitTarget,
  type Scene,
  type World,
} from "@atlas/worlds";
import { useEffect, useRef } from "react";

export interface WorldCanvasProps {
  scene: Scene;
  world: World;
  detail: "compact" | "full";
  selectedId: string | null;
  /** A tap: the record under the pointer, or null for empty space. */
  onSelect(id: string | null): void;
  /** Fly to this record when it changes. */
  focusId?: string | null;
  /** Called a few times a second while the camera moves, for the HUD. */
  onCameraChange?(camera: Camera): void;
  /** What a screen reader hears for the map as a whole. */
  label: string;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

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
  const size = useRef({ width: 0, height: 0, pixelRatio: 1 });

  const fit = (animate: boolean) => {
    const { width, height } = size.current;
    if (width === 0 || height === 0) return;
    const padding =
      live.current.detail === "full" ? (width < 760 ? 14 : 70) : 12;
    const target = fitCamera(
      live.current.scene.layout.bounds,
      width,
      height,
      padding,
    );
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
      const rectangle = canvas.getBoundingClientRect();
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
      if (!userMoved.current && !flight.current) fit(false);
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

  // Refit when the view changes between compact and full.
  useEffect(() => {
    userMoved.current = false;
    const timer = window.setTimeout(() => fit(true), 30);
    return () => window.clearTimeout(timer);
  }, [props.detail]);

  // Fly to a record when asked.
  useEffect(() => {
    const id = props.focusId;
    if (!id) return;
    const timer = window.setTimeout(() => {
      const target = hits.current.find((candidate) => candidate.id === id);
      if (!target) return;
      const { width, height } = size.current;
      const world = {
        x: (target.x - camera.current.x) / camera.current.scale,
        y: (target.y - camera.current.y) / camera.current.scale,
      };
      const scale = Math.max(camera.current.scale, 0.75);
      const offset =
        width > 760 ? { x: -150, y: 0 } : { x: 0, y: -height * 0.18 };
      userMoved.current = true;
      flight.current = {
        from: { ...camera.current },
        to: focusOn(world, scale, width, height, offset),
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
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      delete canvas.dataset.dragging;
      if (pointers.size < 2) pinch = null;
      if (drag && !drag.moved && event.type === "pointerup") {
        const point = local(event);
        live.current.onSelect(
          hitTest(hits.current, point.x, point.y)?.id ?? null,
        );
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
