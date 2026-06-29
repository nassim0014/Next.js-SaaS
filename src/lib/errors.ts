/**
 * Typed application errors. Use these instead of throwing `new Error()`
 * so the API layer can map them to correct HTTP status codes.
 */

export type AppErrorType =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BUDGET_EXCEEDED"
  | "NO_SUBSCRIPTION"
  | "NO_ACTIVE_ORG"
  | "INTERNAL";

const STATUS_CODES: Record<AppErrorType, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  BUDGET_EXCEEDED: 402,
  NO_SUBSCRIPTION: 402,
  NO_ACTIVE_ORG: 400,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public readonly type: AppErrorType,
    message?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message ?? type);
    this.name = "AppError";
  }

  get statusCode(): number {
    return STATUS_CODES[this.type];
  }

  toJSON() {
    return {
      error: this.type,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

/**
 * Convert any thrown value to an AppError. Used in route handlers.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    // Check for known error messages
    if (err.message === "UNAUTHORIZED") return new AppError("UNAUTHORIZED");
    if (err.message.startsWith("FORBIDDEN")) return new AppError("FORBIDDEN", err.message);
    if (err.message === "NO_ACTIVE_ORG") return new AppError("NO_ACTIVE_ORG");
    if (err.message === "BUDGET_EXCEEDED") return new AppError("BUDGET_EXCEEDED");
    if (err.message === "NO_SUBSCRIPTION") return new AppError("NO_SUBSCRIPTION");
    return new AppError("INTERNAL", err.message);
  }
  return new AppError("INTERNAL", "An unknown error occurred");
}
