// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SourceSyncBadge } from "./source-sync-badge";
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("marks the feed stale while the page remains open without a new data revision", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T10:00:00Z"));
  render(<SourceSyncBadge source={{ id: "feed", platform: "Booking", connectionType: "iCal", status: "Aktywne", coverage: 100, notes: "", priority: "Teraz", nextStep: "", lastSyncAt: "2026-09-14T10:00:00Z", staleAfterMinutes: 1 }}/>);
  expect(screen.queryByText("Aktywne")).not.toBeNull();
  act(() => vi.advanceTimersByTime(120_000));
  expect(screen.queryByText("Wymaga świeżej synchronizacji")).not.toBeNull();
});
