import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useStore } from "../store";
import { navigate, paths } from "../router";
import { describeError, THREAD_STREAMS } from "../api/client";
import type { Conversation, ImageInput, LogEvent, TreeNode, Turn, UserEvent } from "../api/types";
import { arrange, formatDuration, isSection, sectionState, timeline, type Section } from "../lib/blocks";
import { loadPrefs, savePrefs } from "../lib/prefs";
import { conversationLabel, formatClock, formatTime, shortId } from "../lib/format";
import { BlockView } from "../components/Blocks";
import { StatusPill } from "../components/StatusPill";
import { ImagePicker } from "../components/ImagePicker";
import { renderMarkdown } from "../lib/markdown";
import { TurnImages } from "../components/TurnImages";

export function ShowPage({ id }: { id: string }) {
  const { client, conversations, agents, subscribe, refresh, toast } = useStore();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [prefs, setPrefs] = useState(() => loadPrefs());
  const [showTree, setShowTree] = useState(false);
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<ImageInput[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const listed = conversations.find((c) => c.id === id) ?? null;
  const current = listed ?? conv;
  const agent = current?.agent_id ? agents.get(current.agent_id) ?? null : null;

  const setPref = (p: Partial<typeof prefs>) => setPrefs(savePrefs(p));

  // Initial load: the conversation, its turns, and every event with blocks.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setTurns([]);
    setEvents([]);
    Promise.all([client.getConversation(id), client.listTurns(id), client.listAllEvents(id)])
      .then(([c, t, e]) => {
        if (cancelled) return;
        setConv(c);
        setTurns(t);
        setEvents(e);
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as { status?: number }).status === 404) setNotFound(true);
        else toast(describeError(err), "error");
      })
      .finally(() => !cancelled && setLoading(false));
    client.markRead(id).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, id, toast]);

  // Live: append events, refetch turns at turn boundaries, mark read at the end.
  useEffect(() => {
    return subscribe(id, (ev: UserEvent) => {
      setEvents((es) => (es.some((e) => e.id === ev.id) ? es : [...es, ev]));
      if (ev.kind === "stage" && ev.stage === "turn") {
        client.listTurns(id).then(setTurns).catch(() => undefined);
        if (ev.state !== "started") client.markRead(id).catch(() => undefined);
      }
      if (ev.kind === "stage") client.getConversation(id).then(setConv).catch(() => undefined);
    });
  }, [subscribe, client, id]);

  useEffect(() => {
    if (!showTree) return;
    client.tree(id).then(setTree).catch(() => setTree([]));
  }, [showTree, client, id, conversations]);

  // Stick to the bottom while the reply streams unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [events.length, turns.length, prefs.viewMode]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    document.title = current ? `${conversationLabel(current, turns[0]?.prompt)} · Conversations` : "Conversations";
  }, [current, turns]);

  const eventsByTurn = useMemo(() => {
    const m = new Map<string, LogEvent[]>();
    for (const ev of events) {
      if (!ev.turn_id) continue;
      const arr = m.get(ev.turn_id);
      if (arr) arr.push(ev);
      else m.set(ev.turn_id, [ev]);
    }
    return m;
  }, [events]);

  const visible = useMemo(() => new Set(prefs.visibleStreams), [prefs.visibleStreams]);
  const items = useMemo(() => (prefs.viewMode === "timeline" ? timeline(events, turns) : []), [events, turns, prefs.viewMode]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || !current) return;
    setSending(true);
    try {
      await client.prompt(id, text, images);
      setDraft("");
      setImages([]);
      stick.current = true;
    } catch (err) {
      toast(describeError(err), "error");
    } finally {
      setSending(false);
    }
  }, [draft, images, sending, current, client, id, toast]);

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  const act = (label: string, fn: () => Promise<unknown>, confirm?: string) => async () => {
    if (confirm && !window.confirm(confirm)) return;
    try {
      await fn();
      toast(label);
      void refresh();
    } catch (err) {
      toast(describeError(err), "error");
    }
  };

  if (notFound) {
    return (
      <div className="page">
        <div className="empty">
          <p>That conversation does not exist (or is not yours).</p>
          <a href={paths.index}>Back to conversations</a>
        </div>
      </div>
    );
  }

  const live = current && current.status !== "terminated" && current.status !== "failed";
  const toggleStream = (s: string) => {
    const set = new Set(prefs.visibleStreams);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    setPref({ visibleStreams: [...set] });
  };

  return (
    <div className="show">
      <header className="show-header">
        <a href={paths.index} className="back" aria-label="Back to conversations">
          ‹
        </a>
        <div className="show-title">
          <div className="name">{current ? conversationLabel(current, turns[0]?.prompt) : "…"}</div>
          <div className="sub muted">
            {agent?.name ?? "—"} · {current?.runtime}
            {agent && ` · ${agent.model}`}
            {current?.sandbox && <span className="mono"> · {current.sandbox.sprite_name}</span>}
            {current && <span className="mono"> · {shortId(current.id)}</span>}
            {current?.parent_conversation_id && (
              <>
                {" · "}
                <a href={paths.show(current.parent_conversation_id)}>parent</a>
              </>
            )}
          </div>
        </div>
        {current && <StatusPill status={current.status} sandbox={current.sandbox?.status} />}
        <div className="row actions">
          <div className="seg">
            <button className={prefs.viewMode === "chat" ? "on" : ""} onClick={() => setPref({ viewMode: "chat" })}>
              Chat
            </button>
            <button className={prefs.viewMode === "timeline" ? "on" : ""} onClick={() => setPref({ viewMode: "timeline" })}>
              Timeline
            </button>
          </div>
          <button className={`secondary small ${showTree ? "on" : ""}`} onClick={() => setShowTree((v) => !v)} title="Spawn tree">
            Tree
          </button>
          <a className="button secondary small" href={paths.logs(id)} title="Raw log events">
            Logs
          </a>
          {current?.status === "running" && (
            <button className="secondary small" onClick={act("Interrupted", () => client.interrupt(id))}>
              Interrupt
            </button>
          )}
          {live && (
            <button
              className="danger small"
              onClick={act("Terminated", () => client.terminate(id), "Terminate this conversation? Its sandbox is destroyed; the transcript stays.")}
            >
              Terminate
            </button>
          )}
          <button
            className="danger small"
            onClick={act(
              "Deleted",
              async () => {
                await client.deleteConversation(id);
                navigate(paths.index);
              },
              "Delete this conversation and its transcript?",
            )}
          >
            Delete
          </button>
        </div>
      </header>

      {prefs.viewMode === "timeline" && (
        <div className="stream-toggles">
          {THREAD_STREAMS.map((s) => (
            <label key={s} className="check small">
              <input type="checkbox" checked={visible.has(s)} onChange={() => toggleStream(s)} />
              {s}
            </label>
          ))}
        </div>
      )}

      <div className="show-body">
        <div className={`transcript ${prefs.viewMode}`} ref={scrollRef} onScroll={onScroll}>
          {loading && <div className="centered muted">Loading…</div>}
          {!loading && turns.length === 0 && events.length === 0 && (
            <div className="centered muted empty-thread">
              {current?.status === "pending" ? "Starting the sandbox…" : "No turns yet."}
            </div>
          )}
          {prefs.viewMode === "chat" &&
            turns.map((turn) => (
              <ChatTurn key={turn.id} turn={turn} events={eventsByTurn.get(turn.id) ?? []} conversationId={id} agentName={agent?.name ?? current?.runtime ?? "agent"} />
            ))}
          {prefs.viewMode === "timeline" &&
            items.map((item, i) =>
              isSection(item) ? (
                <SectionView key={item.key} section={item} visible={visible} conversationId={id} />
              ) : (
                <LooseEvent key={item.id ?? i} ev={item} visible={visible} />
              ),
            )}
        </div>
        {showTree && (
          <aside className="tree">
            <div className="tree-head">Spawn tree</div>
            {tree === null && <div className="muted small">Loading…</div>}
            {tree && <TreeView nodes={tree} currentId={id} />}
            <a className="button secondary small" href={paths.new(id)}>
              New sub-conversation
            </a>
          </aside>
        )}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="composer-main">
          <textarea
            rows={1}
            value={draft}
            placeholder={live ? "Follow-up prompt… (Enter to send, Shift+Enter for a new line)" : "This conversation is finished — a prompt starts nothing here."}
            disabled={!live}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
          />
          <ImagePicker images={images} onChange={setImages} />
        </div>
        <button type="submit" className="send" disabled={!live || sending || !draft.trim()} aria-label="Send">
          ↑
        </button>
      </form>
    </div>
  );
}

function SectionView({ section, visible, conversationId }: { section: Section; visible: Set<string>; conversationId: string }) {
  const state = sectionState(section);
  // Adjacent output events render as one arranged run; nested sections in place.
  const runs: Array<{ kind: "run"; events: LogEvent[] } | { kind: "section"; section: Section }> = [];
  for (const child of section.children) {
    if (isSection(child)) runs.push({ kind: "section", section: child });
    else {
      const last = runs[runs.length - 1];
      if (last && last.kind === "run") last.events.push(child);
      else runs.push({ kind: "run", events: [child] });
    }
  }
  const hiddenStage = !visible.has("stage");
  return (
    <div className={`stage ${state} ${hiddenStage ? "no-stage" : ""}`}>
      {!hiddenStage && (
        <div className="stage-head">
          <span className="stage-dot" />
          <span className="stage-name">{section.stage}</span>
          {section.turn && <span className="stage-turn">turn {section.turn.turn_number}</span>}
          <span className="stage-state muted">{state}</span>
          {section.ended?.duration_ms != null && <span className="muted">{formatDuration(section.ended.duration_ms)}</span>}
          <span className="stage-time muted">{formatClock(section.started?.ts ?? section.ended?.ts)}</span>
        </div>
      )}
      {section.turn && (
        <div className="stage-prompt">
          <div className="label">prompt</div>
          <div className="md">{renderMarkdown(section.turn.prompt)}</div>
          {section.turn.image_count > 0 && <TurnImages conversationId={conversationId} turn={section.turn} />}
        </div>
      )}
      {!hiddenStage && stageMeta(section.started, section.ended)}
      <div className="stage-blocks">
        {runs.map((r, i) =>
          r.kind === "section" ? (
            <SectionView key={r.section.key} section={r.section} visible={visible} conversationId={conversationId} />
          ) : (
            <div key={i} className="stage-run">
              {arrange(r.events.filter((e) => e.kind === "output"), visible).map((b, j) => (
                <BlockView key={j} block={b} />
              ))}
              {r.events
                .filter((e) => e.kind === "stage" && visible.has("stage"))
                .map((e) => (
                  <LooseEvent key={e.id} ev={e} visible={visible} />
                ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function LooseEvent({ ev, visible }: { ev: LogEvent; visible: Set<string> }) {
  if (ev.kind === "stage") {
    if (!visible.has("stage")) return null;
    return (
      <div className="stage-loose mono muted">
        {ev.stage}/{ev.state} {formatClock(ev.ts)}
        {ev.duration_ms != null && ` · ${formatDuration(ev.duration_ms)}`}
      </div>
    );
  }
  return (
    <>
      {arrange([ev], visible).map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  );
}

function stageMeta(started: LogEvent | null, ended: LogEvent | null) {
  const bits: string[] = [];
  for (const ev of [started, ended]) {
    if (!ev?.data) continue;
    try {
      const obj = JSON.parse(ev.data) as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (v == null || v === "" || k === "message") continue;
        bits.push(`${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
      }
      if (typeof obj.message === "string") bits.unshift(obj.message);
    } catch {
      bits.push(ev.data);
    }
  }
  if (!bits.length) return null;
  return <div className="stage-meta mono muted">{bits.join(" · ")}</div>;
}

function ChatTurn({ turn, events, conversationId, agentName }: { turn: Turn; events: LogEvent[]; conversationId: string; agentName: string }) {
  const blocks = useMemo(() => arrange(events, new Set(["acp", "stdout"])), [events]);
  const inFlight = turn.status === "pending" || turn.status === "running";
  const failed = turn.status === "failed" || turn.status === "cancelled" || turn.status === "interrupted";
  return (
    <div className="turn">
      <div className="bubble you">
        <div className="body">{turn.prompt}</div>
        {turn.image_count > 0 && <TurnImages conversationId={conversationId} turn={turn} />}
        <div className="meta">{formatTime(turn.inserted_at)}</div>
      </div>
      <div className="them-label muted small">{agentName}</div>
      {blocks
        .filter((b) => b.kind !== "init" && b.kind !== "result")
        .map((b, i) => (
          <BlockView key={i} block={b} bubble />
        ))}
      {inFlight && blocks.length === 0 && (
        <div className="bubble them typing">
          <span />
          <span />
          <span />
        </div>
      )}
      {inFlight && blocks.length > 0 && <div className="muted small typing-note">working…</div>}
      {failed && <div className="muted small typing-note">turn {turn.status}</div>}
    </div>
  );
}

function TreeView({ nodes, currentId }: { nodes: TreeNode[]; currentId: string }) {
  const children = new Map<string | null, TreeNode[]>();
  for (const n of nodes) {
    const arr = children.get(n.parent_id) ?? [];
    arr.push(n);
    children.set(n.parent_id, arr);
  }
  const rootIds = new Set(nodes.map((n) => n.id));
  const roots = nodes.filter((n) => !n.parent_id || !rootIds.has(n.parent_id));
  const render = (n: TreeNode, depth: number): ReactNode => (
    <div key={n.id}>
      <a href={paths.show(n.id)} className={`tree-node ${n.id === currentId ? "current" : ""}`} style={{ paddingLeft: 8 + depth * 14 }}>
        <span className={`pill tiny ${n.status}`}>{n.status}</span>
        <span className="mono">{shortId(n.id)}</span>
        <span className="muted">{n.source}</span>
      </a>
      {(children.get(n.id) ?? []).map((c) => render(c, depth + 1))}
    </div>
  );
  if (nodes.length <= 1) return <div className="muted small">No sub-conversations.</div>;
  return <div>{roots.map((r) => render(r, 0))}</div>;
}
