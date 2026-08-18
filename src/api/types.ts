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
  system?: string;
  model: string;
  runtime: string;
  acp?: boolean;
  sandbox_provider?: string | null;
  environment_id: string | null;
  skills?: Skill[];
  mcp_servers?: Record<string, McpServer>;
  metadata?: Record<string, unknown>;
  allowed_vault_ids: string[] | null;
  allowed_environment_ids: string[] | null;
  conversation_count?: number;
  avatar_media_type?: string | null;
  inserted_at?: string;
  updated_at?: string;
}

export interface Skill {
  name?: string;
  content?: string;
  source?: string;
  ref?: string;
}

export interface McpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface AgentInput {
  name: string;
  description?: string;
  system?: string;
  model: string;
  runtime: string;
  sandbox_provider?: string | null;
  environment_id?: string | null;
  skills?: Skill[];
  mcp_servers?: Record<string, McpServer>;
  allowed_vault_ids?: string[] | null;
  allowed_environment_ids?: string[] | null;
  metadata?: Record<string, unknown>;
}

export interface Repository {
  url: string;
  mount_path: string;
}

export interface Environment {
  id: string;
  name: string;
  packages: Record<string, string[]>;
  env_vars: Record<string, string>;
  setup_script: string | null;
  networking_type: "unrestricted" | "limited";
  networking_config: { allowed_hosts?: string[] } | null;
  repositories: Repository[];
  metadata: Record<string, unknown>;
  secret_count?: number;
  agent_count?: number;
  inserted_at: string;
  updated_at: string;
}

export interface EnvironmentInput {
  name: string;
  packages?: Record<string, string[]>;
  env_vars?: Record<string, string>;
  setup_script?: string;
  networking_type?: "unrestricted" | "limited";
  networking_config?: { allowed_hosts: string[] };
  repositories?: Repository[];
}

export interface Vault {
  id: string;
  name: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  secret_count?: number;
  inserted_at?: string;
  updated_at?: string;
}

export interface Secret {
  id: string;
  key: string;
  environment_id?: string;
  vault_id?: string;
  inserted_at?: string;
  updated_at?: string;
}

export interface Catalog {
  runtimes: string[];
  models: Record<string, string[]>;
  model_providers: string[];
  sandbox_providers: { enabled: string[]; default: string };
  package_managers: string[];
  avatar: { bases: string[]; moods: string[] };
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
