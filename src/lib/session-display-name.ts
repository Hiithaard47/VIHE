import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { displayUserNameFromRecord } from "@/lib/user-name";

/** Header/account label from the live User/Student row, not a stale JWT name. */
export async function sessionDisplayName(session: Session) {
  if (session.user.kind === "student") {
    const student = await prisma.student.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    return displayUserNameFromRecord(session.user, student);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  return displayUserNameFromRecord(session.user, user);
}

