import { prisma } from "@/lib/prisma";

export async function createCategory(data: {
  name: string;
  minAttendancePercent: number | null;
  allowsResources: boolean;
}) {
  return prisma.sessionCategory.create({ data });
}

export async function findCategoryById(categoryId: string) {
  return prisma.sessionCategory.findUnique({
    where: { id: categoryId },
    select: { isActive: true, isSystem: true },
  });
}

export async function updateCategory(
  categoryId: string,
  data: {
    name?: string;
    minAttendancePercent?: number | null;
    allowsResources?: boolean;
  },
) {
  return prisma.sessionCategory.update({ where: { id: categoryId }, data });
}

export async function toggleCategoryActive(categoryId: string, isActive: boolean) {
  return prisma.sessionCategory.update({ where: { id: categoryId }, data: { isActive } });
}

export async function findCategoryForToggle(categoryId: string) {
  return prisma.sessionCategory.findUnique({
    where: { id: categoryId },
    select: { name: true, isSystem: true, isActive: true },
  });
}
