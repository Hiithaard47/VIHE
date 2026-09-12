# Session resources by category

Admin can turn session file upload/list on or off per institution-wide category. Example: Class keeps notes; Mangla Aarti has no Resources block on the session page.

## Data

- `SessionCategory.allowsResources` Boolean, default `true`
- Existing rows (including Class) stay on
- New categories default on; Admin unchecks for temple programs
- Turning the flag off does not delete files

## Admin

- Permission: `courses.manage` (existing category screens)
- Add + edit: checkbox **Allow session files** — “Show upload and file list on sessions of this category.”
- List: Files / No files column

## Session page

- `allowsResources` true: Resources block unchanged (upload + list)
- `allowsResources` false: hide the whole Resources block (heading, upload, list)
- Attendance unchanged
- Teacher Uploads and student Documents still list any files already on that session
- `uploadSessionResource` rejects when the session’s category has the flag off (error flash)
- Delete from Uploads still works

## Tests

- Unit: helper/action refuses upload when `allowsResources` is false
- e2e: Admin creates a category with the box unchecked, opens a session of that category — no Resources heading or upload. Class session still has both
- Existing Class resource e2e stays as-is

## Out of scope

- Hiding leftover files on Uploads / Documents
- Deleting files when the flag is turned off
- Per-course overrides
- Hard-coded category names
