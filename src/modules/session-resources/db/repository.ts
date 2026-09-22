import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function findSessionForUpload(sessionId: string) {
  return prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { subjectId: true, category: { select: { allowsResources: true } } },
  });
}

export async function createResourceRecord(data: {
  sessionId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedById: string;
}) {
  return prisma.sessionResource.create({ data });
}

export async function updateResourceStorageKey(resourceId: string, storageKey: string) {
  return prisma.sessionResource.update({ where: { id: resourceId }, data: { storageKey } });
}

export async function deleteResourceRecord(resourceId: string) {
  return prisma.sessionResource.delete({ where: { id: resourceId } }).catch(() => {});
}

export async function findResourceWithSession(resourceId: string) {
  return prisma.sessionResource.findUniqueOrThrow({
    where: { id: resourceId },
    include: { session: { select: { id: true, subjectId: true } } },
  });
}

export async function deleteResourceById(resourceId: string) {
  return prisma.sessionResource.delete({ where: { id: resourceId } });
}

export async function listCourseResources(sessionWhere: Prisma.ClassSessionWhereInput) {
  return prisma.sessionResource.findMany({
    where: { session: sessionWhere },
    include: { session: { select: { id: true, date: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
