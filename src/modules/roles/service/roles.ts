import { isUniqueConstraintError } from "@/lib/flash";
import * as db from "../db/repository";

export type RoleErrorCode = "not_found" | "validation" | "duplicate" | "system";

export class RoleError extends Error {
  readonly code: RoleErrorCode;
  constructor(message: string, code: RoleErrorCode = "validation") {
    super(message);
    this.name = "RoleError";
    this.code = code;
  }
}

export function isRoleError(error: unknown): error is RoleError {
  return error instanceof RoleError;
}

export async function createRole(input: {
  name: string;
  description?: string;
}): Promise<{ id: string; name: string }> {
  if (!input.name.trim()) throw new RoleError("Name is required.", "validation");
  try {
    const role = await db.createRoleRecord({ name: input.name, description: input.description });
    return { id: role.id, name: input.name };
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new RoleError("A role with that name already exists.", "duplicate");
    throw err;
  }
}

export async function updateRoleDetails(input: {
  roleId: string;
  name: string;
  description?: string;
}): Promise<void> {
  if (!input.name.trim()) throw new RoleError("Name is required.", "validation");
  const role = await db.findRoleById(input.roleId);
  if (!role) throw new RoleError("Role not found.", "not_found");

  try {
    await db.updateRoleRecord(input.roleId, {
      name: role.isSystem ? undefined : input.name,
      description: input.description?.trim() || null,
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new RoleError("A role with that name already exists.", "duplicate");
    throw err;
  }
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  await db.replaceRolePermissions(roleId, permissionIds);
}

export async function deleteRole(roleId: string): Promise<{ name: string }> {
  const role = await db.findRoleForDeletion(roleId);
  if (role.isSystem) throw new RoleError("System roles cannot be deleted.", "system");
  await db.deleteRoleRecord(roleId);
  return { name: role.name };
}
