import { hashPassword, passwordMatches, validateNewPassword } from "@/lib/password";
import * as db from "../db/repository";

export type AccountErrorCode = "VALIDATION" | "FORBIDDEN" | "WRONG_PASSWORD";

export class AccountError extends Error {
  readonly code: AccountErrorCode;
  constructor(message: string, code: AccountErrorCode) {
    super(message);
    this.name = "AccountError";
    this.code = code;
  }
}

export function isAccountError(error: unknown): error is AccountError {
  return error instanceof AccountError;
}

export async function changeUserPassword(input: {
  userId: string;
  current: string;
  password: string;
  confirm: string;
}): Promise<void> {
  const invalid = validateNewPassword(input.password, input.confirm);
  if (invalid) throw new AccountError(invalid, "VALIDATION");
  const record = await db.findUserCredentials(input.userId);
  if (!record?.isActive || !record.passwordHash) {
    throw new AccountError("You cannot change this password.", "FORBIDDEN");
  }
  if (!(await passwordMatches(input.current, record.passwordHash))) {
    throw new AccountError("Current password is incorrect.", "WRONG_PASSWORD");
  }
  const passwordHash = await hashPassword(input.password);
  await db.updateUserPasswordHash(input.userId, passwordHash);
}

export async function changeStudentPassword(input: {
  studentId: string;
  current: string;
  password: string;
  confirm: string;
}): Promise<void> {
  const invalid = validateNewPassword(input.password, input.confirm);
  if (invalid) throw new AccountError(invalid, "VALIDATION");
  const record = await db.findStudentCredentials(input.studentId);
  if (!record?.isActive || !record.passwordHash) {
    throw new AccountError("You cannot change this password.", "FORBIDDEN");
  }
  if (!(await passwordMatches(input.current, record.passwordHash))) {
    throw new AccountError("Current password is incorrect.", "WRONG_PASSWORD");
  }
  const passwordHash = await hashPassword(input.password);
  await db.updateStudentPasswordHash(input.studentId, passwordHash);
}
