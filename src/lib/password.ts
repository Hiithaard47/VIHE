import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function passwordMatches(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
