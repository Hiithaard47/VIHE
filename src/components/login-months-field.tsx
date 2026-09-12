export function LoginMonthsField({ value }: { value: number | null }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink">
      Student login length
      <select
        name="loginMonths"
        defaultValue={value ?? ""}
        className="w-fit rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
      >
        <option value="">From course code</option>
        <option value="6">6 months (BSA / BPV)</option>
        <option value="12">1 year (BS)</option>
        <option value="48">4 years (BV / BVA)</option>
      </select>
      <span className="text-xs text-muted">
        First enrollment sets a student&apos;s login expiry from this, unless an admin already set one.
      </span>
    </label>
  );
}
