import { prisma } from "@/lib/prisma";
import { isFutureSessionDate } from "@/lib/time";

export async function insertSession(input: {
  batchId: string;
  categoryId: string;
  date: Date;
  name: string;
  startMinute: number | null;
  endMinute: number | null;
  createdById: string;
  requireFuture?: boolean;
  requireTime?: boolean;
}): Promise<{ id: string } | { error: string }> {
  if (input.requireFuture && !isFutureSessionDate(input.date)) {
    return { error: "Cannot add a session on or before today." };
  }
  if (input.requireTime && (input.startMinute == null || input.endMinute == null)) {
    return { error: "Pick a valid start and end time." };
  }
  if (input.startMinute != null) {
    const clash = await prisma.classSession.findFirst({
      where: { batchId: input.batchId, date: input.date, startMinute: input.startMinute },
      select: { id: true },
    });
    if (clash) return { error: "That day already has a session at this time." };
  }

  const row = await prisma.classSession.create({
    data: {
      batchId: input.batchId,
      categoryId: input.categoryId,
      date: input.date,
      name: input.name,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      createdById: input.createdById,
    },
    select: { id: true },
  });
  return row;
}
