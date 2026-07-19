import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCleaningDashboard } from "@/lib/cleaning/dashboard";
import { requireOrganization } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), taskId: z.string().min(1).max(160) }),
  z.object({ action: z.literal("complete"), taskId: z.string().min(1).max(160) }),
  z.object({ action: z.literal("checklist"), taskId: z.string().min(1).max(160), itemId: z.string().min(1).max(200), done: z.boolean() }),
  z.object({
    action: z.literal("report"),
    taskId: z.string().min(1).max(160),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    category: z.enum(["Bezpieczeństwo", "Dostęp/drzwi", "Woda", "Prąd", "Wyposażenie", "Komfort", "Inne"]).default("Inne"),
  }),
]);

function forbidden() {
  return NextResponse.json({ error: "Ten endpoint jest dostępny wyłącznie dla konta sprzątania." }, { status: 403 });
}

export async function GET() {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (context.role !== "cleaning") return forbidden();
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Panel sprzątania nie jest skonfigurowany." }, { status: 503 });

  const { data, error } = await service
    .from("operational_records")
    .select("entity_type,entity_id,payload")
    .eq("organization_id", context.organizationId)
    .in("entity_type", ["units", "bookings", "tasks", "checklistItems", "departureDebriefs", "settings"]);
  if (error) return NextResponse.json({ error: "Nie udało się pobrać planu sprzątania." }, { status: 500 });

  return NextResponse.json(buildCleaningDashboard(data ?? []), {
    headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}

export async function PATCH(request: Request) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (context.role !== "cleaning") return forbidden();
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowa zmiana zadania." }, { status: 400 });

  const payload = parsed.data;
  const details = payload.action === "checklist"
    ? { done: payload.done }
    : payload.action === "report"
      ? { title: payload.title, description: payload.description ?? "", category: payload.category }
      : {};
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Panel sprzątania nie jest skonfigurowany." }, { status: 503 });
  const { data, error } = await service.rpc("mutate_cleaning_task", {
    p_actor: context.user.id,
    p_task_id: payload.taskId,
    p_action: payload.action,
    p_item_id: payload.action === "checklist" ? payload.itemId : null,
    p_details: details,
  });
  if (error) {
    const safeMessage = error.message.includes("checklist")
      ? "Najpierw zaznacz wszystkie punkty checklisty."
      : error.message.includes("status")
        ? "Status zadania zmienił się. Odśwież widok."
        : "Nie udało się zapisać zmiany.";
    return NextResponse.json({ error: safeMessage }, { status: error.code === "42501" ? 403 : 409 });
  }
  return NextResponse.json({ ok: true, version: Number(data) });
}
