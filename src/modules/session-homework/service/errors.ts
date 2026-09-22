export type HomeworkErrorCode =
  | "not_found"
  | "forbidden"
  | "already_exists"
  | "validation"
  | "not_enrolled"
  | "inactive"
  | "wrong_day"
  | "storage";

export class HomeworkError extends Error {
  readonly code: HomeworkErrorCode;

  constructor(message: string, code: HomeworkErrorCode = "validation") {
    super(message);
    this.name = "HomeworkError";
    this.code = code;
  }
}

export function isHomeworkError(error: unknown): error is HomeworkError {
  return error instanceof HomeworkError;
}
