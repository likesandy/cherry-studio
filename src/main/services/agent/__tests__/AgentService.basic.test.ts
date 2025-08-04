import type { CreateAgentInput, CreateSessionInput, CreateSessionLogInput } from '@types'
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

describe('AgentService Basic CRUD Tests', () => {
  let agentService: AgentService
  let testDbPath: string

  beforeEach(async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')

    // Create a unique test database path for each test
    testDbPath = path.join(os.tmpdir(), `test-agent-db-${Date.now()}-${Math.random()}`)

    // Import and mock app.getPath after module is loaded
    const { app } = await import('electron')
    vi.mocked(app.getPath).mockReturnValue(testDbPath)

    // Ensure directory exists
    fs.mkdirSync(testDbPath, { recursive: true })

    // Get fresh instance
    agentService = AgentService.reload()
  })

  afterEach(async () => {
    // Close database connection if exists
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
      // Ignore cleanup errors
    }
  })

  describe('Agent Operations', () => {
    it('should create and retrieve an agent', async () => {
      const input: CreateAgentInput = {
        name: 'Test Agent',
        model: 'gpt-4',
        description: 'A test agent',
        tools: ['tool1'],
        knowledges: ['kb1'],
        configuration: { temperature: 0.7 }
      }

      // Create agent
      const createResult = await agentService.createAgent(input)
      expect(createResult.success).toBe(true)
      expect(createResult.data).toBeDefined()

      const agent = createResult.data!
      expect(agent.id).toBeDefined()
      expect(agent.name).toBe(input.name)
      expect(agent.model).toBe(input.model)
      expect(agent.description).toBe(input.description)
      expect(agent.tools).toEqual(input.tools)
      expect(agent.knowledges).toEqual(input.knowledges)
      expect(agent.configuration).toEqual(input.configuration)

      // Retrieve agent
      const getResult = await agentService.getAgentById(agent.id)
      expect(getResult.success).toBe(true)
      expect(getResult.data!.id).toBe(agent.id)
      expect(getResult.data!.name).toBe(input.name)
    })

    it('should fail to create agent without required fields', async () => {
      const inputWithoutName = {
        model: 'gpt-4'
      } as CreateAgentInput

      const result = await agentService.createAgent(inputWithoutName)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Agent name is required')
    })

    it('should list agents', async () => {
      // Create multiple agents
      await agentService.createAgent({ name: 'Agent 1', model: 'gpt-4' })
      await agentService.createAgent({ name: 'Agent 2', model: 'gpt-3.5-turbo' })

      const result = await agentService.listAgents()
      expect(result.success).toBe(true)
      expect(result.data!.items).toHaveLength(2)
      expect(result.data!.total).toBe(2)
    })

    it('should update an agent', async () => {
      // Create agent
      const createResult = await agentService.createAgent({
        name: 'Original Agent',
        model: 'gpt-4'
      })
      expect(createResult.success).toBe(true)

      const agentId = createResult.data!.id

      // Update agent
      const updateResult = await agentService.updateAgent({
        id: agentId,
        name: 'Updated Agent',
        description: 'Updated description'
      })
      expect(updateResult.success).toBe(true)
      expect(updateResult.data!.name).toBe('Updated Agent')
      expect(updateResult.data!.description).toBe('Updated description')
      expect(updateResult.data!.model).toBe('gpt-4') // Should remain unchanged
    })

    it('should delete an agent', async () => {
      // Create agent
      const createResult = await agentService.createAgent({
        name: 'Agent to Delete',
        model: 'gpt-4'
      })
      expect(createResult.success).toBe(true)

      const agentId = createResult.data!.id

      // Delete agent
      const deleteResult = await agentService.deleteAgent(agentId)
      expect(deleteResult.success).toBe(true)

      // Verify agent is no longer retrievable
      const getResult = await agentService.getAgentById(agentId)
      expect(getResult.success).toBe(false)
      expect(getResult.error).toContain('Agent not found')
    })
  })

  describe('Session Operations', () => {
    let testAgentId: string

    beforeEach(async () => {
      // Create a test agent for session operations
      const agentResult = await agentService.createAgent({
        name: 'Session Test Agent',
        model: 'gpt-4'
      })
      expect(agentResult.success).toBe(true)
      testAgentId = agentResult.data!.id
    })

    it('should create and retrieve a session', async () => {
      const input: CreateSessionInput = {
        agent_ids: [testAgentId],
        user_goal: 'Test goal',
        status: 'idle',
        max_turns: 15,
        permission_mode: 'default'
      }

      // Create session
      const createResult = await agentService.createSession(input)
      expect(createResult.success).toBe(true)
      expect(createResult.data).toBeDefined()

      const session = createResult.data!
      expect(session.id).toBeDefined()
      expect(session.agent_ids).toEqual(input.agent_ids)
      expect(session.user_goal).toBe(input.user_goal)
      expect(session.status).toBe(input.status)
      expect(session.max_turns).toBe(input.max_turns)
      expect(session.permission_mode).toBe(input.permission_mode)

      // Retrieve session
      const getResult = await agentService.getSessionById(session.id)
      expect(getResult.success).toBe(true)
      expect(getResult.data!.id).toBe(session.id)
      expect(getResult.data!.user_goal).toBe(input.user_goal)
    })

    it('should create session with minimal fields', async () => {
      const input: CreateSessionInput = {
        agent_ids: [testAgentId]
      }

      const result = await agentService.createSession(input)
      expect(result.success).toBe(true)

      const session = result.data!
      expect(session.agent_ids).toEqual(input.agent_ids)
      expect(session.status).toBe('idle')
      expect(session.max_turns).toBe(10)
      expect(session.permission_mode).toBe('default')
    })

    it('should update session status', async () => {
      // Create session
      const createResult = await agentService.createSession({
        agent_ids: [testAgentId]
      })
      expect(createResult.success).toBe(true)

      const sessionId = createResult.data!.id

      // Update status
      const updateResult = await agentService.updateSessionStatus(sessionId, 'running')
      expect(updateResult.success).toBe(true)

      // Verify status was updated
      const getResult = await agentService.getSessionById(sessionId)
      expect(getResult.success).toBe(true)
      expect(getResult.data!.status).toBe('running')
    })

    it('should update Claude session ID', async () => {
      // Create session
      const createResult = await agentService.createSession({
        agent_ids: [testAgentId]
      })
      expect(createResult.success).toBe(true)

      const sessionId = createResult.data!.id
      const claudeSessionId = 'claude-session-123'

      // Update Claude session ID
      const updateResult = await agentService.updateSessionClaudeId(sessionId, claudeSessionId)
      expect(updateResult.success).toBe(true)

      // Verify Claude session ID was updated
      const getResult = await agentService.getSessionById(sessionId)
      expect(getResult.success).toBe(true)
      expect(getResult.data!.latest_claude_session_id).toBe(claudeSessionId)
    })

    it('should get session with agent data', async () => {
      // Create session
      const createResult = await agentService.createSession({
        agent_ids: [testAgentId]
      })
      expect(createResult.success).toBe(true)

      const sessionId = createResult.data!.id

      // Get session with agent
      const result = await agentService.getSessionWithAgent(sessionId)
      expect(result.success).toBe(true)
      expect(result.data!.session).toBeDefined()
      expect(result.data!.agent).toBeDefined()
      expect(result.data!.session.id).toBe(sessionId)
      expect(result.data!.agent!.id).toBe(testAgentId)
    })
  })

  describe('Session Log Operations', () => {
    let testSessionId: string

    beforeEach(async () => {
      // Create a test agent and session for log operations
      const agentResult = await agentService.createAgent({
        name: 'Log Test Agent',
        model: 'gpt-4'
      })
      expect(agentResult.success).toBe(true)

      const sessionResult = await agentService.createSession({
        agent_ids: [agentResult.data!.id]
      })
      expect(sessionResult.success).toBe(true)
      testSessionId = sessionResult.data!.id
    })

    it('should add and retrieve session logs', async () => {
      const input: CreateSessionLogInput = {
        session_id: testSessionId,
        role: 'user',
        type: 'message',
        content: { text: 'Hello, how are you?' }
      }

      // Add log
      const addResult = await agentService.addSessionLog(input)
      expect(addResult.success).toBe(true)
      expect(addResult.data).toBeDefined()

      const log = addResult.data!
      expect(log.id).toBeDefined()
      expect(log.session_id).toBe(input.session_id)
      expect(log.role).toBe(input.role)
      expect(log.type).toBe(input.type)
      expect(log.content).toEqual(input.content)

      // Retrieve logs
      const getResult = await agentService.getSessionLogs({ session_id: testSessionId })
      expect(getResult.success).toBe(true)
      expect(getResult.data!.items).toHaveLength(1)
      expect(getResult.data!.items[0].id).toBe(log.id)
    })

    it('should support different log types', async () => {
      const logs: CreateSessionLogInput[] = [
        {
          session_id: testSessionId,
          role: 'user',
          type: 'message',
          content: { text: 'User message' }
        },
        {
          session_id: testSessionId,
          role: 'agent',
          type: 'thought',
          content: { text: 'Agent thinking', reasoning: 'Need to process this' }
        },
        {
          session_id: testSessionId,
          role: 'system',
          type: 'observation',
          content: { result: { data: 'some result' }, success: true }
        }
      ]

      // Add all logs
      for (const logInput of logs) {
        const result = await agentService.addSessionLog(logInput)
        expect(result.success).toBe(true)
      }

      // Retrieve all logs
      const getResult = await agentService.getSessionLogs({ session_id: testSessionId })
      expect(getResult.success).toBe(true)
      expect(getResult.data!.items).toHaveLength(3)
      expect(getResult.data!.total).toBe(3)
    })

    it('should clear session logs', async () => {
      // Add some logs
      await agentService.addSessionLog({
        session_id: testSessionId,
        role: 'user',
        type: 'message',
        content: { text: 'Message 1' }
      })
      await agentService.addSessionLog({
        session_id: testSessionId,
        role: 'user',
        type: 'message',
        content: { text: 'Message 2' }
      })

      // Verify logs exist
      const beforeResult = await agentService.getSessionLogs({ session_id: testSessionId })
      expect(beforeResult.data!.items).toHaveLength(2)

      // Clear logs
      const clearResult = await agentService.clearSessionLogs(testSessionId)
      expect(clearResult.success).toBe(true)

      // Verify logs are cleared
      const afterResult = await agentService.getSessionLogs({ session_id: testSessionId })
      expect(afterResult.data!.items).toHaveLength(0)
      expect(afterResult.data!.total).toBe(0)
    })
  })

  describe('Service Management', () => {
    it('should support singleton pattern', () => {
      const instance1 = AgentService.getInstance()
      const instance2 = AgentService.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should support service reload', () => {
      const instance1 = AgentService.getInstance()
      const instance2 = AgentService.reload()

      expect(instance1).not.toBe(instance2)
    })
  })
})
