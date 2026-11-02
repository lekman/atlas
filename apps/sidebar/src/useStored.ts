import type { Runtime } from "@atlas/runtime";
import { useEffect, useState } from "react";

/**
 * A stored document, followed. `undefined` until the store answers, null
 * when the document is missing or `read` refuses it.
 */
export function useStored<T>(
  runtime: Runtime,
  path: string,
  read: (value: unknown) => T | null,
): T | null | undefined {
  const [doc, setDoc] = useState<T | null | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `read` is fixed per call site.
  useEffect(
    () =>
      runtime.subscribe(
        path,
        (value) => setDoc(value === undefined ? null : read(value)),
        () => setDoc(null),
      ),
    [runtime, path],
  );
  return doc;
}
