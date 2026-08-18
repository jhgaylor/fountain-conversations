/**
 * The Fountain API, as much of it as this app needs. Every call carries the
 * bearer key; every error is an `ApiError` with the server's `error` string
 * when there was one.
 */
import type {
  Agent,
  Conversation,
  Environment,
  ImageInput,
  LogEvent,
  Me,
  TreeNode,
  Turn,
  Vault,
} from "./types";
import { readSse, type SseMessage } from "../lib/sse";
import type { Settings } from "../lib/settings";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    message: string,
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
}

export interface StartInput {
  agent_id: string;
  prompt?: string;
  images?: ImageInput[];
  environment_id?: string;
  vault_id?: string;
  title?: string;
}

export const THREAD_STREAMS = ["acp", "stdout", "stderr", "stage"];

export class FountainClient {
  constructor(private settings: Settings) {}

  get baseUrl(): string {
    return this.settings.baseUrl;
  }

  me(): Promise<Me> {
    return this.json<Me>("GET", "/api/auth/me");
  }

  // ── conversations ───────────────────────────────────────────────────────

  async listConversations(rootsOnly = false): Promise<Conversation[]> {
    const qs = rootsOnly ? "?roots_only=true" : "";
    return (await this.json<{ data: Conversation[] }>("GET", `/api/conversations${qs}`)).data;
  }

  async getConversation(id: string): Promise<Conversation> {
    return (await this.json<{ data: Conversation }>("GET", `/api/conversations/${id}`)).data;
  }

  async startConversation(input: StartInput): Promise<Conversation> {
    return (await this.json<{ data: Conversation }>("POST", "/api/conversations", input)).data;
  }

  deleteConversation(id: string): Promise<void> {
    return this.json<void>("DELETE", `/api/conversations/${id}`);
  }

  terminate(id: string): Promise<unknown> {
    return this.json("POST", `/api/conversations/${id}/terminate`);
  }

  interrupt(id: string): Promise<unknown> {
    return this.json("POST", `/api/conversations/${id}/interrupt`);
  }

  prompt(id: string, prompt: string, images: ImageInput[] = []): Promise<unknown> {
    return this.json("POST", `/api/conversations/${id}/prompts`, images.length ? { prompt, images } : { prompt });
  }

  markRead(id: string): Promise<void> {
    return this.json<void>("POST", `/api/conversations/${id}/read`);
  }

  async listTurns(id: string): Promise<Turn[]> {
    return (await this.json<{ data: Turn[] }>("GET", `/api/conversations/${id}/turns`)).data;
  }

  async tree(id: string): Promise<TreeNode[]> {
    return (await this.json<{ data: TreeNode[] }>("GET", `/api/conversations/${id}/tree`)).data;
  }

  /** Every event of the conversation, with server-parsed blocks, oldest first, paging until drained. */
  async listAllEvents(id: string, streams: string[] = THREAD_STREAMS): Promise<LogEvent[]> {
    const out: LogEvent[] = [];
    let after: number | null = null;
    for (;;) {
      const qs = new URLSearchParams({ limit: "1000", streams: streams.join(","), blocks: "true" });
      if (after !== null) qs.set("after", String(after));
      const page: { data: LogEvent[]; meta: { has_more: boolean; next_cursor: number | null } } =
        await this.json("GET", `/api/conversations/${id}/events?${qs}`);
      out.push(...page.data);
      if (!page.meta.has_more || page.meta.next_cursor === null) break;
      after = page.meta.next_cursor;
    }
    return out;
  }

  imageUrl(conversationId: string, turnId: string, position: number): string {
    return `/api/conversations/${conversationId}/turns/${turnId}/images/${position}`;
  }

  // ── picker options ──────────────────────────────────────────────────────

  async listAgents(): Promise<Agent[]> {
    return (await this.json<{ data: Agent[] }>("GET", "/api/agents")).data;
  }

  async listEnvironments(): Promise<Environment[]> {
    return (await this.json<{ data: Environment[] }>("GET", "/api/environments")).data;
  }

  async listVaults(): Promise<Vault[]> {
    return (await this.json<{ data: Vault[] }>("GET", "/api/vaults")).data;
  }

  // ── streams ─────────────────────────────────────────────────────────────

  /** Every conversation's events on one connection, with blocks. Resolves when the server closes. */
  streamAll(opts: {
    lastEventId: string | null;
    signal: AbortSignal;
    onMessage: (msg: SseMessage) => void;
    onOpen?: () => void;
    onClose: (err?: unknown) => void;
  }): Promise<void> {
    const qs = new URLSearchParams({ streams: THREAD_STREAMS.join(","), blocks: "true" });
    return readSse(`${this.baseUrl}/api/events/stream?${qs}`, {
      headers: { authorization: `Bearer ${this.settings.apiKey}` },
      lastEventId: opts.lastEventId,
      signal: opts.signal,
      onMessage: opts.onMessage,
      onOpen: opts.onOpen,
      onClose: opts.onClose,
    });
  }

  /** A raw authenticated GET, for bytes (images, avatars). */
  fetchRaw(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${this.settings.apiKey}` },
    });
  }

  // ── plumbing ────────────────────────────────────────────────────────────

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.settings.apiKey}`,
      accept: "application/json",
    };
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    if (!res.ok) {
      const obj = (parsed ?? {}) as { error?: unknown; message?: unknown };
      const code = typeof obj.error === "string" ? obj.error : null;
      const message =
        typeof obj.message === "string" ? obj.message : code ?? `${res.status} ${res.statusText}`;
      const ra = res.headers.get("retry-after");
      throw new ApiError(res.status, code, message, ra ? Number(ra) : null);
    }
    return parsed as T;
  }
}

/** A human line for an API failure. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "conversation_busy":
        return "A turn is still running — wait for it, or interrupt.";
      case "provisioning":
        return "The sandbox is still starting — try again shortly.";
      case "subscription_required":
        return "An active Fountain subscription is required.";
      case "environment_not_allowed":
        return "That agent may not use that environment.";
      case "vault_not_allowed":
        return "That agent may not use that vault.";
      case "environment_not_found":
        return "Environment not found.";
      case "vault_not_found":
        return "Vault not found.";
      case "not_found":
        return "Not found.";
      default:
        if (err.status === 401) return "That API key was not accepted.";
        if (err.status === 410) return "That conversation is gone — start a new one.";
        if (err.status === 429) return "Too many requests — slow down a little.";
        if (err.status === 503) return "Fountain could not reach the sandbox provider — try again shortly.";
        return err.message;
    }
  }
  if (err instanceof TypeError) {
    return "Could not reach Fountain. Check the URL, and that API_CORS_ORIGINS on the server includes this site.";
  }
  return err instanceof Error ? err.message : String(err);
}
