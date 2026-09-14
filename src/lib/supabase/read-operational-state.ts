import type { SupabaseClient } from "@supabase/supabase-js";

type OperationalRecord = {
  entity_type: string;
  entity_id: string;
  payload: unknown;
  record_version: number;
  updated_at: string;
};

// Smaller than the default Data API cap. Advance by the actual response size
// so a lower server cap cannot silently truncate the snapshot.
const PAGE_SIZE = 500;

export async function readOperationalState(service: SupabaseClient, organizationId: string) {
  const readRevision = async () => {
    const { data, error } = await service.from("operational_state_versions")
      .select("version,updated_at").eq("organization_id", organizationId).maybeSingle();
    if (error) throw error;
    return data as { version: number; updated_at: string } | null;
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await readRevision();
    const records: OperationalRecord[] = [];
    let total: number | null = null;
    do {
      const { data, error, count } = await service.from("operational_records")
        .select("entity_type,entity_id,payload,record_version,updated_at", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("entity_type").order("entity_id")
        .range(records.length, records.length + PAGE_SIZE - 1);
      if (error) throw error;
      if (count === null) throw new Error("Nie udało się potwierdzić kompletności danych.");
      total = count;
      if (!data?.length) break;
      records.push(...data as OperationalRecord[]);
    } while (records.length < total);
    const after = await readRevision();
    if (before?.version === after?.version && before?.updated_at === after?.updated_at
      && records.length === total) {
      return { records, revision: after };
    }
  }
  throw new Error("Dane zmieniły się podczas pobierania. Spróbuj ponownie.");
}
