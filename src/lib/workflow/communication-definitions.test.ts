import { describe, expect, it } from "vitest";
import { currentCommunicationDefinitions } from "./communication-definitions";
import { defaultMessageTemplates, defaultAutomationRules } from "./communications";
import { recordBatchCommandSchema } from "@/lib/domain/record-batch-command";

const override = { id: "TPL-CONFIRM", name: "Moje potwierdzenie", subject: "Pobyt", body: "Witaj {{guest_first_name}}", active: false, version: 3 };
const config = { id: "communication", senderName: "Stawy", copyUserIds: [], travelGuides: [], templateOverrides: [override] };

describe("saved template edits", () => {
  it("applies edits over legacy and current defaults without changing language, channel or purpose", () => {
    const data = { messageTemplates: defaultMessageTemplates.map(template => ({ ...template, version: 1 })), automationRules: defaultAutomationRules, communicationConfigs: [config] };
    const current = currentCommunicationDefinitions(data);
    expect(current.messageTemplates.find(template => template.id === override.id)).toMatchObject({ ...override, language: "pl", channel: "E-mail", purpose: "Potwierdzenie" });
    expect(current.messageTemplates.find(template => template.id === "TPL-CONFIRM-DE")?.body).not.toBe(override.body);
    expect(currentCommunicationDefinitions({ ...data, ...current })).toEqual(current);
  });
  it("persists template revisions within the existing versioned configuration command", () => {
    const parsed = recordBatchCommandSchema.parse({ requestId: "template-edit-123", clientSentAt: "2026-09-30T15:00:00Z", tabId: "tab-template-123", changes: [{ entityType: "communicationConfigs", entityId: "communication", operation: "upsert", expectedRecordVersion: 8, payload: config }] });
    expect(parsed.changes[0].payload).toMatchObject({ templateOverrides: [override] });
    expect(parsed.changes[0].expectedRecordVersion).toBe(8);
  });
});
