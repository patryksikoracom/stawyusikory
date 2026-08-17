import { TasksView } from "@/components/views/tasks-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function TasksPage() {
  const identity = await requirePageAccess("/tasks");
  return <TasksView identity={identity} />;
}
