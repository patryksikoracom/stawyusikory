import { redirect } from "next/navigation";
import { getCurrentAppIdentity } from "@/lib/auth/current-identity";
import { landingPathForRole } from "@/lib/auth/landing";

export default async function Home() {
  const identity = await getCurrentAppIdentity();
  redirect(landingPathForRole(identity.role));
}
