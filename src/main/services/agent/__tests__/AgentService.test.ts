import type {
  AgentEntity,
  CreateAgentInput,
  CreateSessionInput,
  CreateSessionLogInput,
  SessionEntity,
  UpdateAgentInput,
  UpdateSessionInput
} from '@types'
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

describe('AgentService', () => {
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

    // Get fresh instance and reload to ensure clean state
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
      console.warn('Failed to clean up test database:', error)
    }
  })

  describe('Agent CRUD Operations', () => {
    describe('createAgent', () => {
      it('should create a new agent with valid input', async () => {
        const input: CreateAgentInput = {
          name: 'Test Agent',
          description: 'A test agent',
          avatar: 'test-avatar.png',
          instructions: 'You are a helpful assistant',
          model: 'gpt-4',
          tools: ['web-search', 'calculator'],
          knowledges: ['kb1', 'kb2'],
          configuration: { temperature: 0.7, maxTokens: 1000 }
        }

        const result = await agentService.createAgent(input)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()

        const agent = result.data!
        expect(agent.id).toBeDefined()
        expect(agent.name).toBe(input.name)
        expect(agent.description).toBe(input.description)
        expect(agent.avatar).toBe(input.avatar)
        expect(agent.instructions).toBe(input.instructions)
        expect(agent.model).toBe(input.model)
        expect(agent.tools).toEqual(input.tools)
        expect(agent.knowledges).toEqual(input.knowledges)
        expect(agent.configuration).toEqual(input.configuration)
        expect(agent.created_at).toBeDefined()
        expect(agent.updated_at).toBeDefined()
      })

      it('should create agent with minimal required fields', async () => {
        const input: CreateAgentInput = {
          name: 'Minimal Agent',
          model: 'gpt-3.5-turbo'
        }

        const result = await agentService.createAgent(input)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()

        const agent = result.data!
        expect(agent.name).toBe(input.name)
        expect(agent.model).toBe(input.model)
        expect(agent.tools).toEqual([])
        expect(agent.knowledges).toEqual([])
        expect(agent.configuration).toEqual({})
      })

      it('should fail when name is missing', async () => {
        const input = {
          model: 'gpt-4'
        } as CreateAgentInput

        const result = await agentService.createAgent(input)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Agent name is required')
      })

      it('should fail when model is missing', async () => {
        const input = {
          name: 'Test Agent'
        } as CreateAgentInput

        const result = await agentService.createAgent(input)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Agent model is required')
      })

      it('should trim whitespace from inputs', async () => {
        const input: CreateAgentInput = {
          name: '  Test Agent  ',
          description: '  Test description  ',
          model: '  gpt-4  '
        }

        const result = await agentService.createAgent(input)

        expect(result.success).toBe(true)
        expect(result.data!.name).toBe('Test Agent')
        expect(result.data!.description).toBe('Test description')
        expect(result.data!.model).toBe('gpt-4')
      })
    })

    describe('getAgentById', () => {
      it('should retrieve an existing agent', async () => {
        // Create an agent first
        const createInput: CreateAgentInput = {
          name: 'Test Agent',
          model: 'gpt-4'
        }
        const createResult = await agentService.createAgent(createInput)
        expect(createResult.success).toBe(true)

        const agentId = createResult.data!.id

        // Retrieve the agent
        const result = await agentService.getAgentById(agentId)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.id).toBe(agentId)
        expect(result.data!.name).toBe(createInput.name)
        expect(result.data!.model).toBe(createInput.model)
      })

      it('should return error for non-existent agent', async () => {
        const result = await agentService.getAgentById('non-existent-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Agent not found')
      })
    })

    describe('updateAgent', () => {
      let testAgent: AgentEntity

      beforeEach(async () => {
        const createInput: CreateAgentInput = {
          name: 'Original Agent',
          description: 'Original description',
          model: 'gpt-4',
          tools: ['tool1'],
          knowledges: ['kb1'],
          configuration: { temperature: 0.8 }
        }
        const createResult = await agentService.createAgent(createInput)
        expect(createResult.success).toBe(true)
        testAgent = createResult.data!
      })

      it('should update agent with new values', async () => {
        const updateInput: UpdateAgentInput = {
          id: testAgent.id,
          name: 'Updated Agent',
          description: 'Updated description',
          model: 'gpt-3.5-turbo',
          tools: ['tool1', 'tool2'],
          knowledges: ['kb1', 'kb2'],
          configuration: { temperature: 0.5 }
        }

        const result = await agentService.updateAgent(updateInput)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()

        const updatedAgent = result.data!
        expect(updatedAgent.id).toBe(testAgent.id)
        expect(updatedAgent.name).toBe(updateInput.name)
        expect(updatedAgent.description).toBe(updateInput.description)
        expect(updatedAgent.model).toBe(updateInput.model)
        expect(updatedAgent.tools).toEqual(updateInput.tools)
        expect(updatedAgent.knowledges).toEqual(updateInput.knowledges)
        expect(updatedAgent.configuration).toEqual(updateInput.configuration)
        expect(updatedAgent.updated_at).not.toBe(testAgent.updated_at)
      })

      it('should update only specified fields', async () => {
        const updateInput: UpdateAgentInput = {
          id: testAgent.id,
          name: 'Partially Updated Agent'
        }

        const result = await agentService.updateAgent(updateInput)

        expect(result.success).toBe(true)
        expect(result.data!.name).toBe(updateInput.name)
        expect(result.data!.description).toBe(testAgent.description)
        expect(result.data!.model).toBe(testAgent.model)
      })

      it('should fail for non-existent agent', async () => {
        const updateInput: UpdateAgentInput = {
          id: 'non-existent-id',
          name: 'Updated Agent'
        }

        const result = await agentService.updateAgent(updateInput)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Agent not found')
      })
    })

    describe('listAgents', () => {
      beforeEach(async () => {
        // Create multiple test agents
        for (let i = 1; i <= 5; i++) {
          const input: CreateAgentInput = {
            name: `Test Agent ${i}`,
            model: 'gpt-4'
          }
          await agentService.createAgent(input)
        }
      })

      it('should list all agents', async () => {
        const result = await agentService.listAgents()

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.items).toHaveLength(5)
        expect(result.data!.total).toBe(5)
      })

      it('should support pagination', async () => {
        const result = await agentService.listAgents({ limit: 2, offset: 1 })

        expect(result.success).toBe(true)
        expect(result.data!.items).toHaveLength(2)
        expect(result.data!.total).toBe(5)
      })

      it('should return empty list when no agents exist', async () => {
        // Delete all agents first
        const listResult = await agentService.listAgents()
        for (const agent of listResult.data!.items) {
          await agentService.deleteAgent(agent.id)
        }

        const result = await agentService.listAgents()

        expect(result.success).toBe(true)
        expect(result.data!.items).toHaveLength(0)
        expect(result.data!.total).toBe(0)
      })
    })

    describe('deleteAgent', () => {
      let testAgent: AgentEntity

      beforeEach(async () => {
        const createInput: CreateAgentInput = {
          name: 'Agent to Delete',
          model: 'gpt-4'
        }
        const createResult = await agentService.createAgent(createInput)
        expect(createResult.success).toBe(true)
        testAgent = createResult.data!
      })

      it('should soft delete an agent', async () => {
        const result = await agentService.deleteAgent(testAgent.id)

        expect(result.success).toBe(true)

        // Verify agent is no longer retrievable
        const getResult = await agentService.getAgentById(testAgent.id)
        expect(getResult.success).toBe(false)
        expect(getResult.error).toContain('Agent not found')
      })

      it('should fail for non-existent agent', async () => {
        const result = await agentService.deleteAgent('non-existent-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Agent not found')
      })
    })
  })

  describe('Session CRUD Operations', () => {
    let testAgent: AgentEntity

    beforeEach(async () => {
      // Create a test agent for session operations
      const agentInput: CreateAgentInput = {
        name: 'Session Test Agent',
        model: 'gpt-4'
      }
      const agentResult = await agentService.createAgent(agentInput)
      expect(agentResult.success).toBe(true)
      testAgent = agentResult.data!
    })

    describe('createSession', () => {
      it('should create a new session with valid input', async () => {
        const input: CreateSessionInput = {
          agent_ids: [testAgent.id],
          user_goal: 'Help me write code',
          status: 'idle',
          accessible_paths: ['/home/user/project'],
          max_turns: 20,
          permission_mode: 'default'
        }

        const result = await agentService.createSession(input)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()

        const session = result.data!
        expect(session.id).toBeDefined()
        expect(session.agent_ids).toEqual(input.agent_ids)
        expect(session.user_goal).toBe(input.user_goal)
        expect(session.status).toBe(input.status)
        expect(session.accessible_paths).toEqual(input.accessible_paths)
        expect(session.max_turns).toBe(input.max_turns)
        expect(session.permission_mode).toBe(input.permission_mode)
        expect(session.created_at).toBeDefined()
        expect(session.updated_at).toBeDefined()
      })

      it('should create session with minimal required fields', async () => {
        const input: CreateSessionInput = {
          agent_ids: [testAgent.id]
        }

        const result = await agentService.createSession(input)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()

        const session = result.data!
        expect(session.agent_ids).toEqual(input.agent_ids)
        expect(session.status).toBe('idle')
        expect(session.max_turns).toBe(10)
        expect(session.permission_mode).toBe('default')
      })

      it('should fail when agent_ids is empty', async () => {
        const input: CreateSessionInput = {
          agent_ids: []
        }

        const result = await agentService.createSession(input)

        expect(result.success).toBe(false)
        expect(result.error).toContain('At least one agent ID is required')
      })

      it('should fail when agent does not exist', async () => {
        const input: CreateSessionInput = {
          agent_ids: ['non-existent-agent-id']
        }

        const result = await agentService.createSession(input)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Agent not found')
      })
    })

    describe('getSessionById', () => {
      it('should retrieve an existing session', async () => {
        const createInput: CreateSessionInput = {
          agent_ids: [testAgent.id],
          user_goal: 'Test session'
        }
        const createResult = await agentService.createSession(createInput)
        expect(createResult.success).toBe(true)

        const sessionId = createResult.data!.id

        const result = await agentService.getSessionById(sessionId)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.id).toBe(sessionId)
        expect(result.data!.agent_ids).toEqual(createInput.agent_ids)
      })

      it('should return error for non-existent session', async () => {
        const result = await agentService.getSessionById('non-existent-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Session not found')
      })
    })

    describe('updateSession', () => {
      let testSession: SessionEntity

      beforeEach(async () => {
        const createInput: CreateSessionInput = {
          agent_ids: [testAgent.id],
          user_goal: 'Original goal',
          status: 'idle'
        }
        const createResult = await agentService.createSession(createInput)
        expect(createResult.success).toBe(true)
        testSession = createResult.data!
      })

      it('should update session with new values', async () => {
        const updateInput: UpdateSessionInput = {
          id: testSession.id,
          user_goal: 'Updated goal',
          status: 'running',
          accessible_paths: ['/new/path'],
          max_turns: 15,
          permission_mode: 'acceptEdits'
        }

        const result = await agentService.updateSession(updateInput)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()

        const updatedSession = result.data!
        expect(updatedSession.id).toBe(testSession.id)
        expect(updatedSession.user_goal).toBe(updateInput.user_goal)
        expect(updatedSession.status).toBe(updateInput.status)
        expect(updatedSession.accessible_paths).toEqual(updateInput.accessible_paths)
        expect(updatedSession.max_turns).toBe(updateInput.max_turns)
        expect(updatedSession.permission_mode).toBe(updateInput.permission_mode)
      })

      it('should fail for non-existent session', async () => {
        const updateInput: UpdateSessionInput = {
          id: 'non-existent-id',
          status: 'running'
        }

        const result = await agentService.updateSession(updateInput)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Session not found')
      })
    })

    describe('updateSessionStatus', () => {
      let testSession: SessionEntity

      beforeEach(async () => {
        const createInput: CreateSessionInput = {
          agent_ids: [testAgent.id]
        }
        const createResult = await agentService.createSession(createInput)
        expect(createResult.success).toBe(true)
        testSession = createResult.data!
      })

      it('should update session status', async () => {
        const result = await agentService.updateSessionStatus(testSession.id, 'running')

        expect(result.success).toBe(true)

        // Verify status was updated
        const getResult = await agentService.getSessionById(testSession.id)
        expect(getResult.success).toBe(true)
        expect(getResult.data!.status).toBe('running')
      })

      it('should fail for non-existent session', async () => {
        const result = await agentService.updateSessionStatus('non-existent-id', 'running')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Session not found')
      })
    })

    describe('updateSessionClaudeId', () => {
      let testSession: SessionEntity

      beforeEach(async () => {
        const createInput: CreateSessionInput = {
          agent_ids: [testAgent.id]
        }
        const createResult = await agentService.createSession(createInput)
        expect(createResult.success).toBe(true)
        testSession = createResult.data!
      })

      it('should update Claude session ID', async () => {
        const claudeSessionId = 'claude-session-123'

        const result = await agentService.updateSessionClaudeId(testSession.id, claudeSessionId)

        expect(result.success).toBe(true)

        // Verify Claude session ID was updated
        const getResult = await agentService.getSessionById(testSession.id)
        expect(getResult.success).toBe(true)
        expect(getResult.data!.latest_claude_session_id).toBe(claudeSessionId)
      })

      it('should fail when session ID is missing', async () => {
        const result = await agentService.updateSessionClaudeId('', 'claude-session-123')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Session ID and Claude session ID are required')
      })

      it('should fail when Claude session ID is missing', async () => {
        const result = await agentService.updateSessionClaudeId(testSession.id, '')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Session ID and Claude session ID are required')
      })
    })

    describe('getSessionWithAgent', () => {
      let testSession: SessionEntity

      beforeEach(async () => {
        const createInput: CreateSessionInput = {
          agent_ids: [testAgent.id]
        }
        const createResult = await agentService.createSession(createInput)
        expect(createResult.success).toBe(true)
        testSession = createResult.data!
      })

      it('should retrieve session with associated agent data', async () => {
        const result = await agentService.getSessionWithAgent(testSession.id)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.session).toBeDefined()
        expect(result.data!.agent).toBeDefined()

        expect(result.data!.session.id).toBe(testSession.id)
        expect(result.data!.agent!.id).toBe(testAgent.id)
        expect(result.data!.agent!.name).toBe(testAgent.name)
      })

      it('should fail for non-existent session', async () => {
        const result = await agentService.getSessionWithAgent('non-existent-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Session not found')
      })
    })

    describe('getSessionByClaudeId', () => {
      let testSession: SessionEntity

      beforeEach(async () => {
        const createInput: CreateSessionInput = {
          agent_ids: [testAgent.id]
        }
        const createResult = await agentService.createSession(createInput)
        expect(createResult.success).toBe(true)
        testSession = createResult.data!

        // Set Claude session ID
        await agentService.updateSessionClaudeId(testSession.id, 'claude-session-123')
      })

      it('should retrieve session by Claude session ID', async () => {
        const result = await agentService.getSessionByClaudeId('claude-session-123')

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.id).toBe(testSession.id)
        expect(result.data!.latest_claude_session_id).toBe('claude-session-123')
      })

      it('should fail for non-existent Claude session ID', async () => {
        const result = await agentService.getSessionByClaudeId('non-existent-claude-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Session not found')
      })

      it('should fail when Claude session ID is empty', async () => {
        const result = await agentService.getSessionByClaudeId('')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Claude session ID is required')
      })
    })

    describe('listSessions', () => {
      beforeEach(async () => {
        // Create multiple test sessions
        for (let i = 1; i <= 3; i++) {
          const input: CreateSessionInput = {
            agent_ids: [testAgent.id],
            user_goal: `Test session ${i}`,
            status: i === 2 ? 'running' : 'idle'
          }
          await agentService.createSession(input)
        }
      })

      it('should list all sessions', async () => {
        const result = await agentService.listSessions()

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.items).toHaveLength(3)
        expect(result.data!.total).toBe(3)
      })

      it('should filter sessions by status', async () => {
        const result = await agentService.listSessions({ status: 'running' })

        expect(result.success).toBe(true)
        expect(result.data!.items).toHaveLength(1)
        expect(result.data!.items[0].status).toBe('running')
      })

      it('should support pagination', async () => {
        const result = await agentService.listSessions({ limit: 2, offset: 1 })

        expect(result.success).toBe(true)
        expect(result.data!.items).toHaveLength(2)
        expect(result.data!.total).toBe(3)
      })
    })

    describe('deleteSession', () => {
      let testSession: SessionEntity

      beforeEach(async () => {
        const createInput: CreateSessionInput = {
          agent_ids: [testAgent.id]
        }
        const createResult = await agentService.createSession(createInput)
        expect(createResult.success).toBe(true)
        testSession = createResult.data!
      })

      it('should soft delete a session', async () => {
        const result = await agentService.deleteSession(testSession.id)

        expect(result.success).toBe(true)

        // Verify session is no longer retrievable
        const getResult = await agentService.getSessionById(testSession.id)
        expect(getResult.success).toBe(false)
        expect(getResult.error).toContain('Session not found')
      })

      it('should fail for non-existent session', async () => {
        const result = await agentService.deleteSession('non-existent-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Session not found')
      })
    })
  })

  describe('Session Log CRUD Operations', () => {
    let testSession: SessionEntity

    beforeEach(async () => {
      // Create a test agent and session for log operations
      const agentInput: CreateAgentInput = {
        name: 'Log Test Agent',
        model: 'gpt-4'
      }
      const agentResult = await agentService.createAgent(agentInput)
      expect(agentResult.success).toBe(true)

      const sessionInput: CreateSessionInput = {
        agent_ids: [agentResult.data!.id]
      }
      const sessionResult = await agentService.createSession(sessionInput)
      expect(sessionResult.success).toBe(true)
      testSession = sessionResult.data!
    })

    describe('addSessionLog', () => {
      it('should add a log entry to session', async () => {
        const input: CreateSessionLogInput = {
          session_id: testSession.id,
          role: 'user',
          type: 'message',
          content: { text: 'Hello, how are you?' }
        }

        const result = await agentService.addSessionLog(input)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()

        const log = result.data!
        expect(log.id).toBeDefined()
        expect(log.session_id).toBe(input.session_id)
        expect(log.role).toBe(input.role)
        expect(log.type).toBe(input.type)
        expect(log.content).toEqual(input.content)
        expect(log.created_at).toBeDefined()
      })

      it('should add log entry with parent_id for threading', async () => {
        // Create parent log first
        const parentInput: CreateSessionLogInput = {
          session_id: testSession.id,
          role: 'user',
          type: 'message',
          content: { text: 'Parent message' }
        }
        const parentResult = await agentService.addSessionLog(parentInput)
        expect(parentResult.success).toBe(true)

        // Create child log
        const childInput: CreateSessionLogInput = {
          session_id: testSession.id,
          parent_id: parentResult.data!.id,
          role: 'agent',
          type: 'message',
          content: { text: 'Child response' }
        }
        const childResult = await agentService.addSessionLog(childInput)

        expect(childResult.success).toBe(true)
        expect(childResult.data!.parent_id).toBe(parentResult.data!.id)
      })

      it('should support different content types', async () => {
        const inputs: CreateSessionLogInput[] = [
          {
            session_id: testSession.id,
            role: 'agent',
            type: 'thought',
            content: { text: 'I need to analyze this request', reasoning: 'User asking for help' }
          },
          {
            session_id: testSession.id,
            role: 'agent',
            type: 'action',
            content: {
              tool: 'web-search',
              input: { query: 'TypeScript examples' },
              description: 'Searching for examples'
            }
          },
          {
            session_id: testSession.id,
            role: 'system',
            type: 'observation',
            content: { result: { data: 'search results' }, success: true }
          }
        ]

        for (const input of inputs) {
          const result = await agentService.addSessionLog(input)
          expect(result.success).toBe(true)
          expect(result.data!.type).toBe(input.type)
          expect(result.data!.content).toEqual(input.content)
        }
      })
    })

    describe('getSessionLogs', () => {
      beforeEach(async () => {
        // Create multiple test logs
        for (let i = 1; i <= 5; i++) {
          const input: CreateSessionLogInput = {
            session_id: testSession.id,
            role: i % 2 === 1 ? 'user' : 'agent',
            type: 'message',
            content: { text: `Message ${i}` }
          }
          await agentService.addSessionLog(input)
        }
      })

      it('should retrieve all logs for a session', async () => {
        const result = await agentService.getSessionLogs({ session_id: testSession.id })

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data!.items).toHaveLength(5)
        expect(result.data!.total).toBe(5)

        // Verify logs are ordered by creation time
        const logs = result.data!.items
        for (let i = 1; i < logs.length; i++) {
          expect(new Date(logs[i].created_at).getTime()).toBeGreaterThanOrEqual(
            new Date(logs[i - 1].created_at).getTime()
          )
        }
      })

      it('should support pagination', async () => {
        const result = await agentService.getSessionLogs({
          session_id: testSession.id,
          limit: 2,
          offset: 1
        })

        expect(result.success).toBe(true)
        expect(result.data!.items).toHaveLength(2)
        expect(result.data!.total).toBe(5)
      })

      it('should return empty list for session with no logs', async () => {
        // Create a new session without logs
        const agentInput: CreateAgentInput = {
          name: 'Empty Log Agent',
          model: 'gpt-4'
        }
        const agentResult = await agentService.createAgent(agentInput)

        const sessionInput: CreateSessionInput = {
          agent_ids: [agentResult.data!.id]
        }
        const sessionResult = await agentService.createSession(sessionInput)

        const result = await agentService.getSessionLogs({
          session_id: sessionResult.data!.id
        })

        expect(result.success).toBe(true)
        expect(result.data!.items).toHaveLength(0)
        expect(result.data!.total).toBe(0)
      })
    })

    describe('clearSessionLogs', () => {
      beforeEach(async () => {
        // Create test logs
        for (let i = 1; i <= 3; i++) {
          const input: CreateSessionLogInput = {
            session_id: testSession.id,
            role: 'user',
            type: 'message',
            content: { text: `Message ${i}` }
          }
          await agentService.addSessionLog(input)
        }
      })

      it('should clear all logs for a session', async () => {
        // Verify logs exist
        const beforeResult = await agentService.getSessionLogs({ session_id: testSession.id })
        expect(beforeResult.data!.items).toHaveLength(3)

        // Clear logs
        const result = await agentService.clearSessionLogs(testSession.id)
        expect(result.success).toBe(true)

        // Verify logs are cleared
        const afterResult = await agentService.getSessionLogs({ session_id: testSession.id })
        expect(afterResult.data!.items).toHaveLength(0)
        expect(afterResult.data!.total).toBe(0)
      })
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

    it('should close database connection properly', async () => {
      await agentService.close()

      // Should be able to reinitialize after close
      const result = await agentService.listAgents()
      expect(result.success).toBe(true)
    })
  })
})
