import { useMemo, useState } from "react";
import { useStore } from "../store";
import { navigate, paths } from "../router";
import { loadPrefs, savePrefs } from "../lib/prefs";
import { conversationLabel, formatTime, shortId } from "../lib/format";
import { describeError } from "../api/client";
import type { Conversation } from "../api/types";
import { StatusPill } from "../components/StatusPill";

export function IndexPage() {
  const { client, conversations, agents, error, refresh, toast } = useStore();
  const [prefs, setPrefs] = useState(() => loadPrefs());

  const rows = useMemo(() => {
    let list = conversations;
    if (prefs.rootsOnly) list = list.filter((c) => !c.parent_conversation_id);
    const key = prefs.sort === "created" ? (c: Conversation) => c.inserted_at : (c: Conversation) => c.last_active_at ?? c.inserted_at;
    return [...list].sort((a, b) => key(b).localeCompare(key(a)));
  }, [conversations, prefs]);

  const setPref = (p: Partial<typeof prefs>) => setPrefs(savePrefs(p));

  async function remove(c: Conversation) {
    if (!window.confirm(`Delete this conversation? Its sandbox is torn down and the transcript is gone.`)) return;
    try {
      await client.deleteConversation(c.id);
      toast("Deleted");
      void refresh();
    } catch (err) {
      toast(describeError(err), "error");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Conversations</h1>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={prefs.rootsOnly} onChange={(e) => setPref({ rootsOnly: e.target.checked })} />
            roots only
          </label>
          <select value={prefs.sort} onChange={(e) => setPref({ sort: e.target.value as "activity" | "created" })} className="compact">
            <option value="activity">by activity</option>
            <option value="created">by created</option>
          </select>
          <button onClick={() => navigate(paths.new())}>New conversation</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {rows.length === 0 && !error && (
        <div className="empty">
          <p>No conversations yet.</p>
          <p className="muted">Start one: pick an agent, give it a first prompt, and watch it work.</p>
          <button onClick={() => navigate(paths.new())}>New conversation</button>
        </div>
      )}

      <ul className="conv-list">
        {rows.map((c) => (
          <li key={c.id}>
            <a className="conv-row" href={paths.show(c.id)}>
              <div className="conv-main">
                <div className="conv-title">
                  {c.unread && <span className="unread-dot" title="Unread" />}
                  <span className={c.unread ? "strong" : ""}>{conversationLabel(c)}</span>
                  {c.parent_conversation_id && <span className="tag">sub</span>}
                  {c.channel_id && <span className="tag">{c.channel_id === "fountain:team" ? "team" : "channel"}</span>}
                </div>
                <div className="conv-sub muted">
                  {agents.get(c.agent_id ?? "")?.name ?? "—"} · {c.runtime}
                  {c.turn_count ? ` · ${c.turn_count} turn${c.turn_count === 1 ? "" : "s"}` : ""}
                  {c.sandbox ? ` · ${c.sandbox.sprite_name}` : ""}
                  <span className="mono"> · {shortId(c.id)}</span>
                </div>
              </div>
              <div className="conv-side">
                <StatusPill status={c.status} sandbox={c.sandbox?.status} />
                <span className="time muted">{formatTime(c.last_active_at ?? c.inserted_at)}</span>
              </div>
            </a>
            <button className="icon danger-icon" title="Delete" aria-label="Delete" onClick={() => void remove(c)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
