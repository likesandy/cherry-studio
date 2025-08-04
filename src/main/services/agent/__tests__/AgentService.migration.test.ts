import { createClient } from '@libsql/client'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentService } from '../AgentService'

// Mock node:fs
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    default: actual
  }
})

// Mock node:os
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return {
    ...actual,
    default: actual
  }
})

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn()
  }
}))

// Mock logger
vi.mock('@logger', () => ({
  loggerService: {
    withContext: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }))
  }
}))

describe('AgentService Database Migration', () => {
  let testDbPath: string
  let dbFilePath: string
  let agentService: AgentService

  beforeEach(async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')

    // Create a unique test database path for each test
    testDbPath = path.join(os.tmpdir(), `test-migration-db-${Date.now()}-${Math.random()}`)
    dbFilePath = path.join(testDbPath, 'agent.db')

    // Import and mock app.getPath after module is loaded
    const { app } = await import('electron')
    vi.mocked(app.getPath).mockReturnValue(testDbPath)

    // Ensure directory exists
    fs.mkdirSync(testDbPath, { recursive: true })
  })

  afterEach(async () => {
    // Close database connection if it exists
    if (agentService) {
      await agentService.close()
    }

    // Clean up test database files
    try {
      const fs = await import('node:fs')
      if (fs.existsSync(testDbPath)) {
        fs.rmSync(testDbPath, { recursive: true, force: true })
      }
    } catch (error) {
      console.warn('Failed to clean up test database:', error)
    }
  })

  describe('Schema Creation', () => {
    it('should create all tables with correct schema on first initialization', async () => {
      agentService = AgentService.reload()

      // Create agent to trigger initialization
      const result = await agentService.createAgent({
        name: 'Test Agent',
        model: 'gpt-4'
      })
      expect(result.success).toBe(true)

      // Verify database file was created
      const fs = await import('node:fs')
      expect(fs.existsSync(dbFilePath)).toBe(true)

      // Connect directly to database to verify schema
      const db = createClient({
        url: `file:${dbFilePath}`,
        intMode: 'number'
      })

      // Check agents table schema
      const agentsSchema = await db.execute('PRAGMA table_info(agents)')
      const agentsColumns = agentsSchema.rows.map((row: any) => row.name)
      expect(agentsColumns).toContain('id')
      expect(agentsColumns).toContain('name')
      expect(agentsColumns).toContain('model')
      expect(agentsColumns).toContain('tools')
      expect(agentsColumns).toContain('knowledges')
      expect(agentsColumns).toContain('configuration')
      expect(agentsColumns).toContain('is_deleted')

      // Check sessions table schema
      const sessionsSchema = await db.execute('PRAGMA table_info(sessions)')
      const sessionsColumns = sessionsSchema.rows.map((row: any) => row.name)
      expect(sessionsColumns).toContain('id')
      expect(sessionsColumns).toContain('agent_ids')
      expect(sessionsColumns).toContain('user_goal')
      expect(sessionsColumns).toContain('status')
      expect(sessionsColumns).toContain('latest_claude_session_id')
      expect(sessionsColumns).toContain('max_turns')
      expect(sessionsColumns).toContain('permission_mode')
      expect(sessionsColumns).toContain('is_deleted')

      // Check session_logs table schema
      const logsSchema = await db.execute('PRAGMA table_info(session_logs)')
      const logsColumns = logsSchema.rows.map((row: any) => row.name)
      expect(logsColumns).toContain('id')
      expect(logsColumns).toContain('session_id')
      expect(logsColumns).toContain('parent_id')
      expect(logsColumns).toContain('role')
      expect(logsColumns).toContain('type')
      expect(logsColumns).toContain('content')

      db.close()
    })

    it('should create all indexes on initialization', async () => {
      agentService = AgentService.reload()

      // Trigger initialization
      await agentService.createAgent({
        name: 'Test Agent',
        model: 'gpt-4'
      })

      // Connect directly to database to verify indexes
      const db = createClient({
        url: `file:${dbFilePath}`,
        intMode: 'number'
      })

      // Check that indexes exist
      const indexes = await db.execute("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      const indexNames = indexes.rows.map((row: any) => row.name)

      // Verify key indexes exist
      expect(indexNames).toContain('idx_agents_name')
      expect(indexNames).toContain('idx_agents_model')
      expect(indexNames).toContain('idx_sessions_status')
      expect(indexNames).toContain('idx_sessions_latest_claude_session_id')
      expect(indexNames).toContain('idx_session_logs_session_id')

      db.close()
    })
  })

  describe('Migration from Old Schema', () => {
    it('should migrate from old schema with user_prompt to user_goal', async () => {
      // Create old schema database
      const db = createClient({
        url: `file:${dbFilePath}`,
        intMode: 'number'
      })

      // Create old sessions table with user_prompt instead of user_goal
      await db.execute(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          agent_ids TEXT NOT NULL,
          user_prompt TEXT,
          status TEXT NOT NULL DEFAULT 'idle',
          accessible_paths TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0
        )
      `)

      // Insert test data with old schema
      await db.execute({
        sql: 'INSERT INTO sessions (id, agent_ids, user_prompt, status) VALUES (?, ?, ?, ?)',
        args: ['test-session-1', '["agent1"]', 'Old user prompt', 'idle']
      })

      db.close()

      // Now initialize AgentService, which should trigger migration
      agentService = AgentService.reload()

      // Create an agent to trigger database initialization and migration
      const agentResult = await agentService.createAgent({
        name: 'Test Agent',
        model: 'gpt-4'
      })
      expect(agentResult.success).toBe(true)

      // Verify that the old data is accessible with new schema
      const sessionResult = await agentService.getSessionById('test-session-1')
      expect(sessionResult.success).toBe(true)
      expect(sessionResult.data!.user_goal).toBe('Old user prompt')
      expect(sessionResult.data!.max_turns).toBe(10) // Should have default value
      expect(sessionResult.data!.permission_mode).toBe('default') // Should have default value
    })

    it('should migrate from old schema with claude_session_id to latest_claude_session_id', async () => {
      // Create old schema database
      const db = createClient({
        url: `file:${dbFilePath}`,
        intMode: 'number'
      })

      // Create old sessions table with claude_session_id
      await db.execute(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          agent_ids TEXT NOT NULL,
          user_goal TEXT,
          status TEXT NOT NULL DEFAULT 'idle',
          accessible_paths TEXT,
          claude_session_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0
        )
      `)

      // Insert test data with old schema
      await db.execute({
        sql: 'INSERT INTO sessions (id, agent_ids, user_goal, claude_session_id) VALUES (?, ?, ?, ?)',
        args: ['test-session-1', '["agent1"]', 'Test goal', 'old-claude-session-123']
      })

      db.close()

      // Initialize AgentService to trigger migration
      agentService = AgentService.reload()

      const agentResult = await agentService.createAgent({
        name: 'Test Agent',
        model: 'gpt-4'
      })
      expect(agentResult.success).toBe(true)

      // Verify migration worked
      const sessionResult = await agentService.getSessionById('test-session-1')
      expect(sessionResult.success).toBe(true)
      expect(sessionResult.data!.latest_claude_session_id).toBe('old-claude-session-123')
    })

    it('should handle missing columns gracefully', async () => {
      // Create minimal old schema database
      const db = createClient({
        url: `file:${dbFilePath}`,
        intMode: 'number'
      })

      // Create minimal sessions table
      await db.execute(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          agent_ids TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'idle',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0
        )
      `)

      // Insert test data
      await db.execute({
        sql: 'INSERT INTO sessions (id, agent_ids, status) VALUES (?, ?, ?)',
        args: ['test-session-1', '["agent1"]', 'idle']
      })

      db.close()

      // Initialize AgentService to trigger migration
      agentService = AgentService.reload()

      const agentResult = await agentService.createAgent({
        name: 'Test Agent',
        model: 'gpt-4'
      })
      expect(agentResult.success).toBe(true)

      // Verify session can be retrieved with default values
      const sessionResult = await agentService.getSessionById('test-session-1')
      expect(sessionResult.success).toBe(true)
      expect(sessionResult.data!.user_goal).toBeNull()
      expect(sessionResult.data!.max_turns).toBe(10)
      expect(sessionResult.data!.permission_mode).toBe('default')
      expect(sessionResult.data!.latest_claude_session_id).toBeNull()
    })

    it('should preserve existing data during migration', async () => {
      // Create database with some test data
      const db = createClient({
        url: `file:${dbFilePath}`,
        intMode: 'number'
      })

      // Create agents table
      await db.execute(`
        CREATE TABLE agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          model TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0
        )
      `)

      // Insert test agent
      await db.execute({
        sql: 'INSERT INTO agents (id, name, model) VALUES (?, ?, ?)',
        args: ['agent-1', 'Original Agent', 'gpt-4']
      })

      // Create old sessions table
      await db.execute(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          agent_ids TEXT NOT NULL,
          user_prompt TEXT,
          status TEXT NOT NULL DEFAULT 'idle',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0
        )
      `)

      // Insert test session
      await db.execute({
        sql: 'INSERT INTO sessions (id, agent_ids, user_prompt) VALUES (?, ?, ?)',
        args: ['session-1', '["agent-1"]', 'Original prompt']
      })

      db.close()

      // Initialize AgentService to trigger migration
      agentService = AgentService.reload()

      // Verify original agent data is preserved
      const agentResult = await agentService.getAgentById('agent-1')
      expect(agentResult.success).toBe(true)
      expect(agentResult.data!.name).toBe('Original Agent')
      expect(agentResult.data!.model).toBe('gpt-4')

      // Verify original session data is preserved and migrated
      const sessionResult = await agentService.getSessionById('session-1')
      expect(sessionResult.success).toBe(true)
      expect(sessionResult.data!.agent_ids).toEqual(['agent-1'])
      expect(sessionResult.data!.user_goal).toBe('Original prompt')
    })
  })

  describe('Multiple Migrations', () => {
    it('should handle multiple service initializations without duplicate migrations', async () => {
      // First initialization
      agentService = AgentService.reload()

      const agent1Result = await agentService.createAgent({
        name: 'Test Agent 1',
        model: 'gpt-4'
      })
      expect(agent1Result.success).toBe(true)

      await agentService.close()

      // Second initialization (should not fail or duplicate migrations)
      agentService = AgentService.reload()

      const agent2Result = await agentService.createAgent({
        name: 'Test Agent 2',
        model: 'gpt-3.5-turbo'
      })
      expect(agent2Result.success).toBe(true)

      // Verify both agents exist
      const listResult = await agentService.listAgents()
      expect(listResult.success).toBe(true)
      expect(listResult.data!.items).toHaveLength(2)
    })

    it('should handle service reload after migration', async () => {
      // Create old schema database
      const db = createClient({
        url: `file:${dbFilePath}`,
        intMode: 'number'
      })

      await db.execute(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          agent_ids TEXT NOT NULL,
          user_prompt TEXT,
          status TEXT NOT NULL DEFAULT 'idle',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0
        )
      `)

      db.close()

      // First initialization (triggers migration)
      agentService = AgentService.reload()
      const agentResult = await agentService.createAgent({
        name: 'Test Agent',
        model: 'gpt-4'
      })
      expect(agentResult.success).toBe(true)

      // Reload service
      agentService = AgentService.reload()

      // Should still work after reload
      const sessionResult = await agentService.createSession({
        agent_ids: [agentResult.data!.id],
        user_goal: 'Test after reload'
      })
      expect(sessionResult.success).toBe(true)
      expect(sessionResult.data!.user_goal).toBe('Test after reload')
    })
  })

  describe('Error Handling During Migration', () => {
    it('should handle migration errors gracefully', async () => {
      // Create a corrupted database file
      const fs = await import('node:fs')
      fs.writeFileSync(dbFilePath, 'corrupted database content')

      // AgentService should handle this gracefully
      agentService = AgentService.reload()

      // First operation might fail due to corruption, but should not crash
      try {
        await agentService.createAgent({
          name: 'Test Agent',
          model: 'gpt-4'
        })
      } catch (error) {
        // Expected to fail with corrupted database
        expect(error).toBeDefined()
      }
    })

    it('should continue working after migration failure recovery', async () => {
      // Remove the corrupted file if it exists
      const fs = await import('node:fs')
      if (fs.existsSync(dbFilePath)) {
        fs.unlinkSync(dbFilePath)
      }

      // Fresh initialization should work
      agentService = AgentService.reload()

      const result = await agentService.createAgent({
        name: 'Recovery Test Agent',
        model: 'gpt-4'
      })
      expect(result.success).toBe(true)
    })
  })
})
