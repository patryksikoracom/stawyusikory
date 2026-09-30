import { MessagesView } from "@/components/views/messages-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function MessagesPage() {
  const identity = await requirePageAccess("/messages");
  return <MessagesView canEdit={identity.role === "owner" || identity.role === "admin"} />;
}
