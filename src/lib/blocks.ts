/**
 * Arranging server-parsed blocks for display. The server does the parsing
 * (`?blocks=true`); the client only pairs and groups.
 */
import type { Block, LogEvent, Turn } from "../api/types";

/** A tool_use with its tool_result tucked in, or any other block as is. */
export type ShownBlock =
  | (Block & { kind: "tool_use"; result?: { body: string; error: boolean } })
  | Block;

/** Concatenate adjacent text/thinking blocks and pair tool results onto their calls. */
export function arrange(events: LogEvent[], visibleStreams?: Set<string>): ShownBlock[] {
  const raw: Block[] = [];
  for (const ev of events) {
    if (ev.kind !== "output" || !ev.blocks) continue;
    if (visibleStreams && ev.stream && !visibleStreams.has(ev.stream)) continue;
    for (const b of ev.blocks) {
      const last = raw[raw.length - 1];
      if ((b.kind === "text" || b.kind === "thinking") && last && last.kind === b.kind) {
        last.body = (last.body ?? "") + (b.body ?? "");
      } else {
        raw.push({ ...b });
      }
    }
  }
  const results = new Map<string, Block>();
  for (const b of raw) if (b.kind === "tool_result" && b.tool_id) results.set(b.tool_id, b);
  const consumed = new Set<string>();
  const out: ShownBlock[] = [];
  for (const b of raw) {
    if (b.kind === "tool_use" && b.id && results.has(b.id)) {
      const r = results.get(b.id)!;
      consumed.add(b.id);
      out.push({ ...b, kind: "tool_use", result: { body: r.body ?? "", error: !!r.error } });
    } else if (b.kind === "tool_result" && b.tool_id && consumed.has(b.tool_id)) {
      continue;
    } else {
      out.push(b);
    }
  }
  return out;
}

/** The assistant's text of a turn — chat bubbles and previews. */
export function assistantText(events: LogEvent[]): string {
  return arrange(events)
    .filter((b) => b.kind === "text")
    .map((b) => b.body ?? "")
    .join("")
    .trim();
}

export interface StageItem {
  kind: "stage";
  key: string;
  stage: string;
  started: LogEvent | null;
  ended: LogEvent | null;
  turn: Turn | null;
  events: LogEvent[];
}

/**
 * The timeline: stage events paired start→end in order, with the output
 * events that happened under each. Turn stages carry their turn.
 */
export function timeline(events: LogEvent[], turns: Turn[]): StageItem[] {
  const byId = new Map(turns.map((t) => [t.id, t]));
  const items: StageItem[] = [];
  const open = new Map<string, StageItem>(); // stage(+turn) → item

  const keyOf = (ev: LogEvent) => `${ev.stage}:${ev.turn_id ?? ""}`;

  for (const ev of events) {
    if (ev.kind === "stage" && ev.stage) {
      const key = keyOf(ev);
      if (ev.state === "started") {
        const item: StageItem = {
          kind: "stage",
          key: `${key}:${ev.id}`,
          stage: ev.stage,
          started: ev,
          ended: null,
          turn: ev.turn_id ? byId.get(ev.turn_id) ?? null : null,
          events: [],
        };
        items.push(item);
        open.set(key, item);
      } else {
        const item = open.get(key);
        if (item) {
          item.ended = ev;
          open.delete(key);
        } else {
          items.push({
            kind: "stage",
            key: `${key}:${ev.id}`,
            stage: ev.stage,
            started: null,
            ended: ev,
            turn: ev.turn_id ? byId.get(ev.turn_id) ?? null : null,
            events: [],
          });
        }
      }
    } else if (ev.kind === "output") {
      // Output belongs to the open stage of its turn (or the latest open one).
      const target =
        (ev.turn_id && open.get(`turn:${ev.turn_id}`)) ||
        [...open.values()].pop() ||
        items[items.length - 1];
      if (target) target.events.push(ev);
      else items.push({ kind: "stage", key: `orphan:${ev.id}`, stage: "output", started: null, ended: null, turn: null, events: [ev] });
    }
  }
  return items;
}

export function stageState(item: StageItem): "running" | "done" | "failed" | "interrupted" | "unknown" {
  if (item.ended?.state === "done") return "done";
  if (item.ended?.state === "failed") return "failed";
  if (item.ended?.state === "interrupted") return "interrupted";
  if (item.started && !item.ended) return "running";
  return "unknown";
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
