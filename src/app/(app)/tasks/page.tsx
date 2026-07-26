import { TasksView } from "@/components/views/tasks-view";
import { getCurrentAppIdentity } from "@/lib/auth/current-identity";

export default async function TasksPage() {
  const identity = await getCurrentAppIdentity();
  return <TasksView identity={identity} />;
}
