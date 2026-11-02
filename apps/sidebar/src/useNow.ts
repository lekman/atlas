import { useEffect, useState } from "react";

/** The time, moved on every `every` milliseconds; fixed when `fixed` is given. */
export function useNow(fixed: Date | undefined, every = 30000): Date {
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => {
    if (fixed) return;
    const id = setInterval(() => setNow(new Date()), every);
    return () => clearInterval(id);
  }, [fixed, every]);
  return fixed ?? now;
}
