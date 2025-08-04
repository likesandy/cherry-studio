/**
 * Database entity types for Agent, Session, and SessionLog
 * Shared between main and renderer processes
 */

export interface AgentEntity {
  id: string
  name: string
  description?: string
  avatar?: string
  instructions?: string // System prompt
  model: string // Model ID (required)
  tools?: string[] // Array of enabled tool IDs
  knowledges?: string[] // Array of enabled knowledge base IDs
  configuration?: Record<string, any> // Extensible settings like temperature, top_p
  created_at: string
  updated_at: string
}

export interface SessionEntity {
  id: string
  agent_ids: string[] // Array of agent IDs involved (supports multi-agent scenarios)
  user_goal?: string // Initial user goal for the session
  status: SessionStatus
  accessible_paths?: string[] // Array of directory paths the agent can access
  latest_claude_session_id?: string // Latest Claude SDK session ID for continuity
  max_turns?: number // Maximum number of turns allowed in the session, default 10
  permission_mode?: PermissionMode // Permission mode for the session
  created_at: string
  updated_at: string
}

export interface SessionLogEntity {
  id: number // Auto-increment primary key
  session_id: string
  parent_id?: number // For tree structure of logs
  role: SessionLogRole
  type: string
  content: Record<string, any> // JSON structured data
  created_at: string
}

// Enums and union types
export type SessionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped'
export type SessionLogRole = 'user' | 'agent' | 'system'
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions'

// Input/Output DTOs for API operations
export interface CreateAgentInput {
  name: string
  description?: string
  avatar?: string
  instructions?: string
  model: string
  tools?: string[]
  knowledges?: string[]
  configuration?: Record<string, any>
}

export interface UpdateAgentInput {
  id: string
  name?: string
  description?: string
  avatar?: string
  instructions?: string
  model?: string
  tools?: string[]
  knowledges?: string[]
  configuration?: Record<string, any>
}

export interface CreateSessionInput {
  agent_ids: string[]
  user_goal?: string
  status?: SessionStatus
  accessible_paths?: string[]
  max_turns?: number
  permission_mode?: PermissionMode
}

export interface UpdateSessionInput {
  id: string
  agent_ids?: string[]
  user_goal?: string
  status?: SessionStatus
  accessible_paths?: string[]
  latest_claude_session_id?: string
  max_turns?: number
  permission_mode?: PermissionMode
}

export interface CreateSessionLogInput {
  session_id: string
  parent_id?: number
  role: SessionLogRole
  type: string
  content: Record<string, any>
}

// List/Search options
export interface ListAgentsOptions {
  limit?: number
  offset?: number
}

export interface ListSessionsOptions {
  limit?: number
  offset?: number
  status?: SessionStatus
}

export interface ListSessionLogsOptions {
  session_id: string
  limit?: number
  offset?: number
}

// Service result types

export interface FetchMCPToolResponse {
  id: string
  name: string
  type: string
  url: string
}

export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface FetchModelResponse {
  id: string
  object?: string
  created?: number
  owned_by?: string
  provider_id: string
  model_id: string
  name: string
}

export interface ListResult<T> {
  items: T[]
  total: number
}

// Content types for session logs
export interface MessageContent {
  text: string
}

export interface ThoughtContent {
  text: string
  reasoning?: string
}

export interface ActionContent {
  tool: string
  input: Record<string, any>
  description?: string
}

export interface ObservationContent {
  result: any
  success: boolean
  error?: string
}

// Agent execution specific content types
export interface ExecutionStartContent {
  sessionId: string
  agentId: string
  command: string
  workingDirectory: string
  claudeSessionId?: string
}

export interface ExecutionCompleteContent {
  sessionId: string
  success: boolean
  exitCode?: number
  output?: string
  error?: string
  claudeSessionId?: string
}

export interface ExecutionInterruptContent {
  sessionId: string
  reason: 'user_stop' | 'timeout' | 'error'
  message?: string
}

// Agent execution IPC event types
export interface AgentExecutionOutputEvent {
  sessionId: string
  type: 'stdout' | 'stderr'
  data: string
  timestamp: number
}

export interface AgentExecutionCompleteEvent {
  sessionId: string
  exitCode: number
  success: boolean
  timestamp: number
}

export interface AgentExecutionErrorEvent {
  sessionId: string
  error: string
  timestamp: number
}

// Agent execution status information
export interface AgentExecutionInfo {
  sessionId: string
  commandId: string
  startTime: number
  workingDirectory: string
}

// Agent conversation TypeScript interfaces

export interface ConversationMessage {
  id: string
  type: 'user-prompt' | 'agent-response' | 'error' | 'system'
  content: string
  timestamp: number
  promptId?: string // Links response to originating prompt
  sessionId?: string // Links message to specific conversation session
  isComplete: boolean // For streaming messages
}

export interface AgentTaskExecution {
  id: string
  prompt: string
  startTime: number
  endTime?: number
  status: 'idle' | 'running' | 'completed' | 'error'
  isRunning: boolean
}

// IPC Communication interfaces
export interface AgentPromptRequest {
  id: string
  /** User prompt/message to the agent */
  prompt: string
  /** Agent ID to process the prompt */
  agentId?: string
  /** Session context for the conversation */
  sessionId?: string
  /** Working directory for any file operations */
  workingDirectory: string
}

export interface AgentResponse {
  promptId: string
  type: 'response' | 'error' | 'complete' | 'partial'
  data: string
  metadata?: Record<string, any>
}

// Legacy alias for backward compatibility
export type PocCommandOutput = AgentResponse

// IPC Channel constants
export const IPC_CHANNELS = {
  SEND_PROMPT: 'agent-send-prompt',
  AGENT_RESPONSE: 'agent-response',
  INTERRUPT_AGENT: 'agent-interrupt',
  // Legacy aliases for backward compatibility
  EXECUTE_COMMAND: 'agent-send-prompt',
  COMMAND_OUTPUT: 'agent-response',
  INTERRUPT_COMMAND: 'agent-interrupt'
} as const
