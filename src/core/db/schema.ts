import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import type {
  AgentMode,
  AgentRunStatus,
  AgentToolPermissions,
  AgentVisibilityMode,
  ExternalFolderSession,
  FileContextSource,
  MessageMetadata,
  MessageRole,
  MessageStatus,
  McpServerAuthMode,
  McpServerStatus,
  McpServerTransport,
  ProviderAuthType,
  ProviderFamily,
  ReasoningEffort,
  BuiltInToolKey,
  ParallelRunStatus,
  ParallelRunWorkerStatus,
  ScheduleRunStatus,
  TerminalSessionStatus,
  TerminalStreamKind,
  WorkspaceFileSourceKind,
} from "@/core/types/app-state";

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    providerId: text("provider_id"),
    modelId: text("model_id"),
    reasoningEffort: text("reasoning_effort")
      .$type<ReasoningEffort>()
      .notNull()
      .default("medium"),
    agentId: text("agent_id"),
    agentMode: text("agent_mode").$type<AgentMode>().notNull().default("build"),
    projectId: text("project_id"),
    selectedFileIds: text("selected_file_ids_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    selectedMcpServerIds: text("selected_mcp_server_ids_json", {
      mode: "json",
    }).$type<string[] | null>(),
    selectedSkillIds: text("selected_skill_ids_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    externalFolderSession: text("external_folder_session_json", { mode: "json" })
      .$type<ExternalFolderSession | null>(),
    pinnedAt: text("pinned_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("idx_conversations_updated_at").on(table.updatedAt),
    index("idx_conversations_project_id").on(table.projectId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    role: text("role").$type<MessageRole>().notNull(),
    content: text("content").notNull(),
    metadata: text("metadata_json", { mode: "json" }).$type<MessageMetadata | null>(),
    status: text("status").$type<MessageStatus>().notNull(),
    error: text("error"),
    sequence: integer("sequence").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_messages_conversation_sequence").on(
      table.conversationId,
      table.sequence,
    ),
  ],
);

export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    status: text("status").$type<AgentRunStatus>().notNull(),
    userMessageId: text("user_message_id").notNull(),
    assistantMessageId: text("assistant_message_id").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    input: text("input").notNull(),
    fileContextSource: text("file_context_source").$type<FileContextSource | null>(),
    selectedFileIds: text("selected_file_ids_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    externalFolderSession: text("external_folder_session_json", {
      mode: "json",
    }).$type<ExternalFolderSession | null>(),
    startedAt: text("started_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
    lastError: text("last_error"),
    resumeCount: integer("resume_count").notNull().default(0),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    lastRetryAt: text("last_retry_at"),
    agentId: text("agent_id"),
    agentMode: text("agent_mode").$type<AgentMode>().notNull().default("build"),
    autoApprove: integer("auto_approve", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    index("idx_agent_runs_conversation_updated_at").on(
      table.conversationId,
      table.updatedAt,
    ),
    index("idx_agent_runs_status_updated_at").on(table.status, table.updatedAt),
  ],
);

export const workspaceFiles = sqliteTable(
  "workspace_files",
  {
    id: text("id").primaryKey().notNull(),
    displayName: text("display_name").notNull(),
    originalName: text("original_name"),
    mimeType: text("mime_type"),
    size: integer("size"),
    relativePath: text("relative_path").notNull(),
    sourceKind: text("source_kind").$type<WorkspaceFileSourceKind>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("workspace_files_relative_path_unique").on(table.relativePath)],
);

export const providerConfigs = sqliteTable("provider_configs", {
  id: text("id").primaryKey().notNull(),
  family: text("family").$type<ProviderFamily>().notNull(),
  label: text("label").notNull(),
  authType: text("auth_type").$type<ProviderAuthType>().notNull(),
  baseUrl: text("base_url"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  oauthAccountEmail: text("oauth_account_email"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const modelPresets = sqliteTable(
  "model_presets",
  {
    id: text("id").primaryKey().notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    label: text("label"),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    options: text("options_json", { mode: "json" }).$type<
      Record<string, unknown> | null
    >(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("model_presets_provider_id_model_id_unique").on(
      table.providerId,
      table.modelId,
    ),
  ],
);

export const mcpServers = sqliteTable(
  "mcp_servers",
  {
    id: text("id").primaryKey().notNull(),
    label: text("label").notNull(),
    url: text("url").notNull(),
    transport: text("transport").$type<McpServerTransport>().notNull(),
    authMode: text("auth_mode").$type<McpServerAuthMode>().notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    headerNames: text("header_names_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    oauthClientId: text("oauth_client_id"),
    oauthAuthorizationUrl: text("oauth_authorization_url"),
    oauthTokenUrl: text("oauth_token_url"),
    oauthScopes: text("oauth_scopes"),
    oauthAllowedAuthOrigin: text("oauth_allowed_auth_origin"),
    lastStatus: text("last_status").$type<McpServerStatus>().notNull().default("untested"),
    lastError: text("last_error"),
    toolCount: integer("tool_count"),
    serverInfo: text("server_info_json", { mode: "json" }).$type<Record<string, unknown> | null>(),
    serverInstructions: text("server_instructions"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_mcp_servers_updated_at").on(table.updatedAt)],
);

export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    description: text("description"),
    instructions: text("instructions").notNull(),
    sourceMarkdown: text("source_markdown"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    autoMatch: integer("auto_match", { mode: "boolean" }).notNull().default(false),
    matchKeywords: text("match_keywords_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    recommendedMcpServerIds: text("recommended_mcp_server_ids_json", {
      mode: "json",
    })
      .$type<string[]>()
      .notNull()
      .default([]),
    recommendedBuiltInToolKeys: text("recommended_built_in_tool_keys_json", {
      mode: "json",
    })
      .$type<BuiltInToolKey[]>()
      .notNull()
      .default([]),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_skills_updated_at").on(table.updatedAt)],
);

export const skillFiles = sqliteTable(
  "skill_files",
  {
    id: text("id").primaryKey().notNull(),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    mimeType: text("mime_type"),
    size: integer("size"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("skill_files_skill_id_path_unique").on(table.skillId, table.path),
    index("idx_skill_files_skill_id").on(table.skillId),
  ],
);

export const agents = sqliteTable(
  "agents",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    prompt: text("prompt"),
    mode: text("mode").$type<AgentVisibilityMode>().notNull().default("all"),
    modelProviderId: text("model_provider_id"),
    modelModelId: text("model_model_id"),
    temperature: real("temperature"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    sourceMarkdown: text("source_markdown"),
    toolPermissions: text("tool_permissions_json", { mode: "json" })
      .$type<AgentToolPermissions>()
      .notNull()
      .default({}),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("agents_name_unique").on(table.name),
    index("idx_agents_updated_at").on(table.updatedAt),
  ],
);

export const agentDocs = sqliteTable(
  "agent_docs",
  {
    id: text("id").primaryKey().notNull(),
    agentId: text("agent_id").notNull(),
    name: text("name").notNull(),
    content: text("content").notNull(),
    mimeType: text("mime_type"),
    size: integer("size"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_agent_docs_agent_id").on(table.agentId),
  ],
);

export const savedPrompts = sqliteTable(
  "saved_prompts",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_saved_prompts_updated_at").on(table.updatedAt)],
);

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    expression: text("expression").notNull(),
    timezone: text("timezone").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    agentId: text("agent_id"),
    autoApprove: integer("auto_approve", { mode: "boolean" })
      .notNull()
      .default(true),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    conversationId: text("conversation_id"),
    externalFolderSession: text("external_folder_session_json", {
      mode: "json",
    }).$type<ExternalFolderSession | null>(),
    lastRunAt: text("last_run_at"),
    nextRunAt: text("next_run_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_schedules_enabled_next_run_at").on(
      table.enabled,
      table.nextRunAt,
    ),
    index("idx_schedules_updated_at").on(table.updatedAt),
  ],
);

export const scheduleRuns = sqliteTable(
  "schedule_runs",
  {
    id: text("id").primaryKey().notNull(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    runId: text("run_id"),
    status: text("status").$type<ScheduleRunStatus>().notNull(),
    error: text("error"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("idx_schedule_runs_schedule_started_at").on(
      table.scheduleId,
      table.startedAt,
    ),
  ],
);

export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey().notNull(),
    content: text("content").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    sourceConversationId: text("source_conversation_id"),
    sourceMessageId: text("source_message_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [index("idx_memories_updated_at").on(table.updatedAt)],
);

export const providerAccounts = sqliteTable(
  "provider_accounts",
  {
    id: text("id").primaryKey().notNull(),
    providerId: text("provider_id").notNull(),
    label: text("label").notNull(),
    credentialKind: text("credential_kind")
      .$type<"apiKey" | "oauth">()
      .notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_provider_accounts_provider_id").on(table.providerId),
  ],
);

export const providerAccountState = sqliteTable("provider_account_state", {
  providerId: text("provider_id").primaryKey().notNull(),
  activeAccountId: text("active_account_id"),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey().notNull(),
  value: text("value"),
});


// ============================================================
// FEATURE: Nested Projects
// ============================================================
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey().notNull(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    folderUri: text("folder_uri"),
    folderDisplayName: text("folder_display_name"),
    inheritFromParent: integer("inherit_from_parent", { mode: "boolean" }).notNull().default(true),
    providerId: text("provider_id"),
    modelId: text("model_id"),
    agentId: text("agent_id"),
    reasoningEffort: text("reasoning_effort").$type<ReasoningEffort>().notNull().default("medium"),
    autoApprove: integer("auto_approve", { mode: "boolean" }).notNull().default(false),
    color: text("color"),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("idx_projects_parent_id").on(table.parentId),
    index("idx_projects_updated_at").on(table.updatedAt),
  ],
);

export const terminalSessions = sqliteTable(
  "terminal_sessions",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    projectId: text("project_id"),
    cwd: text("cwd").notNull(),
    shell: text("shell").notNull(),
    status: text("status").$type<TerminalSessionStatus>().notNull().default("idle"),
    lastCommand: text("last_command"),
    exitCode: integer("exit_code"),
    bootstrapReady: integer("bootstrap_ready", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [
    index("idx_terminal_sessions_project_id").on(table.projectId),
    index("idx_terminal_sessions_updated_at").on(table.updatedAt),
  ],
);

export const terminalSessionOutput = sqliteTable(
  "terminal_session_output",
  {
    id: text("id").primaryKey().notNull(),
    sessionId: text("session_id").notNull().references(() => terminalSessions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    stream: text("stream").$type<TerminalStreamKind>().notNull(),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_terminal_session_output_session_seq").on(table.sessionId, table.sequence)],
);

export const parallelRuns = sqliteTable(
  "parallel_runs",
  {
    id: text("id").primaryKey().notNull(),
    parentConversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    parentMessageId: text("parent_message_id").notNull(),
    orchestratorAgentId: text("orchestrator_agent_id"),
    title: text("title").notNull(),
    task: text("task").notNull(),
    status: text("status").$type<ParallelRunStatus>().notNull().default("planning"),
    plan: text("plan_json", { mode: "json" }).$type<Array<{ id: string; title: string; description: string; workerAgentId: string; workerAgentName: string; }>>().notNull().default([]),
    summary: text("summary"),
    projectId: text("project_id"),
    startedAt: text("started_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
    lastError: text("last_error"),
  },
  (table) => [
    index("idx_parallel_runs_conversation_updated_at").on(table.parentConversationId, table.updatedAt),
    index("idx_parallel_runs_status_updated_at").on(table.status, table.updatedAt),
  ],
);

export const parallelRunWorkers = sqliteTable(
  "parallel_run_workers",
  {
    id: text("id").primaryKey().notNull(),
    parallelRunId: text("parallel_run_id").notNull().references(() => parallelRuns.id, { onDelete: "cascade" }),
    planItemId: text("plan_item_id").notNull(),
    workerAgentId: text("worker_agent_id").notNull(),
    workerAgentName: text("worker_agent_name").notNull(),
    subtask: text("subtask").notNull(),
    conversationId: text("conversation_id"),
    agentRunId: text("agent_run_id"),
    status: text("status").$type<ParallelRunWorkerStatus>().notNull().default("pending"),
    result: text("result"),
    errorMessage: text("error_message"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_parallel_run_workers_run_id").on(table.parallelRunId),
    index("idx_parallel_run_workers_status").on(table.status),
  ],
);

export const schema = {
  agentDocs,
  agentRuns,
  agents,
  appSettings,
  conversations,
  memories,
  messages,
  mcpServers,
  modelPresets,
  providerAccounts,
  providerAccountState,
  providerConfigs,
  savedPrompts,
  scheduleRuns,
  schedules,
  skillFiles,
  skills,
  workspaceFiles,
  parallelRunWorkers,
  parallelRuns,
  projects,
  terminalSessionOutput,
  terminalSessions,
};
