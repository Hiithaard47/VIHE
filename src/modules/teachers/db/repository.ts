import { prisma } from "@/lib/prisma";

export async function findUserActive(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
}

export async function createUserRecord(data: {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  roleIds: string[];
}) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      roles: { create: data.roleIds.map((roleId) => ({ roleId })) },
    },
  });
}

export async function updateUserRecord(
  userId: string,
  data: { name: string; email: string; phone: string | null },
) {
  return prisma.user.update({ where: { id: userId }, data });
}

export async function updateUserPasswordHash(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function replaceUserRoles(userId: string, roleIds: string[]) {
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
  ]);
}

export async function toggleUserActiveRecord(userId: string, isActive: boolean) {
  return prisma.user.update({ where: { id: userId }, data: { isActive } });
}
