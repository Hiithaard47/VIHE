import { deleteSessionResource } from "@/app/sessions/actions";
import { UploadSessionResourceDialog } from "@/components/upload-session-resource-dialog";
import { sessionHref, type CoursePortal } from "@/lib/course-workspace";

export function SessionResources({
  sessionId,
  resources,
  canManage,
  portal = "teacher",
}: {
  sessionId: string;
  resources: { id: string; fileName: string; contentType: string; sizeBytes: number }[];
  canManage: boolean;
  portal?: CoursePortal;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Resources</h2>
        {canManage && <UploadSessionResourceDialog sessionId={sessionId} portal={portal} />}
      </div>

      {resources.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline bg-card px-4 py-6 text-sm text-muted">
          {canManage ? "No files yet. Upload a PDF or image for this session." : "No files uploaded yet."}
        </p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-card">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className="flex flex-col gap-2 px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <a href={`/resources/${resource.id}`} className="font-medium hover:text-accent-dark break-all">
                  {resource.fileName}
                </a>
                <p className="text-xs text-muted">
                  {resource.contentType} · {formatSize(resource.sizeBytes)}
                </p>
              </div>
              {canManage && (
                <form action={deleteSessionResource.bind(null, sessionId, resource.id, portal)} className="shrink-0">
                  <input type="hidden" name="returnTo" value={sessionHref(portal, sessionId)} />
                  <button type="submit" className="text-xs text-muted underline hover:text-ink">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
