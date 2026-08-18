// Shapes as served by the Fountain API (docs/api.md).

export interface Sandbox {
  id: string;
  sprite_name: string;
  status: string;
  url: string | null;
}

export type ConversationStatus = "pending" | "running" | "idle" | "failed" | "terminated";

export interface Conversation {
  id: string;
  title: string | null;
  sandbox_id: string | null;
  sandbox: Sandbox | null;
  agent_id: string | null;
  vault_id: string | null;
  environment_id: string | null;
  runtime: string;
  acp: boolean;
  status: ConversationStatus;
  runtime_session_id: string | null;
  source: "ui" | "api" | "agent";
  parent_conversation_id: string | null;
  channel_id: string | null;
  turn_count: number;
  last_active_at: string | null;
  last_read_at: string | null;
  unread: boolean;
  inserted_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  model: string;
  runtime: string;
  acp?: boolean;
  environment_id: string | null;
  allowed_vault_ids: string[] | null;
  allowed_environment_ids: string[] | null;
  avatar_media_type?: string | null;
}

export interface Environment {
  id: string;
  name: string;
}

export interface Vault {
  id: string;
  name: string;
}

export interface Turn {
  id: string;
  turn_number: number;
  prompt: string;
  status: string;
  exit_code: number | null;
  started_at: string | null;
  ended_at: string | null;
  inserted_at: string;
  image_count: number;
}

export type BlockKind =
  | "text"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "init"
  | "result"
  | "error"
  | "raw";

/** A server-parsed block (`?blocks=true`). Fields depend on `kind`; see docs/api.md. */
export interface Block {
  kind: BlockKind;
  body?: string | null;
  summary?: string | null;
  id?: string | null;
  name?: string | null;
  tool_id?: string | null;
  error?: boolean | null;
  raw?: string | null;
}

export interface LogEvent {
  id: number;
  kind: "output" | "stage" | string;
  stream: string | null;
  data: string | null;
  stage: string | null;
  state: string | null;
  duration_ms?: number | null;
  turn_id: string | null;
  ts: string;
  blocks?: Block[];
}

/** An event from `GET /api/events/stream`: the log event plus its conversation. */
export interface UserEvent extends LogEvent {
  conversation_id: string;
}

export interface TreeNode {
  id: string;
  source: string;
  status: ConversationStatus;
  parent_id: string | null;
}

export interface ImageInput {
  data: string;
  media_type: string;
}

export interface Me {
  id: string;
  email: string;
  role: string;
}
