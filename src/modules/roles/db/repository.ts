import { prisma } from "@/lib/prisma";

export async function createRoleRecord(data: { name: string; description?: string }) {
  return prisma.role.create({ data });
}

export async function findRoleById(roleId: string) {
  return prisma.role.findUnique({ where: { id: roleId }, select: { id: true, isSystem: true } });
}

export async function updateRoleRecord(roleId: string, data: { name?: string; description?: string | null }) {
  return prisma.role.update({ where: { id: roleId }, data });
}

export async function replaceRolePermissions(roleId: string, permissionIds: string[]) {
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
  ]);
}

export async function findRoleForDeletion(roleId: string) {
  return prisma.role.findUniqueOrThrow({ where: { id: roleId } });
}

export async function deleteRoleRecord(roleId: string) {
  return prisma.role.delete({ where: { id: roleId } });
}
