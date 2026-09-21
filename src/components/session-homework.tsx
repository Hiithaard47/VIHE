import { UploadFileInput, UploadSubmitButton } from "@/components/upload-submit-button";
import { AssignSessionHomeworkDialog } from "@/components/assign-session-homework-dialog";
import { removeSessionHomework, submitSessionHomework } from "@/app/sessions/homework-actions";
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Homework</h2>
        {!homework && canManage && <AssignSessionHomeworkDialog sessionId={sessionId} portal={portal} />}
      </div>

      {!homework && (
        <p className="rounded-lg border border-dashed border-hairline bg-card px-4 py-6 text-sm text-muted">
          {canManage
            ? "No homework for this session yet. Assign one when you want students to upload work."
            : "No homework for this session."}
        </p>
      )}

      {homework && (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-ink">{homework.title}</p>
              {homework.instructions && <p className="mt-1 text-sm text-ink">{homework.instructions}</p>}
              <p className="mt-1 text-xs text-muted">
                {homework.submissions.length}/{students.length} submitted · not graded
              </p>
            </div>
            {canManage && (
              <form action={removeSessionHomework.bind(null, sessionId, portal)} className="shrink-0">
                <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                  Remove
                </button>
              </form>
            )}
          </div>

          <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
            {students.map((student) => {
              const submission = submissionByStudent.get(student.id);
              return (
                <li key={student.id} className="flex flex-col gap-2 px-3 py-3 text-sm text-ink sm:flex-row sm:justify-between">
                  <div>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted">{student.rollNumber}</p>
                    <p className="mt-1 text-xs text-muted">
                      {submission ? `Submitted ${formatDisplayDate(submission.submittedAt)}` : "Not submitted"}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    {submission && submission.files.length > 0 ? (
                      <ul className="flex flex-col gap-1">
                        {submission.files.map((file) => (
                          <li key={file.id}>
                            <a
                              href={`/homework/submission-files/${file.id}`}
                              className="break-all hover:text-accent-dark"
                            >
                              {file.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                </li>
              );
            })}
            {students.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted">No students enrolled in this course yet.</li>
            )}
          </ul>
        </div>
      )}
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
          <p className="mb-1">
            Your upload{submission.files.length === 1 ? "" : "s"} · {formatDisplayDate(submission.submittedAt)}
          </p>
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
