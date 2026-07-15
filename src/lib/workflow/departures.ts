import type { Booking, DepartureDebrief, GuestProfile, IssueReport, OpsTask } from "../types";

export function departurePromptQueue(bookings: Booking[], debriefs: DepartureDebrief[], today: string, nowIso: string) {
  return bookings.filter((booking) => {
    if (booking.workflowStatus === "Anulowana" || booking.checkOut !== today) return false;
    const debrief = debriefs.find((item) => item.bookingId === booking.id);
    if (debrief?.status !== "Oczekuje") return false;
    if (debrief.snoozedUntil) return debrief.snoozedUntil <= nowIso;
    return (debrief.lastPromptedOn ?? debrief.lastPromptedAt?.slice(0, 10)) !== today;
  });
}

export function guestInsightAfterDeparture(profile: GuestProfile, debrief: DepartureDebrief): GuestProfile {
  return {
    ...profile,
    discoveryChannel: debrief.discoverySource ?? profile.discoveryChannel,
    discoveryMethod: debrief.discoveryMethod ?? profile.discoveryMethod,
    discoveryNote: debrief.discoveryNote ?? profile.discoveryNote,
    motivation: debrief.whyChose || profile.motivation,
    bestQuote: debrief.bestQuote || profile.bestQuote,
    objections: debrief.improvementNotes || profile.objections,
    nps: debrief.nps ?? profile.nps,
  };
}

export function repairTaskForIssue(issue: IssueReport, booking: Booking): OpsTask {
  return {
    id: `TASK-${issue.id}`,
    bookingId: booking.id,
    issueId: issue.id,
    type: "Naprawa",
    priority: issue.severity === "Krytyczna" || issue.severity === "Wysoka" ? "Wysoki" : issue.severity === "Niska" ? "Niski" : "Średni",
    status: "Do zrobienia",
    owner: issue.owner || "Patryk",
    unitId: booking.unitId,
    title: issue.title,
    planningHorizon: issue.planningHorizon ?? "Do oceny",
  };
}
