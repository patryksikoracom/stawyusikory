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

  console.log("Integration: checking versioned organization settings and conflict protection…");
  const updatedSettings = {
    ...state.settings,
    organizationName: "Test po zmianie",
    cleaningContactName: "Anna",
  };
  const settingsCommit = await userClient.rpc("update_operational_settings", {
    p_organization_id: ownOrg,
    p_expected_record_version: 1,
    p_settings: updatedSettings,
    p_request_id: crypto.randomUUID(),
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: "integration-settings-a",
  });
  if (settingsCommit.error) throw settingsCommit.error;
  assert(settingsCommit.data?.status === "committed", "Settings were not committed.");
  assert(Number(settingsCommit.data?.recordVersion) === 2, "Settings received the wrong record version.");
  assert(
    settingsCommit.data?.settings?.organizationName === "Test po zmianie",
    "Committed settings payload is inconsistent.",
  );

  const settingsConflict = await userClient.rpc("update_operational_settings", {
    p_organization_id: ownOrg,
    p_expected_record_version: 1,
    p_settings: { ...updatedSettings, organizationName: "Nieaktualna zmiana" },
    p_request_id: crypto.randomUUID(),
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: "integration-settings-conflict",
  });
  if (settingsConflict.error) throw settingsConflict.error;
  assert(settingsConflict.data?.status === "conflict", "A stale settings update was not rejected.");
  assert(Number(settingsConflict.data?.recordVersion) === 2, "Settings conflict returned the wrong record version.");

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
        currency: "PLN",
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

  function updateBookingRpc(aggregate, expectedRecordVersion, tabId, operation = "update") {
    return userClient.rpc("mutate_operational_booking", {
      p_organization_id: ownOrg,
      p_booking_id: aggregate.booking.id,
      p_expected_record_version: expectedRecordVersion,
      p_booking: aggregate.booking,
      p_contact: aggregate.contact,
      p_tasks: aggregate.tasks,
      p_scheduled_messages: aggregate.scheduledMessages,
      p_operation: operation,
      p_request_id: crypto.randomUUID(),
      p_client_sent_at: new Date().toISOString(),
      p_tab_id: tabId,
    });
  }

  function createPaymentRpc(payment, requestId, tabId) {
    return userClient.rpc("create_operational_payment", {
      p_organization_id: ownOrg,
      p_payment_id: payment.id,
      p_payment: payment,
      p_request_id: requestId,
      p_client_sent_at: new Date().toISOString(),
      p_tab_id: tabId,
    });
  }

  function mutateBlockRpc(
    block,
    operation,
    expectedRecordVersion,
    requestId,
    tabId,
  ) {
    return userClient.rpc("mutate_operational_calendar_block", {
      p_organization_id: ownOrg,
      p_operation: operation,
      p_block_id: block.id,
      p_expected_record_version: expectedRecordVersion,
      p_block: block,
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

  console.log("Integration: checking atomic payment posting, replay and conflicting duplicate…");
  const payment = {
    id: "PAYMENT-INTEGRATION",
    bookingId: aggregate.booking.id,
    occurredAt: "2099-07-26",
    type: "Wpłata",
    amount: 450.25,
    currency: "PLN",
    status: "Zaksięgowana",
    method: "Przelew",
    note: "Wpłata integracyjna",
  };
  const paymentRequestId = crypto.randomUUID();
  const paymentCommit = await createPaymentRpc(
    payment,
    paymentRequestId,
    "integration-payment-a",
  );
  if (paymentCommit.error) throw paymentCommit.error;
  assert(paymentCommit.data?.status === "committed", "Payment was not committed.");
  assert(Number(paymentCommit.data?.recordVersion) === 1, "Payment has the wrong record version.");

  const paymentReplay = await createPaymentRpc(
    payment,
    paymentRequestId,
    "integration-payment-a",
  );
  if (paymentReplay.error) throw paymentReplay.error;
  assert(paymentReplay.data?.status === "already_committed", "Idempotent payment replay was not recognized.");

  const paymentConflict = await createPaymentRpc(
    { ...payment, amount: 451 },
    crypto.randomUUID(),
    "integration-payment-conflict",
  );
  if (paymentConflict.error) throw paymentConflict.error;
  assert(paymentConflict.data?.status === "conflict", "Conflicting duplicate payment was not rejected.");

  const currencyMismatch = await createPaymentRpc(
    { ...payment, id: "PAYMENT-WRONG-CURRENCY", currency: "EUR" },
    crypto.randomUUID(),
    "integration-payment-currency",
  );
  assert(
    currencyMismatch.error?.code === "22023",
    "Payment currency mismatch was not rejected by the database.",
  );

  const duplicateBooking = await createBookingRpc(aggregate, crypto.randomUUID(), "integration-booking-duplicate");
  if (duplicateBooking.error) throw duplicateBooking.error;
  assert(duplicateBooking.data?.status === "exists", "Duplicate booking id was not rejected.");

  const updatedAggregate = {
    booking: {
      ...aggregate.booking,
      checkIn: "2099-08-11",
      checkOut: "2099-08-14",
      guestLabel: "Gość po zmianie",
      version: 2,
    },
    contact: {
      ...aggregate.contact,
      version: 2,
    },
    tasks: aggregate.tasks.map((task) => ({
      ...task,
      dueDate: "2099-08-14",
      version: 2,
    })),
    scheduledMessages: aggregate.scheduledMessages.map((message) => ({
      ...message,
      bookingFingerprint: "2099-08-11|2099-08-14|BOOKING-AGGREGATE",
      version: 2,
    })),
  };
  const updateCommit = await updateBookingRpc(updatedAggregate, 1, "integration-booking-update");
  if (updateCommit.error) throw updateCommit.error;
  assert(updateCommit.data?.status === "committed", "Booking update was not committed.");
  assert(Number(updateCommit.data?.recordVersion) === 2, "Booking update returned the wrong record version.");
  assert(updateCommit.data?.aggregate?.booking?.checkOut === "2099-08-14", "Booking dates were not updated.");
  assert(Number(updateCommit.data?.aggregate?.contact?.version) === 2, "Booking contact was not versioned.");
  assert(Number(updateCommit.data?.aggregate?.tasks?.[0]?.version) === 2, "Booking task was not versioned.");
  assert(Number(updateCommit.data?.aggregate?.scheduledMessages?.[0]?.version) === 2, "Booking message was not versioned.");

  const staleUpdate = await updateBookingRpc(updatedAggregate, 1, "integration-booking-update-stale");
  if (staleUpdate.error) throw staleUpdate.error;
  assert(staleUpdate.data?.status === "conflict", "A stale booking update was not rejected.");
  assert(Number(staleUpdate.data?.recordVersion) === 2, "Booking conflict returned the wrong current version.");

  const blockedUpdateAggregate = {
    ...updatedAggregate,
    booking: {
      ...updatedAggregate.booking,
      checkIn: "2099-10-10",
      checkOut: "2099-10-11",
      version: 3,
    },
    contact: { ...updatedAggregate.contact, version: 3 },
    tasks: updatedAggregate.tasks.map((task) => ({ ...task, dueDate: "2099-10-11", version: 3 })),
    scheduledMessages: updatedAggregate.scheduledMessages.map((message) => ({ ...message, version: 3 })),
  };
  const blockedUpdate = await updateBookingRpc(blockedUpdateAggregate, 2, "integration-booking-update-blocked");
  if (blockedUpdate.error) throw blockedUpdate.error;
  assert(
    blockedUpdate.data?.status === "availability_conflict" && blockedUpdate.data?.conflictType === "block",
    "A booking update into a calendar block was not rejected.",
  );

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

  console.log("Integration: checking calendar-block create, replay, conflict, cancellation and booking race…");
  const overlappingBlock = {
    id: "BLOCK-BOOKING-CONFLICT",
    unitId: "test-unit",
    dateFrom: "2099-08-11",
    dateTo: "2099-08-12",
    blockType: "Serwis",
    reason: "Konflikt z rezerwacją",
    status: "Aktywna",
    version: 1,
  };
  const overlappingBlockResult = await mutateBlockRpc(
    overlappingBlock,
    "create",
    0,
    crypto.randomUUID(),
    "integration-block-booking-conflict",
  );
  if (overlappingBlockResult.error) throw overlappingBlockResult.error;
  assert(
    overlappingBlockResult.data?.status === "availability_conflict"
      && overlappingBlockResult.data?.conflictType === "booking",
    "A calendar block overlapping a booking was not rejected.",
  );

  const calendarBlock = {
    id: "BLOCK-INTEGRATION",
    unitId: "test-unit",
    dateFrom: "2099-11-10",
    dateTo: "2099-11-12",
    blockType: "Remont",
    reason: "Testowa blokada wersjonowana",
    status: "Aktywna",
    version: 1,
  };
  const blockRequestId = crypto.randomUUID();
  const blockCommit = await mutateBlockRpc(
    calendarBlock,
    "create",
    0,
    blockRequestId,
    "integration-block-create",
  );
  if (blockCommit.error) throw blockCommit.error;
  assert(blockCommit.data?.status === "committed", "Calendar block was not committed.");
  assert(Number(blockCommit.data?.recordVersion) === 1, "Calendar block has the wrong initial version.");

  const blockReplay = await mutateBlockRpc(
    calendarBlock,
    "create",
    0,
    blockRequestId,
    "integration-block-create",
  );
  if (blockReplay.error) throw blockReplay.error;
  assert(blockReplay.data?.status === "already_committed", "Calendar block replay was not recognized.");

  const cancelledBlock = {
    ...calendarBlock,
    status: "Anulowana",
    version: 2,
  };
  const blockCancel = await mutateBlockRpc(
    cancelledBlock,
    "update",
    1,
    crypto.randomUUID(),
    "integration-block-cancel",
  );
  if (blockCancel.error) throw blockCancel.error;
  assert(blockCancel.data?.status === "committed", "Calendar block cancellation was not committed.");
  assert(Number(blockCancel.data?.recordVersion) === 2, "Calendar block cancellation has the wrong version.");

  const blockStaleUpdate = await mutateBlockRpc(
    { ...calendarBlock, reason: "Nieaktualna zmiana", version: 2 },
    "update",
    1,
    crypto.randomUUID(),
    "integration-block-stale",
  );
  if (blockStaleUpdate.error) throw blockStaleUpdate.error;
  assert(blockStaleUpdate.data?.status === "conflict", "A stale calendar-block update was not rejected.");
  assert(Number(blockStaleUpdate.data?.recordVersion) === 2, "Block conflict returned the wrong version.");

  const blockRaceBooking = bookingAggregate(
    "BOOKING-BLOCK-RACE",
    "2099-12-10",
    "2099-12-12",
  );
  const blockRaceBlock = {
    id: "BLOCK-RACE",
    unitId: "test-unit",
    dateFrom: "2099-12-10",
    dateTo: "2099-12-12",
    blockType: "Właściciel",
    reason: "Wyścig blokady z rezerwacją",
    status: "Aktywna",
    version: 1,
  };
  const blockRaceResults = await Promise.all([
    createBookingRpc(
      blockRaceBooking,
      crypto.randomUUID(),
      "integration-booking-block-race",
    ),
    mutateBlockRpc(
      blockRaceBlock,
      "create",
      0,
      crypto.randomUUID(),
      "integration-block-race",
    ),
  ]);
  for (const result of blockRaceResults) if (result.error) throw result.error;
  const blockRaceStatuses = blockRaceResults.map((result) => result.data?.status).sort();
  assert(
    JSON.stringify(blockRaceStatuses)
      === JSON.stringify(["availability_conflict", "committed"]),
    `Booking/block race was not serialized: ${blockRaceStatuses.join(", ")}`,
  );

  const deletedAt = new Date().toISOString();
  const purgeAfterDate = new Date(`${deletedAt.slice(0, 10)}T12:00:00.000Z`);
  purgeAfterDate.setUTCDate(purgeAfterDate.getUTCDate() + 30);
  const trashedAggregate = {
    ...updatedAggregate,
    booking: {
      ...updatedAggregate.booking,
      workflowStatus: "Anulowana",
      workflowStatusBeforeDeletion: updatedAggregate.booking.workflowStatus,
      deletedAt,
      purgeAfter: purgeAfterDate.toISOString().slice(0, 10),
      version: 3,
    },
    contact: { ...updatedAggregate.contact, version: 3 },
    tasks: updatedAggregate.tasks.map((task) => ({
      ...task,
      statusBeforeBookingDeletion: task.status,
      status: "Nie dotyczy",
      version: 3,
    })),
    scheduledMessages: updatedAggregate.scheduledMessages.map((message) => ({
      ...message,
      statusBeforeBookingDeletion: message.status,
      bookingFingerprintBeforeDeletion: message.bookingFingerprint,
      status: "Anulowana",
      version: 3,
    })),
  };
  const trashCommit = await updateBookingRpc(
    trashedAggregate,
    2,
    "integration-booking-trash",
    "trash",
  );
  if (trashCommit.error) throw trashCommit.error;
  assert(trashCommit.data?.status === "committed", "Booking trash command was not committed.");
  assert(trashCommit.data?.aggregate?.booking?.deletedAt === deletedAt, "Booking did not enter trash.");
  assert(
    trashCommit.data?.aggregate?.tasks?.[0]?.statusBeforeBookingDeletion === "Do zrobienia",
    "Booking task status was not preserved for restore.",
  );

  const restoredAggregate = {
    ...trashCommit.data.aggregate,
    booking: {
      ...trashCommit.data.aggregate.booking,
      workflowStatus: trashCommit.data.aggregate.booking.workflowStatusBeforeDeletion,
      workflowStatusBeforeDeletion: undefined,
      deletedAt: undefined,
      purgeAfter: undefined,
      version: 4,
    },
    contact: { ...trashCommit.data.aggregate.contact, version: 4 },
    tasks: trashCommit.data.aggregate.tasks.map((task) => ({
      ...task,
      status: task.statusBeforeBookingDeletion,
      statusBeforeBookingDeletion: undefined,
      version: 4,
    })),
    scheduledMessages: trashCommit.data.aggregate.scheduledMessages.map((message) => ({
      ...message,
      status: message.statusBeforeBookingDeletion,
      bookingFingerprint: message.bookingFingerprintBeforeDeletion,
      statusBeforeBookingDeletion: undefined,
      bookingFingerprintBeforeDeletion: undefined,
      version: 4,
    })),
  };
  const restoreCommit = await updateBookingRpc(
    restoredAggregate,
    3,
    "integration-booking-restore",
    "restore",
  );
  if (restoreCommit.error) throw restoreCommit.error;
  assert(restoreCommit.data?.status === "committed", "Booking restore command was not committed.");
  assert(!restoreCommit.data?.aggregate?.booking?.deletedAt, "Booking remained in trash after restore.");
  assert(
    restoreCommit.data?.aggregate?.tasks?.[0]?.status === "Do zrobienia",
    "Booking task status was not restored.",
  );

  const cancelledAggregate = {
    ...restoredAggregate,
    booking: {
      ...restoredAggregate.booking,
      workflowStatus: "Anulowana",
      version: 5,
    },
    contact: { ...restoredAggregate.contact, version: 5 },
    tasks: restoredAggregate.tasks.map((task) => ({ ...task, status: "Nie dotyczy", version: 5 })),
    scheduledMessages: restoredAggregate.scheduledMessages.map((message) => ({ ...message, status: "Anulowana", version: 5 })),
  };
  const cancelCommit = await updateBookingRpc(
    cancelledAggregate,
    4,
    "integration-booking-cancel",
    "cancel",
  );
  if (cancelCommit.error) throw cancelCommit.error;
  assert(cancelCommit.data?.status === "committed", "Booking cancellation was not committed.");
  assert(cancelCommit.data?.aggregate?.booking?.workflowStatus === "Anulowana", "Booking was not cancelled.");
  assert(cancelCommit.data?.aggregate?.tasks?.[0]?.status === "Nie dotyczy", "Stay task was not cancelled.");
  assert(cancelCommit.data?.aggregate?.scheduledMessages?.[0]?.status === "Anulowana", "Scheduled message was not cancelled.");

  const batchIssue = {
    id: "integration-batch-issue",
    title: "Test komendy batchowej",
    status: "Otwarte",
    createdAt: new Date().toISOString(),
  };
  const batchRpc = (changes, requestId) => userClient.rpc("mutate_operational_record_batch", {
    p_organization_id: ownOrg,
    p_changes: changes,
    p_request_id: requestId,
    p_client_sent_at: new Date().toISOString(),
    p_tab_id: "integration-tab-batch",
  });
  const batchCreateChanges = [{
    entityType: "issues",
    entityId: batchIssue.id,
    operation: "upsert",
    expectedRecordVersion: 0,
    payload: batchIssue,
  }];
  const batchCreate = await batchRpc(batchCreateChanges, "integration-batch-create");
  if (batchCreate.error) throw batchCreate.error;
  assert(batchCreate.data?.status === "committed", "Record batch create was not committed.");
  const batchReplay = await batchRpc(batchCreateChanges, "integration-batch-create");
  if (batchReplay.error) throw batchReplay.error;
  assert(batchReplay.data?.status === "already_committed", "Record batch replay was not idempotent.");
  const batchUpdate = await batchRpc([{
    ...batchCreateChanges[0],
    expectedRecordVersion: 1,
    payload: { ...batchIssue, status: "W toku" },
  }], "integration-batch-update");
  if (batchUpdate.error) throw batchUpdate.error;
  assert(batchUpdate.data?.status === "committed", "Record batch update was not committed.");
  const batchConflict = await batchRpc([{
    ...batchCreateChanges[0],
    expectedRecordVersion: 1,
    payload: { ...batchIssue, status: "Rozwiązane" },
  }], "integration-batch-stale");
  if (batchConflict.error) throw batchConflict.error;
  assert(batchConflict.data?.status === "conflict", "Stale record batch did not return a conflict.");

  const [records, writeTelemetry, taskTelemetry, checklistTelemetry, settingsTelemetry, bookingTelemetry, paymentTelemetry, blockTelemetry, batchTelemetry, scheduledRows] = await Promise.all([
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
      .eq("entity_type", "settings")
      .eq("entity_id", "organization"),
    userClient
      .from("audit_events")
      .select("entity_id,action,payload")
      .eq("entity_type", "booking"),
    userClient
      .from("audit_events")
      .select("entity_id,action,payload")
      .eq("entity_type", "payment"),
    userClient
      .from("audit_events")
      .select("entity_id,action,payload")
      .eq("entity_type", "block"),
    userClient
      .from("audit_events")
      .select("entity_id,action,payload")
      .eq("entity_type", "record_batch"),
    userClient
      .from("scheduled_messages")
      .select("id,booking_id,status"),
  ]);
  if (records.error) throw records.error;
  if (writeTelemetry.error) throw writeTelemetry.error;
  if (taskTelemetry.error) throw taskTelemetry.error;
  if (checklistTelemetry.error) throw checklistTelemetry.error;
  if (settingsTelemetry.error) throw settingsTelemetry.error;
  if (bookingTelemetry.error) throw bookingTelemetry.error;
  if (paymentTelemetry.error) throw paymentTelemetry.error;
  if (blockTelemetry.error) throw blockTelemetry.error;
  if (batchTelemetry.error) throw batchTelemetry.error;
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
  const settingsRecord = records.data.find(
    (record) => record.entity_type === "settings" && record.entity_id === "organization",
  );
  assert(
    Number(settingsRecord?.record_version) === 2
      && settingsRecord?.payload?.organizationName === "Test po zmianie",
    "Versioned settings record is missing or inconsistent.",
  );
  assert(
    settingsTelemetry.data.some((event) => event.action === "command_committed")
      && settingsTelemetry.data.some((event) => event.action === "command_conflict"),
    "Settings commit/conflict audit is incomplete.",
  );
  const paymentRecord = records.data.find(
    (record) => record.entity_type === "payments" && record.entity_id === payment.id,
  );
  assert(
    Number(paymentRecord?.record_version) === 1
      && paymentRecord?.payload?.amount === payment.amount,
    "Payment ledger record is missing or inconsistent.",
  );
  assert(
    paymentTelemetry.data.some(
      (event) => event.entity_id === payment.id && event.action === "command_committed",
    )
      && paymentTelemetry.data.some(
        (event) => event.entity_id === payment.id && event.action === "command_conflict",
      ),
    "Payment commit/conflict audit is incomplete.",
  );
  const calendarBlockRecord = records.data.find(
    (record) => record.entity_type === "blocks" && record.entity_id === calendarBlock.id,
  );
  assert(
    Number(calendarBlockRecord?.record_version) === 2
      && calendarBlockRecord?.payload?.status === "Anulowana",
    "Versioned calendar-block record is missing or inconsistent.",
  );
  assert(
    blockTelemetry.data.filter((event) => event.action === "command_committed").length >= 2
      && blockTelemetry.data.filter((event) => event.action === "command_conflict").length >= 2,
    "Calendar-block commit/conflict audit is incomplete.",
  );
  const batchIssueRecord = records.data.find(
    (record) => record.entity_type === "issues" && record.entity_id === batchIssue.id,
  );
  assert(
    Number(batchIssueRecord?.record_version) === 2
      && batchIssueRecord?.payload?.status === "W toku",
    "Record batch payload or version is inconsistent.",
  );
  assert(
    batchTelemetry.data.some(
      (event) => event.entity_id === "integration-batch-create"
        && event.action === "command_committed",
    )
      && batchTelemetry.data.some(
        (event) => event.entity_id === "integration-batch-stale"
          && event.action === "command_conflict",
      ),
    "Record batch commit/conflict audit is incomplete.",
  );
  assert(bookingTelemetry.data.filter((event) => event.action === "command_committed").length >= 6, "Booking commit audit is incomplete.");
  assert(
    bookingTelemetry.data.some(
      (event) => event.action === "lifecycle_committed"
        && event.payload?.command_kind === "trash",
    )
      && bookingTelemetry.data.some(
        (event) => event.action === "lifecycle_committed"
          && event.payload?.command_kind === "restore",
      ),
    "Booking trash/restore audit kinds are missing.",
  );
  assert(bookingTelemetry.data.filter((event) => event.action === "command_conflict").length >= 6, "Booking conflict audit is incomplete.");
  assert(
    scheduledRows.data.some((row) => row.booking_id === aggregate.booking.id && row.status === "Anulowana"),
    "Scheduled-message execution row was not reconciled with the cancelled booking.",
  );
  console.log("Supabase integration test passed: Auth, RLS, record persistence, two-session protection, 100 parallel record updates, versioned settings, atomic booking lifecycle, idempotent payment posting, versioned calendar blocks, record batches, booking/block race serialization, availability conflicts, and command audit.");
} finally {
  console.log("Integration: cleaning temporary data…");
  await userClient.auth.signOut().catch(() => undefined);
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  await admin.from("organizations").delete().in("id", [ownOrg, otherOrg]);
}
