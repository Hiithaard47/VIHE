import { SessionDetailView } from "@/components/course-workspace/session-detail";

export default async function SessionAttendancePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <SessionDetailView sessionId={sessionId} portal="teacher" />;
}
