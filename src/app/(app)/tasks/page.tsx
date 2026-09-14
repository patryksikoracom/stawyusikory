import { TasksView } from "@/components/views/tasks-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  const identity = await requirePageAccess("/tasks");
  const { issue } = await searchParams;
  return <TasksView identity={identity} initialIssueId={issue} />;
}
