import type { OpsTask } from "@/lib/types";

export function cleaningSettlementSummary(tasks: OpsTask[]) {
  const completed = tasks.filter(task => task.type === "Sprzątanie" && task.status === "Zrobione");
  const unpaid = completed.filter(task => task.cleaningSettlement && !task.cleaningSettlement.paidAt);
  return {
    unpaidAmount: unpaid.reduce((sum, task) => sum + Math.round(task.cleaningSettlement!.amount * 100), 0) / 100,
    unpaidCount: unpaid.length,
    missingAmountCount: completed.filter(task => !task.cleaningSettlement).length,
  };
}
