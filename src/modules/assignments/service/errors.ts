export type AssignmentErrorCode =
  | "not_found"
  | "no_submission"
  | "forbidden"
  | "validation"
  | "not_enrolled"
  | "inactive"
  | "past_due"
  | "storage";

export class AssignmentError extends Error {
  readonly code: AssignmentErrorCode;

  constructor(message: string, code: AssignmentErrorCode = "validation") {
    super(message);
    this.name = "AssignmentError";
    this.code = code;
  }
}

export function isAssignmentError(error: unknown): error is AssignmentError {
  return error instanceof AssignmentError;
}
