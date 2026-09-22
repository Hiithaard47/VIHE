import { isForeignKeyError, isUniqueConstraintError } from "@/lib/flash";
import { hashPassword, validateNewPassword } from "@/lib/password";
import * as db from "../db/repository";

export type TeacherErrorCode = "not_found" | "validation" | "duplicate" | "archived" | "self" | "invalid_role";

export class TeacherError extends Error {
  readonly code: TeacherErrorCode;
  constructor(message: string, code: TeacherErrorCode = "validation") {
    super(message);
    this.name = "TeacherError";
    this.code = code;
  }
}

export function isTeacherError(error: unknown): error is TeacherError {
  return error instanceof TeacherError;
}

export async function requireActiveUser(userId: string): Promise<void> {
  const user = await db.findUserActive(userId);
  if (!user) throw new TeacherError("User not found.", "not_found");
  if (!user.isActive) throw new TeacherError("This teacher is archived. Restore to make changes.", "archived");
}

export async function createUser(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  roleIds: string[];
}): Promise<{ name: string }> {
  const passwordHash = await hashPassword(input.password);

  try {
    await db.createUserRecord({
      name: input.name,
      email: input.email,
      phone: input.phone?.trim() || null,
      passwordHash,
      roleIds: input.roleIds,
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new TeacherError("A user with that email already exists.", "duplicate");
    if (isForeignKeyError(err)) throw new TeacherError("Pick valid roles.", "invalid_role");
    throw err;
  }
  return { name: input.name };
}

export async function updateUserDetails(input: {
  userId: string;
  name: string;
  email: string;
  phone?: string;
}): Promise<void> {
  await requireActiveUser(input.userId);

  try {
    await db.updateUserRecord(input.userId, {
      name: input.name,
      email: input.email,
      phone: input.phone?.trim() || null,
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new TeacherError("A user with that email already exists.", "duplicate");
    throw err;
  }
}

export async function resetUserPassword(input: {
  userId: string;
  password: string;
  confirm: string;
}): Promise<void> {
  await requireActiveUser(input.userId);
  const invalid = validateNewPassword(input.password, input.confirm);
  if (invalid) throw new TeacherError(invalid, "validation");
  await db.updateUserPasswordHash(input.userId, await hashPassword(input.password));
}

export async function updateUserRoles(userId: string, roleIds: string[]): Promise<void> {
  await requireActiveUser(userId);
  try {
    await db.replaceUserRoles(userId, roleIds);
  } catch (err) {
    if (isForeignKeyError(err)) throw new TeacherError("Pick valid roles.", "invalid_role");
    throw err;
  }
}

export async function toggleUserActive(input: {
  userId: string;
  nextActive: boolean;
  actorId: string;
}): Promise<void> {
  if (input.actorId === input.userId) {
    throw new TeacherError("You cannot archive your own account.", "self");
  }
  await db.toggleUserActiveRecord(input.userId, input.nextActive);
}
