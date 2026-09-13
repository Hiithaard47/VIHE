import { deleteSessionResource, uploadSessionResource } from "@/app/sessions/actions";
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
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Resources</h2>
      {canManage && (
        <form
          action={uploadSessionResource.bind(null, sessionId, portal)}
          className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            PDF or image
            <input
              name="file"
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
            />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Upload
          </button>
        </form>
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-4 py-2 font-medium">Size</th>
              {canManage && <th className="px-4 py-2 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => (
              <tr key={resource.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">
                  <a href={`/resources/${resource.id}`} className="font-medium hover:text-accent-dark">
                    {resource.fileName}
                  </a>
                  <p className="text-xs text-muted">{resource.contentType}</p>
                </td>
                <td className="px-4 py-3 text-muted">{formatSize(resource.sizeBytes)}</td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <form action={deleteSessionResource.bind(null, sessionId, resource.id, portal)}>
                      <input type="hidden" name="returnTo" value={sessionHref(portal, sessionId)} />
                      <button type="submit" className="text-xs text-muted underline hover:text-ink">
                        Remove
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {resources.length === 0 && (
              <tr>
                <td colSpan={canManage ? 3 : 2} className="px-4 py-3 text-sm text-muted">
                  No files uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
