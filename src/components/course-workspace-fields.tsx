export function SubjectField({ subjects }: { subjects: { id: string; name: string }[] }) {
  if (subjects.length === 0) return null;
  if (subjects.length === 1) {
    return <input type="hidden" name="subjectId" value={subjects[0].id} />;
  }

  return (
    <label className="flex flex-col gap-1 text-sm text-ink">
      Subject
      <select name="subjectId" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink">
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>
    </label>
  );
}
