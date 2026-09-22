import { z } from "zod";
import * as db from "../db/repository";

export type ApplyErrorCode = "validation" | "honeypot";

export class ApplyError extends Error {
  readonly code: ApplyErrorCode;
  constructor(message: string, code: ApplyErrorCode = "validation") {
    super(message);
    this.name = "ApplyError";
    this.code = code;
  }
}

export function isApplyError(error: unknown): error is ApplyError {
  return error instanceof ApplyError;
}

const applicationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().optional(),
  desiredCourseId: z.string().optional(),
  preferredMode: z.enum(["ONLINE", "HYBRID", "ON_SITE"]).optional(),
  preferredLanguage: z.enum(["ENGLISH", "HINDI"]).optional(),
  dateOfBirth: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  priorExperience: z.string().optional(),
});

export async function submitApplication(input: {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  desiredCourseId?: string;
  preferredMode?: string;
  preferredLanguage?: string;
  dateOfBirth?: string;
  country?: string;
  city?: string;
  priorExperience?: string;
  honeypot?: string;
}): Promise<void> {
  if (input.honeypot && input.honeypot.length > 0) {
    throw new ApplyError("bot", "honeypot");
  }

  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) throw new ApplyError(parsed.error.issues[0]?.message ?? "Invalid input", "validation");

  const { dateOfBirth, ...rest } = parsed.data;

  await db.createApplication({
    ...rest,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
  });
}
