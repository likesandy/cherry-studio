/**
 * SQL queries for AgentService
 * All SQL queries are centralized here for better maintainability
 *
 * NOTE: Schema uses 'user_goal' and 'latest_claude_session_id' to match SessionEntity,
 * but input DTOs use 'user_prompt' and 'claude_session_id' for backward compatibility.
 * The service layer handles the mapping between these naming conventions.
 */

export const AgentQueries = {
  // Table creation queries
  createTables: {
    agents: `
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        avatar TEXT,
        instructions TEXT,
        model TEXT NOT NULL,
        tools TEXT, -- JSON array of enabled tool IDs
        knowledges TEXT, -- JSON array of enabled knowledge base IDs
        configuration TEXT, -- JSON, extensible settings like temperature, top_p
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0
      )
    `,

    sessions: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_ids TEXT NOT NULL, -- JSON array of agent IDs involved
        user_goal TEXT, -- Initial user goal for the session
        status TEXT NOT NULL DEFAULT 'idle', -- 'idle', 'running', 'completed', 'failed', 'stopped'
        accessible_paths TEXT, -- JSON array of directory paths
        latest_claude_session_id TEXT, -- Latest Claude SDK session ID for continuity
        max_turns INTEGER DEFAULT 10, -- Maximum number of turns allowed
        permission_mode TEXT DEFAULT 'default', -- 'default', 'acceptEdits', 'bypassPermissions'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0
      )
    `,

    sessionLogs: `
      CREATE TABLE IF NOT EXISTS session_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        parent_id INTEGER, -- Foreign Key to session_logs.id, nullable for tree structure
        role TEXT NOT NULL, -- 'user', 'agent', 'system'
        type TEXT NOT NULL, -- 'message', 'thought', 'action', 'observation', etc.
        content TEXT NOT NULL, -- JSON structured data
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id),
        FOREIGN KEY (parent_id) REFERENCES session_logs (id)
      )
    `
  },

  // Index creation queries
  createIndexes: {
    agentsName: 'CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name)',
    agentsModel: 'CREATE INDEX IF NOT EXISTS idx_agents_model ON agents(model)',
    agentsCreatedAt: 'CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at)',
    agentsIsDeleted: 'CREATE INDEX IF NOT EXISTS idx_agents_is_deleted ON agents(is_deleted)',

    sessionsStatus: 'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
    sessionsCreatedAt: 'CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)',
    sessionsIsDeleted: 'CREATE INDEX IF NOT EXISTS idx_sessions_is_deleted ON sessions(is_deleted)',
    sessionsLatestClaudeSessionId:
      'CREATE INDEX IF NOT EXISTS idx_sessions_latest_claude_session_id ON sessions(latest_claude_session_id)',
    sessionsAgentIds: 'CREATE INDEX IF NOT EXISTS idx_sessions_agent_ids ON sessions(agent_ids)',

    sessionLogsSessionId: 'CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id)',
    sessionLogsParentId: 'CREATE INDEX IF NOT EXISTS idx_session_logs_parent_id ON session_logs(parent_id)',
    sessionLogsRole: 'CREATE INDEX IF NOT EXISTS idx_session_logs_role ON session_logs(role)',
    sessionLogsType: 'CREATE INDEX IF NOT EXISTS idx_session_logs_type ON session_logs(type)',
    sessionLogsCreatedAt: 'CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at)'
  },

  // Agent operations
  agents: {
    insert: `
      INSERT INTO agents (id, name, description, avatar, instructions, model, tools, knowledges, configuration, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    update: `
      UPDATE agents
      SET name = ?, description = ?, avatar = ?, instructions = ?, model = ?, tools = ?, knowledges = ?, configuration = ?, updated_at = ?
      WHERE id = ? AND is_deleted = 0
    `,

    getById: `
      SELECT * FROM agents
      WHERE id = ? AND is_deleted = 0
    `,

    list: `
      SELECT * FROM agents
      WHERE is_deleted = 0
      ORDER BY created_at DESC
    `,

    count: 'SELECT COUNT(*) as total FROM agents WHERE is_deleted = 0',

    softDelete: 'UPDATE agents SET is_deleted = 1, updated_at = ? WHERE id = ?',

    checkExists: 'SELECT id FROM agents WHERE id = ? AND is_deleted = 0'
  },

  // Session operations
  sessions: {
    insert: `
      INSERT INTO sessions (id, agent_ids, user_goal, status, accessible_paths, latest_claude_session_id, max_turns, permission_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    update: `
      UPDATE sessions
      SET agent_ids = ?, user_goal = ?, status = ?, accessible_paths = ?, latest_claude_session_id = ?, max_turns = ?, permission_mode = ?, updated_at = ?
      WHERE id = ? AND is_deleted = 0
    `,

    updateStatus: `
      UPDATE sessions
      SET status = ?, updated_at = ?
      WHERE id = ? AND is_deleted = 0
    `,

    getById: `
      SELECT * FROM sessions
      WHERE id = ? AND is_deleted = 0
    `,

    list: `
      SELECT * FROM sessions
      WHERE is_deleted = 0
      ORDER BY created_at DESC
    `,

    listWithLimit: `
      SELECT * FROM sessions
      WHERE is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,

    count: 'SELECT COUNT(*) as total FROM sessions WHERE is_deleted = 0',

    softDelete: 'UPDATE sessions SET is_deleted = 1, updated_at = ? WHERE id = ?',

    checkExists: 'SELECT id FROM sessions WHERE id = ? AND is_deleted = 0',

    getByStatus: `
      SELECT * FROM sessions
      WHERE status = ? AND is_deleted = 0
      ORDER BY created_at DESC
    `,

    updateLatestClaudeSessionId: `
      UPDATE sessions
      SET latest_claude_session_id = ?, updated_at = ?
      WHERE id = ? AND is_deleted = 0
    `,

    getSessionWithAgent: `
      SELECT
        s.*,
        a.name as agent_name,
        a.description as agent_description,
        a.avatar as agent_avatar,
        a.instructions as agent_instructions,
        a.model as agent_model,
        a.tools as agent_tools,
        a.knowledges as agent_knowledges,
        a.configuration as agent_configuration,
        a.created_at as agent_created_at,
        a.updated_at as agent_updated_at
      FROM sessions s
      LEFT JOIN agents a ON JSON_EXTRACT(s.agent_ids, '$[0]') = a.id
      WHERE s.id = ? AND s.is_deleted = 0 AND (a.is_deleted = 0 OR a.is_deleted IS NULL)
    `,

    getByLatestClaudeSessionId: `
      SELECT * FROM sessions
      WHERE latest_claude_session_id = ? AND is_deleted = 0
    `
  },

  // Session logs operations
  sessionLogs: {
    insert: `
      INSERT INTO session_logs (session_id, parent_id, role, type, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,

    getBySessionId: `
      SELECT * FROM session_logs
      WHERE session_id = ?
      ORDER BY created_at ASC
    `,

    getBySessionIdWithPagination: `
      SELECT * FROM session_logs
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `,

    countBySessionId: 'SELECT COUNT(*) as total FROM session_logs WHERE session_id = ?',

    getLatestBySessionId: `
      SELECT * FROM session_logs
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,

    deleteBySessionId: 'DELETE FROM session_logs WHERE session_id = ?'
  }
} as const
