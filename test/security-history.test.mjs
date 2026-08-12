import assert from "node:assert/strict";
import { test } from "node:test";
import { SecurityHistoryService, formatSecurityEvent } from "../dist/history/SecurityHistoryService.js";

test("SecurityHistoryService records events", () => {
  const service = new SecurityHistoryService();
  service.record("vault_unlocked");
  assert.strictEqual(service.getEventCount(), 1);
});

test("SecurityHistoryService records events with details", () => {
  const service = new SecurityHistoryService();
  service.record("blocks_exported", "count: 5");
  const events = service.getEvents();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, "blocks_exported");
  assert.strictEqual(events[0].details, "count: 5");
});

test("SecurityHistoryService returns events in reverse chronological order", () => {
  const service = new SecurityHistoryService();
  service.record("vault_unlocked");
  service.record("block_encrypted");
  service.record("vault_locked");

  const events = service.getEvents();
  assert.strictEqual(events[0].type, "vault_locked");
  assert.strictEqual(events[1].type, "block_encrypted");
  assert.strictEqual(events[2].type, "vault_unlocked");
});

test("SecurityHistoryService respects limit", () => {
  const service = new SecurityHistoryService();
  for (let i = 0; i < 10; i++) {
    service.record("block_encrypted");
  }

  const events = service.getEvents(5);
  assert.strictEqual(events.length, 5);
});

test("SecurityHistoryService enforces max events", () => {
  const service = new SecurityHistoryService();
  for (let i = 0; i < 110; i++) {
    service.record("block_encrypted");
  }

  assert.strictEqual(service.getEventCount(), 100);
});

test("SecurityHistoryService clear removes all events", () => {
  const service = new SecurityHistoryService();
  service.record("vault_unlocked");
  service.clear();
  assert.strictEqual(service.getEventCount(), 0);
});

test("formatSecurityEvent formats without details", () => {
  const event = {
    id: "1",
    type: "vault_unlocked",
    timestamp: new Date("2024-01-15T10:30:00Z").toISOString(),
  };
  const formatted = formatSecurityEvent(event);
  assert.ok(formatted.includes("Vault unlocked"));
  assert.ok(!formatted.includes("("));
});

test("formatSecurityEvent formats with details", () => {
  const event = {
    id: "1",
    type: "blocks_exported",
    timestamp: new Date("2024-01-15T10:30:00Z").toISOString(),
    details: "count: 5",
  };
  const formatted = formatSecurityEvent(event);
  assert.ok(formatted.includes("Blocks exported"));
  assert.ok(formatted.includes("(count: 5)"));
});

test("formatSecurityEvent handles unknown event types", () => {
  const event = {
    id: "1",
    type: "unknown_event",
    timestamp: new Date("2024-01-15T10:30:00Z").toISOString(),
  };
  const formatted = formatSecurityEvent(event);
  assert.ok(formatted.includes("unknown_event"));
});

test("SecurityHistoryService generates unique IDs", () => {
  const service = new SecurityHistoryService();
  service.record("vault_unlocked");
  service.record("vault_locked");

  const events = service.getEvents();
  assert.notStrictEqual(events[0].id, events[1].id);
  assert.strictEqual(events[0].id.length, 16); // 8 bytes as hex
});

test("SecurityHistoryService timestamps are ISO 8601", () => {
  const service = new SecurityHistoryService();
  service.record("vault_unlocked");

  const events = service.getEvents();
  const timestamp = events[0].timestamp;
  assert.ok(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp));
});
