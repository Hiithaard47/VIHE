import { ReportCardSelection } from "./report-card-selection";

type Student = { id: string; name: string; rollNumber: string };

export function ReportCardSelectionWrapper({
  students,
  courseId,
}: {
  students: Student[];
  courseId: string;
}) {
  return <ReportCardSelection students={students} courseId={courseId} />;
}