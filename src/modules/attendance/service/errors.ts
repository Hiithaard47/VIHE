export class AttendanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceError";
  }
}

export function isAttendanceError(error: unknown): error is AttendanceError {
  return error instanceof AttendanceError;
}
