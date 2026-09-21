import { UploadFileInput, UploadSubmitButton } from "@/components/upload-submit-button";
import {
  assignSessionHomework,
  removeSessionHomework,
  submitSessionHomework,
} from "@/app/sessions/homework-actions";
import { formatDisplayDate } from "@/lib/time";
import type { CoursePortal } from "@/lib/course-workspace";

type HomeworkSubmission = {
  id: string;
  submittedAt: Date;
  student: { id: string; name: string; rollNumber: string };
  files: { id: string; fileName: string }[];
};

type Homework = {
  id: string;
  title: string;
  instructions: string | null;
  submissions: HomeworkSubmission[];
};

export function SessionHomeworkPanel({
  sessionId,
  homework,
  canManage,
  portal,
  students,
}: {
  sessionId: string;
  homework: Homework | null;
  canManage: boolean;
  portal: CoursePortal;
  students: { id: string; name: string; rollNumber: string }[];
}) {
  const submissionByStudent = new Map(homework?.submissions.map((item) => [item.student.id, item]) ?? []);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Homework</h2>
      {!homework && canManage && (
        <form
          action={assignSessionHomework.bind(null, sessionId, portal)}
          className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
        >
          <p className="text-xs text-muted">
            Students can upload work only on the session day. Homework is not graded.
          </p>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Title
            <input name="title" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Instructions (optional)
            <textarea name="instructions" rows={3} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Assign homework
          </button>
        </form>
      )}

      {homework && (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{homework.title}</p>
              {homework.instructions && <p className="mt-1 text-sm text-ink">{homework.instructions}</p>}
              <p className="mt-1 text-xs text-muted">
                {homework.submissions.length}/{students.length} submitted · not graded
              </p>
            </div>
            {canManage && (
              <form action={removeSessionHomework.bind(null, sessionId, portal)}>
                <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                  Remove
                </button>
              </form>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border border-hairline">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-canvas text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Work</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const submission = submissionByStudent.get(student.id);
                  return (
                    <tr key={student.id} className="border-b border-hairline text-ink last:border-0 align-top">
                      <td className="px-3 py-2">
                        <p>{student.name}</p>
                        <p className="text-xs text-muted">{student.rollNumber}</p>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {submission ? `Submitted ${formatDisplayDate(submission.submittedAt)}` : "Not submitted"}
                      </td>
                      <td className="px-3 py-2">
                        {submission && submission.files.length > 0 ? (
                          <ul className="flex flex-col gap-1">
                            {submission.files.map((file) => (
                              <li key={file.id}>
                                <a
                                  href={`/homework/submission-files/${file.id}`}
                                  className="hover:text-accent-dark"
                                >
                                  {file.fileName}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-sm text-muted">
                      No students enrolled in this course yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!homework && !canManage && <p className="text-sm text-muted">No homework for this session.</p>}
    </section>
  );
}

export function StudentSessionHomework({
  courseId,
  sessionId,
  homework,
  submission,
  canSubmit,
  courseActive,
}: {
  courseId: string;
  sessionId: string;
  homework: { title: string; instructions: string | null };
  submission: { files: { id: string; fileName: string }[]; submittedAt: Date } | null;
  canSubmit: boolean;
  courseActive: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Homework</h2>
      <div className="rounded-lg border border-hairline bg-card p-4">
        <p className="font-medium text-ink">{homework.title}</p>
        {homework.instructions && <p className="mt-1 text-sm text-ink">{homework.instructions}</p>}
        <p className="mt-1 text-xs text-muted">Not graded · submit on the session day</p>
      </div>

      {submission && (
        <div className="text-sm text-ink">
          <p className="mb-1">Your upload{submission.files.length === 1 ? "" : "s"} · {formatDisplayDate(submission.submittedAt)}</p>
          <ul className="flex flex-col gap-1">
            {submission.files.map((file) => (
              <li key={file.id}>
                <a href={`/homework/submission-files/${file.id}`} className="text-accent-dark hover:underline">
                  {file.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!courseActive && <p className="text-sm text-muted">This course is completed.</p>}
      {courseActive && !canSubmit && !submission && (
        <p className="text-sm text-muted">You can submit homework only on the session day.</p>
      )}
      {courseActive && !canSubmit && submission && (
        <p className="text-sm text-muted">Submitted. You can replace your upload only on the session day.</p>
      )}

      {canSubmit && (
        <form
          action={submitSessionHomework.bind(null, courseId, sessionId)}
          className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {submission ? "Replace your upload" : "Upload your work"}
          </h3>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Your files
            <UploadFileInput
              name="files"
              required
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            />
          </label>
          <UploadSubmitButton idleLabel={submission ? "Update homework" : "Submit homework"} />
        </form>
      )}
    </section>
  );
}
