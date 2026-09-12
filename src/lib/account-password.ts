import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";
import { hashPassword, passwordMatches, validateNewPassword } from "@/lib/password";

export function readPasswordChange(formData: FormData) {
  return {
    current: String(formData.get("current") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  };
}

export async function applyOwnPasswordChange(
  path: string,
  formData: FormData,
  record: { passwordHash: string | null; isActive: boolean } | null,
  save: (passwordHash: string) => Promise<void>,
) {
  const { current, password, confirm } = readPasswordChange(formData);
  const invalid = validateNewPassword(password, confirm);
  if (invalid) redirect(flashUrl(path, "error", invalid));
  if (!record?.isActive || !record.passwordHash) {
    redirect(flashUrl(path, "error", "You cannot change this password."));
  }
  if (!(await passwordMatches(current, record.passwordHash))) {
    redirect(flashUrl(path, "error", "Current password is incorrect."));
  }
  await save(await hashPassword(password));
}
