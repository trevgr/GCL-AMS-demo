// app/sessions/[id]/page.tsx
// This is now a Server Component only - no "use client"

import SessionLoader from "./SessionLoader";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const sessionId = Number(id);

  return <SessionLoader sessionId={sessionId} />;
}
