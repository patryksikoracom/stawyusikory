import { MediaView } from "@/components/views/media-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function MediaPage() {
  await requirePageAccess("/media");
  return <MediaView />;
}
