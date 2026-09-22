import type { Prisma } from "@prisma/client";
import * as db from "../db/repository";

export async function getCourseResources(sessionWhere: Prisma.ClassSessionWhereInput) {
  return db.listCourseResources(sessionWhere);
}
