import { describe, expect, test } from "bun:test";
import { arrange, assistantText, timeline, stageState } from "./blocks";
import type { LogEvent, Turn } from "../api/types";

let id = 0;
const ev = (over: Partial<LogEvent>): LogEvent => ({
  id: ++id,
  kind: "output",
  stream: "acp",
  data: null,
  stage: null,
  state: null,
  turn_id: "t1",
  ts: "2026-08-18T00:00:00Z",
  ...over,
});

describe("arrange", () => {
  test("merges adjacent text and pairs tool results", () => {
    const events = [
      ev({ blocks: [{ kind: "text", body: "Hel" }] }),
      ev({ blocks: [{ kind: "text", body: "lo" }, { kind: "tool_use", id: "c1", name: "Read", summary: "a.ex", body: "{}" }] }),
      ev({ blocks: [{ kind: "tool_result", tool_id: "c1", body: "ok", error: false }, { kind: "text", body: "done" }] }),
    ];
    expect(arrange(events)).toEqual([
      { kind: "text", body: "Hello" },
      { kind: "tool_use", id: "c1", name: "Read", summary: "a.ex", body: "{}", result: { body: "ok", error: false } },
      { kind: "text", body: "done" },
    ]);
    expect(assistantText(events)).toBe("Hellodone");
  });

  test("hides streams that are toggled off; an orphan result stays visible", () => {
    const events = [
      ev({ stream: "stderr", blocks: [{ kind: "raw", body: "warn" }] }),
      ev({ blocks: [{ kind: "tool_result", tool_id: "zz", body: "late" }] }),
    ];
    expect(arrange(events, new Set(["acp"]))).toEqual([{ kind: "tool_result", tool_id: "zz", body: "late" }]);
  });
});

describe("timeline", () => {
  test("pairs stage start/end and nests a turn's output under it", () => {
    const turns: Turn[] = [{ id: "t1", turn_number: 1, prompt: "hi", status: "completed", exit_code: 0, started_at: null, ended_at: null, inserted_at: "", image_count: 0 }];
    const events = [
      ev({ kind: "stage", stream: null, stage: "provision", state: "started", turn_id: null }),
      ev({ kind: "stage", stream: null, stage: "provision", state: "done", turn_id: null, duration_ms: 1200 }),
      ev({ kind: "stage", stream: null, stage: "turn", state: "started" }),
      ev({ blocks: [{ kind: "text", body: "reply" }] }),
      ev({ kind: "stage", stream: null, stage: "turn", state: "done", duration_ms: 3000 }),
      ev({ kind: "stage", stream: null, stage: "sandbox", state: "started", turn_id: null }),
    ];
    const items = timeline(events, turns);
    expect(items.map((i) => [i.stage, stageState(i), i.events.length, i.turn?.prompt ?? null])).toEqual([
      ["provision", "done", 0, null],
      ["turn", "done", 1, "hi"],
      ["sandbox", "running", 0, null],
    ]);
  });
});
