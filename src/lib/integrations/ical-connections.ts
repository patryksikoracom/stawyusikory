import type { SourceConnection, Unit } from "@/lib/types";

export const icalPlatforms = ["Booking", "Airbnb"] as const;

export type IcalPlatform = (typeof icalPlatforms)[number];

export function configuredIcalConnections(connections: SourceConnection[]) {
  return connections.filter((connection) => (
    connection.connectionType === "iCal"
    && Boolean(connection.unitId)
    && Boolean(connection.importUrl)
  ));
}

export function connectionForSlot(
  connections: SourceConnection[],
  platform: IcalPlatform,
  unitId: string,
) {
  return connections.find((connection) => (
    connection.connectionType === "iCal"
    && connection.platform === platform
    && connection.unitId === unitId
  ));
}

export function draftConnectionForSlot(
  connections: SourceConnection[],
  platform: IcalPlatform,
  unit: Pick<Unit, "id" | "name">,
): SourceConnection {
  const placeholder = connections.find((connection) => (
    connection.connectionType === "iCal"
    && connection.platform === platform
    && !connection.unitId
    && !connection.importUrl
  ));
  return {
    ...(placeholder ?? {
      id: `SRC-${platform.toUpperCase()}-${unit.id}`,
      platform,
      connectionType: "iCal" as const,
      notes: "iCal blokuje terminy, ale nie pobiera ceny, płatności ani danych gościa.",
      priority: "Teraz" as const,
      staleAfterMinutes: 240,
    }),
    unitId: unit.id,
    status: "Do podłączenia",
    coverage: 0,
    nextStep: `Wklej prywatny link ${platform} dla: ${unit.name}.`,
    lastError: undefined,
    lastSyncAt: undefined,
  };
}
