import { SessionDetailView } from "@/modules/sessions/ui/session-detail-view";

export default async function AdminSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <SessionDetailView sessionId={sessionId} portal="admin" />;
}
