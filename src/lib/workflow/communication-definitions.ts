import type { AppData } from "@/lib/types";
import { defaultAutomationRules, defaultMessageTemplates } from "./communications";

// Browser and sender must use the same versioned definitions for legacy records.
export function currentCommunicationDefinitions(data: Pick<AppData, "messageTemplates" | "automationRules"> & Partial<Pick<AppData, "communicationConfigs">>) {
  const storedTemplates = data.messageTemplates;
  const defaultTemplateById = new Map(defaultMessageTemplates.map((template) => [template.id, template]));
  const messageTemplates = [
    ...storedTemplates.map((template) => {
      const currentDefault = defaultTemplateById.get(template.id);
      return currentDefault && currentDefault.version > template.version
        ? { ...currentDefault, active: template.active }
        : template;
    }),
    ...defaultMessageTemplates.filter((template) => !storedTemplates.some((stored) => stored.id === template.id)),
  ];
  const storedRules = data.automationRules;
  const defaultRuleById = new Map(defaultAutomationRules.map((rule) => [rule.id, rule]));
  const automationRules = [
    ...storedRules.map((stored) => {
      const currentDefault = defaultRuleById.get(stored.id);
      return currentDefault && (currentDefault.definitionVersion ?? 0) > (stored.definitionVersion ?? 0)
        ? { ...currentDefault, active: stored.active }
        : stored;
    }),
    ...defaultAutomationRules.filter((rule) => !storedRules.some((stored) => stored.id === rule.id)),
  ];
  const config = data.communicationConfigs?.find(item => item.id === "communication") ?? data.communicationConfigs?.[0];
  return { messageTemplates: messageTemplates.map(template => {
    const override = config?.templateOverrides?.find(item => item.id === template.id);
    return override ? { ...template, ...override, version: Math.max(template.version, override.version) } : template;
  }), automationRules };
}
