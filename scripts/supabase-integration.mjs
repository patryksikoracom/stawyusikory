import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const env = { ...process.env };
  if (!fs.existsSync(".env.local")) return env;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = loadLocalEnv();
if (env.RUN_SUPABASE_INTEGRATION !== "1" || env.SUPABASE_INTEGRATION_TEST_PROJECT !== "1") {
  console.log("Supabase integration test skipped. Run only against a dedicated test project with RUN_SUPABASE_INTEGRATION=1 and SUPABASE_INTEGRATION_TEST_PROJECT=1.");
  process.exit(0);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anonKey && serviceKey, "Missing Supabase integration test configuration.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = crypto.randomUUID();
const email = `stawy-e2e-${suffix}@example.invalid`;
const password = `T-${crypto.randomBytes(20).toString("base64url")}!`;
const ownOrg = crypto.randomUUID();
const otherOrg = crypto.randomUUID();
let userId;

try {
  console.log("Integration: creating isolated user and organizations…");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const organizations = await admin.from("organizations").insert([
    { id: ownOrg, name: "Stawy OS integration test" },
    { id: otherOrg, name: "Stawy OS isolated test" },
  ]);
  if (organizations.error) throw organizations.error;
  const membership = await admin.from("organization_memberships").insert({ organization_id: ownOrg, user_id: userId, role: "owner" });
  if (membership.error) throw membership.error;

  const login = await userClient.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  console.log("Integration: authenticated; checking RLS isolation…");

  const visibleOrganizations = await userClient.from("organizations").select("id");
  if (visibleOrganizations.error) throw visibleOrganizations.error;
  assert(visibleOrganizations.data.length === 1 && visibleOrganizations.data[0].id === ownOrg, "RLS organization isolation failed.");

  const state = {
    units: [{ id: "test-unit", name: "Test", maxPeople: 2, bedrooms: 1, defaultCleaningCost: 0, notes: "" }],
    bookings: [], guests: [], consents: [],
    tasks: Array.from({ length: 100 }, (_, index) => ({
      id: `test-task-${index}`,
      bookingId: `test-booking-${index}`,
      type: "Sprzątanie",
      priority: "Średni",
      status: "Do zrobienia",
      owner: "Integration",
      title: `Task ${index}`,
    })),
    media: [],
    blocks: [{
      id: "test-block",
      unitId: "test-unit",
      dateFrom: "2099-10-10",
      dateTo: "2099-10-12",
      blockType: "Serwis",
      reason: "Testowa blokada serwisowa",
      status: "Aktywna",
    }],
    rates: [], imports: [],
    sourceConnections: [], payments: [], invoices: [],
    checklistItems: Array.from({ length: 100 }, (_, index) => ({
      id: `test-check-${index}`,
      taskId: `test-task-${index}`,
      label: `Checklist ${index}`,
      done: false,
    })),
    issues: [], messages: [], auditLog: [],
    settings: { organizationName: "Test", timezone: "Europe/Warsaw", cleaningContactName: "", cleaningPhone: "", defaultCheckIn: "16:00", defaultCheckOut: "11:00", aiApprovalRequired: true },
  };
  const firstRequestId = crypto.randomUUID();
  const firstCommit = await userClient.rpc("replace_operational_state_v2", {
    p_expected_version: 0,
    p_state: state,
    p_request_id: firstRequestId,
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: "integration-session-a",
  });
  if (firstCommit.error) throw firstCommit.error;
  assert(Number(firstCommit.data) === 1, "Initial state version was not created.");

  const staleRequestId = crypto.randomUUID();
  const staleCommit = await userClient.rpc("replace_operational_state_v2", {
    p_expected_version: 0,
    p_state: state,
    p_request_id: staleRequestId,
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: "integration-session-b",
  });
  console.log("Integration: stale-write result", { code: staleCommit.error?.code ?? null, returnedVersion: staleCommit.data ?? null });
  assert(!staleCommit.error && Number(staleCommit.data) < 0, "Stale write was not rejected without raising a database error.");

  console.log("Integration: running 100 parallel record-level task updates…");
  const taskCommits = await Promise.all(state.tasks.map((task, index) => userClient.rpc("update_operational_task", {
    p_organization_id: ownOrg,
    p_task_id: task.id,
    p_expected_record_version: 1,
    p_task: { ...task, status: "W toku" },
    p_request_id: crypto.randomUUID(),
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: `integration-task-${index}`,
  })));
  for (const [index, commit] of taskCommits.entries()) {
    if (commit.error) throw commit.error;
    assert(commit.data?.status === "committed", `Parallel task ${index} was not committed.`);
    assert(Number(commit.data?.recordVersion) === 2, `Parallel task ${index} received the wrong record version.`);
  }

  const sameTaskConflict = await userClient.rpc("update_operational_task", {
    p_organization_id: ownOrg,
    p_task_id: state.tasks[0].id,
    p_expected_record_version: 1,
    p_task: { ...state.tasks[0], status: "Zrobione" },
    p_request_id: crypto.randomUUID(),
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: "integration-task-conflict",
  });
  if (sameTaskConflict.error) throw sameTaskConflict.error;
  assert(sameTaskConflict.data?.status === "conflict", "A stale update of the same task was not rejected.");
  assert(Number(sameTaskConflict.data?.recordVersion) === 2, "The task conflict did not return the current record version.");

  console.log("Integration: running 100 parallel record-level checklist updates…");
  const checklistCommits = await Promise.all(state.checklistItems.map((item, index) => userClient.rpc("update_operational_checklist_item", {
    p_organization_id: ownOrg,
    p_item_id: item.id,
    p_expected_record_version: 1,
    p_item: { ...item, done: true },
    p_request_id: crypto.randomUUID(),
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: `integration-check-${index}`,
  })));
  for (const [index, commit] of checklistCommits.entries()) {
    if (commit.error) throw commit.error;
    assert(commit.data?.status === "committed", `Parallel checklist item ${index} was not committed.`);
    assert(Number(commit.data?.recordVersion) === 2, `Parallel checklist item ${index} received the wrong record version.`);
  }

  const sameChecklistConflict = await userClient.rpc("update_operational_checklist_item", {
    p_organization_id: ownOrg,
    p_item_id: state.checklistItems[0].id,
    p_expected_record_version: 1,
    p_item: { ...state.checklistItems[0], done: false },
    p_request_id: crypto.randomUUID(),
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: "integration-check-conflict",
  });
  if (sameChecklistConflict.error) throw sameChecklistConflict.error;
  assert(sameChecklistConflict.data?.status === "conflict", "A stale update of the same checklist item was not rejected.");
  assert(Number(sameChecklistConflict.data?.recordVersion) === 2, "The checklist conflict did not return the current record version.");

  function bookingAggregate(id, checkIn, checkOut, arrivalTime = "16:00", departureTime = "11:00") {
    const taskId = `${id}-clean`;
    return {
      booking: {
        id,
        bookingDate: "2099-07-25",
        source: "Integration",
        platform: "Bezpośrednio",
        unitId: "test-unit",
        checkIn,
        checkOut,
        arrivalTime,
        departureTime,
        adults: 2,
        children: 0,
        guestLabel: `Gość ${id}`,
        paymentStatus: "Do uzupełnienia",
        workflowStatus: "Nowa",
        createdBy: "Integration",
      },
      contact: {
        bookingId: id,
        email: `${id.toLowerCase()}@example.invalid`,
        marketingConsent: "Do dopytania",
        photoFbConsent: "Nie",
        photoSiteAdsConsent: "Nie",
      },
      tasks: [{
        id: taskId,
        bookingId: id,
        type: "Sprzątanie",
        priority: "Wysoki",
        status: "Do zrobienia",
        dueDate: checkOut,
        owner: "Integration",
        unitId: "test-unit",
        title: "Turnover testowy",
      }],
      checklistItems: [{
        id: `${taskId}-check`,
        taskId,
        label: "Test checklisty",
        done: false,
      }],
      scheduledMessages: [{
        id: `SCH-${id}`,
        bookingId: id,
        ruleId: "RULE-INTEGRATION",
        templateId: "TPL-INTEGRATION",
        templateVersion: 1,
        dueAt: `${checkIn}T10:00:00`,
        channel: "E-mail",
        recipient: `${id.toLowerCase()}@example.invalid`,
        subject: "Test",
        renderedBody: "Wiadomość testowa",
        status: "Wersja robocza",
        idempotencyKey: `scheduled-${id}`,
        bookingFingerprint: `${checkIn}|${checkOut}|${id}`,
        createdAt: new Date().toISOString(),
      }],
    };
  }

  function createBookingRpc(aggregate, requestId, tabId) {
    return userClient.rpc("create_operational_booking", {
      p_organization_id: ownOrg,
      p_booking_id: aggregate.booking.id,
      p_booking: aggregate.booking,
      p_contact: aggregate.contact,
      p_tasks: aggregate.tasks,
      p_checklist_items: aggregate.checklistItems,
      p_scheduled_messages: aggregate.scheduledMessages,
      p_request_id: requestId,
      p_client_sent_at: new Date().toISOString(),
      p_tab_id: tabId,
    });
  }

  console.log("Integration: checking atomic booking aggregate, replay, calendar conflicts and race protection…");
  const aggregate = bookingAggregate("BOOKING-AGGREGATE", "2099-08-10", "2099-08-13");
  const aggregateRequestId = crypto.randomUUID();
  const aggregateCommit = await createBookingRpc(aggregate, aggregateRequestId, "integration-booking-a");
  if (aggregateCommit.error) throw aggregateCommit.error;
  assert(aggregateCommit.data?.status === "committed", "Booking aggregate was not committed.");
  assert(aggregateCommit.data?.aggregate?.tasks?.length === 1, "Booking task was not returned.");
  assert(aggregateCommit.data?.aggregate?.checklistItems?.length === 1, "Booking checklist was not returned.");
  assert(aggregateCommit.data?.aggregate?.scheduledMessages?.length === 1, "Booking message was not returned.");

  const aggregateReplay = await createBookingRpc(aggregate, aggregateRequestId, "integration-booking-a");
  if (aggregateReplay.error) throw aggregateReplay.error;
  assert(aggregateReplay.data?.status === "already_committed", "Idempotent booking replay was not recognized.");

  const duplicateBooking = await createBookingRpc(aggregate, crypto.randomUUID(), "integration-booking-duplicate");
  if (duplicateBooking.error) throw duplicateBooking.error;
  assert(duplicateBooking.data?.status === "exists", "Duplicate booking id was not rejected.");

  const boundaryConflict = bookingAggregate("BOOKING-BOUNDARY", "2099-08-13", "2099-08-15", "09:00");
  const boundaryCommit = await createBookingRpc(boundaryConflict, crypto.randomUUID(), "integration-booking-boundary");
  if (boundaryCommit.error) throw boundaryCommit.error;
  assert(boundaryCommit.data?.status === "availability_conflict", "Boundary-time booking conflict was not rejected.");

  const blockedAggregate = bookingAggregate("BOOKING-BLOCKED", "2099-10-10", "2099-10-11");
  const blockedCommit = await createBookingRpc(blockedAggregate, crypto.randomUUID(), "integration-booking-blocked");
  if (blockedCommit.error) throw blockedCommit.error;
  assert(blockedCommit.data?.status === "availability_conflict" && blockedCommit.data?.conflictType === "block", "Calendar block conflict was not rejected.");

  const raceA = bookingAggregate("BOOKING-RACE-A", "2099-09-10", "2099-09-14");
  const raceB = bookingAggregate("BOOKING-RACE-B", "2099-09-11", "2099-09-13");
  const raceResults = await Promise.all([
    createBookingRpc(raceA, crypto.randomUUID(), "integration-booking-race-a"),
    createBookingRpc(raceB, crypto.randomUUID(), "integration-booking-race-b"),
  ]);
  for (const result of raceResults) if (result.error) throw result.error;
  const raceStatuses = raceResults.map((result) => result.data?.status).sort();
  assert(
    JSON.stringify(raceStatuses) === JSON.stringify(["availability_conflict", "committed"]),
    `Concurrent booking race was not serialized: ${raceStatuses.join(", ")}`,
  );

  const [records, writeTelemetry, taskTelemetry, checklistTelemetry, bookingTelemetry, scheduledRows] = await Promise.all([
    userClient.from("operational_records").select("entity_type,entity_id,record_version,payload"),
    userClient
      .from("audit_events")
      .select("entity_id,action,payload")
      .eq("entity_type", "state_write")
      .in("entity_id", [firstRequestId, staleRequestId]),
    userClient
      .from("audit_events")
      .select("entity_id,action,payload")
      .eq("entity_type", "task")
      .eq("action", "command_committed"),
    userClient
      .from("audit_events")
      .select("entity_id,action,payload")
      .eq("entity_type", "checklist_item")
      .eq("action", "command_committed"),
    userClient
      .from("audit_events")
      .select("entity_id,action,payload")
      .eq("entity_type", "booking"),
    userClient
      .from("scheduled_messages")
      .select("id,booking_id,status"),
  ]);
  if (records.error) throw records.error;
  if (writeTelemetry.error) throw writeTelemetry.error;
  if (taskTelemetry.error) throw taskTelemetry.error;
  if (checklistTelemetry.error) throw checklistTelemetry.error;
  if (bookingTelemetry.error) throw bookingTelemetry.error;
  if (scheduledRows.error) throw scheduledRows.error;
  assert(records.data.some((record) => record.entity_type === "units" && record.entity_id === "test-unit"), "Normalized records were not persisted.");
  const taskRecords = records.data.filter((record) => record.entity_type === "tasks" && record.entity_id.startsWith("test-task-"));
  assert(taskRecords.length === 100, "Not all task records survived parallel updates.");
  assert(taskRecords.every((record) => Number(record.record_version) === 2 && record.payload.status === "W toku"), "Parallel task records have inconsistent versions or payloads.");
  assert(writeTelemetry.data.some((event) => event.entity_id === firstRequestId && event.action === "committed"), "Successful write telemetry is missing.");
  assert(writeTelemetry.data.some((event) => event.entity_id === staleRequestId && event.action === "conflict"), "Conflict telemetry is missing.");
  assert(taskTelemetry.data.length === 100, "Task command audit is incomplete.");
  const checklistRecords = records.data.filter((record) => record.entity_type === "checklistItems" && record.entity_id.startsWith("test-check-"));
  assert(checklistRecords.length === 100, "Not all checklist records survived parallel updates.");
  assert(checklistRecords.every((record) => Number(record.record_version) === 2 && record.payload.done === true), "Parallel checklist records have inconsistent versions or payloads.");
  assert(checklistTelemetry.data.length === 100, "Checklist command audit is incomplete.");
  assert(bookingTelemetry.data.filter((event) => event.action === "command_committed").length === 2, "Booking commit audit is incomplete.");
  assert(bookingTelemetry.data.filter((event) => event.action === "command_conflict").length >= 4, "Booking conflict audit is incomplete.");
  assert(scheduledRows.data.some((row) => row.booking_id === aggregate.booking.id), "Scheduled-message execution row was not committed with the aggregate.");
  console.log("Supabase integration test passed: Auth, RLS, record persistence, two-session protection, 100 parallel record updates, atomic booking creation, replay, availability conflicts, race serialization, and command audit.");
} finally {
  console.log("Integration: cleaning temporary data…");
  await userClient.auth.signOut().catch(() => undefined);
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  await admin.from("organizations").delete().in("id", [ownOrg, otherOrg]);
}
