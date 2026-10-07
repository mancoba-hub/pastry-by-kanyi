/**
 * A tiny discriminated-union Result type.
 *
 * Domain services return `Result` for *expected* failures (validation, business
 * rules, not-found) so callers must handle them. Exceptions stay reserved for
 * genuinely exceptional conditions (dropped connections, invariant violations).
 */
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/** Unwraps a Result, throwing on error. Use only when failure is unreachable. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Unwrap failed: ${String(result.error)}`);
}

/** Collects many Results into one, accumulating all errors. */
export function collect<T, E>(results: Result<T, E>[]): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (result.ok) values.push(result.value);
    else errors.push(result.error);
  }

  return errors.length > 0 ? err(errors) : ok(values);
}

/**
 * Structured failure returned by every service boundary, so UI layers can map
 * messages onto individual form fields.
 */
export type FieldErrors = Record<string, string[]>;

export type FailureCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL";

export type Failure = {
  code: FailureCode;
  message: string;
  fields?: FieldErrors;
};

/** Builds a `Failure` value (for use inside a larger error payload). */
export const failureValue = (
  code: FailureCode,
  message: string,
  fields?: FieldErrors,
): Failure => ({ code, message, ...(fields ? { fields } : {}) });

/**
 * Builds a failed `Result`. Named to read well at the call site:
 * `return failure("CONFLICT", "…")`.
 */
export function failure(code: FailureCode, message: string, fields?: FieldErrors): Err<Failure> {
  return err(failureValue(code, message, fields));
}

/** Converts a Zod error into field-keyed messages for forms. */
export function zodToFieldErrors(error: {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}): FieldErrors {
  const fields: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    (fields[key] ??= []).push(issue.message);
  }

  return fields;
}
