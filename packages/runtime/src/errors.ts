/** Runtime rejections, in one shape whatever the host rejected with. */
import { ERROR_CODES, type RuntimeError, type ErrorCode } from "./types";

const KNOWN = new Set<string>(ERROR_CODES);

/** Turns anything a runtime call rejected with into a `RuntimeError`. */
export function toRuntimeError(error: unknown): RuntimeError {
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    const text = typeof message === "string" && message ? message : undefined;
    const known = typeof code === "string" && KNOWN.has(code);
    return {
      code: known ? (code as ErrorCode) : "upstream_error",
      ...(text ? { message: text } : {}),
    };
  }
  return {
    code: "upstream_error",
    ...(typeof error === "string" && error ? { message: error } : {}),
  };
}
