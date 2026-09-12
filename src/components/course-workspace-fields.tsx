export function BatchField({ batches }: { batches: { id: string; name: string }[] }) {
  if (batches.length === 0) return null;
  if (batches.length === 1) {
    return <input type="hidden" name="batchId" value={batches[0].id} />;
  }

  return (
    <label className="flex flex-col gap-1 text-sm text-ink">
      Batch
      <select name="batchId" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink">
        {batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.name}
          </option>
        ))}
      </select>
    </label>
  );
}
