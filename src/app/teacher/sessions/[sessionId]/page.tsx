import { SessionDetailView } from "@/modules/sessions/ui/session-detail-view";

export default async function SessionAttendancePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <SessionDetailView sessionId={sessionId} portal="teacher" />;
}
