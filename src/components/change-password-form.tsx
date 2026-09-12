export function ChangePasswordForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
      <label className="flex flex-col gap-1 text-sm text-ink">
        Current password
        <input
          name="current"
          type="password"
          required
          className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        New password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Confirm new password
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
        />
      </label>
      <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
        Update password
      </button>
    </form>
  );
}
