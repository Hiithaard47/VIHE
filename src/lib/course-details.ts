import { z } from "zod";
import { parseLoginMonthsInput } from "@/lib/student-login";

export const detailsSchema = z.object({
  name: z.string().trim().min(1, "Course name is required."),
  code: z.string().trim().min(1, "Course code is required."),
  description: z.string(),
  loginMonths: z.string().transform((value, ctx) => {
    const months = parseLoginMonthsInput(value);
    if (months === undefined) {
      ctx.addIssue({ code: "custom", message: "Pick a student login length." });
      return z.NEVER;
    }
    return months;
  }),
});

export function parseDetailsForm(formData: FormData) {
  return detailsSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") ?? "",
    loginMonths: String(formData.get("loginMonths") ?? ""),
  });
}
