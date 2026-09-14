"use client";

import { useEffect, useState } from "react";
import type { SourceConnection } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";

export function SourceSyncBadge({ source }: { source: SourceConnection }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const lastSync = source.lastSyncAt ? Date.parse(source.lastSyncAt) : NaN;
  const stale = source.connectionType === "iCal" && (!Number.isFinite(lastSync)
    || now - lastSync > (source.staleAfterMinutes ?? 240) * 60_000);
  return <Badge tone={source.status === "Aktywne" && !stale ? "good" : "warn"}>
    {stale && source.status === "Aktywne" ? "Wymaga świeżej synchronizacji" : source.status}
  </Badge>;
}
