export function displayUserName(user: { name?: string | null; email?: string | null }) {
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Account";
}

/** Prefer the live DB row over a stale session/JWT name. */
export function displayUserNameFromRecord(
  sessionUser: { name?: string | null; email?: string | null },
  record: { name?: string | null; email?: string | null } | null,
) {
  return displayUserName(record ?? sessionUser);
}

