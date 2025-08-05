import type { AgentEntity, SessionEntity } from '@types'
import { EventEmitter } from 'events'
import fs from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock shell environment function
const mockGetLoginShellEnvironment = vi.fn(() => {
  console.log('getLoginShellEnvironment mock called')
  return Promise.resolve({ PATH: '/usr/bin:/bin', PYTHONUNBUFFERED: '1' })
})

import { AgentExecutionService } from '../AgentExecutionService'

// Mock child_process
const mockProcess = new EventEmitter() as any
mockProcess.stdout = new EventEmitter()
mockProcess.stderr = new EventEmitter()
mockProcess.pid = 12345
mockProcess.killed = false
mockProcess.kill = vi.fn()

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockProcess)
}))

// Mock fs
vi.mock('fs', () => ({
  default: {
    promises: {
      stat: vi.fn(),
      mkdir: vi.fn()
    }
  }
}))

// Mock os
vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/test/home')
  }
}))

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  },
  app: {
    getPath: vi.fn(() => '/test/userData')
  }
}))

// Mock utils
vi.mock('@main/utils', () => ({
  getDataPath: vi.fn(() => '/test/data'),
  getResourcePath: vi.fn(() => '/test/resources')
}))

// Mock logger
vi.mock('@logger', () => ({
  loggerService: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      verbose: vi.fn(),
      debug: vi.fn()
    }))
  }
}))

// Mock AgentService
const mockAgentService = {
  getSessionById: vi.fn(),
  getAgentById: vi.fn(),
  updateSessionStatus: vi.fn(),
  addSessionLog: vi.fn()
}

vi.mock('../AgentService', () => ({
  default: {
    getInstance: vi.fn(() => mockAgentService)
  }
}))

describe('AgentExecutionService - Core Functionality', () => {
  let service: AgentExecutionService
  let mockAgent: AgentEntity
  let mockSession: SessionEntity

  beforeEach(() => {
    vi.clearAllMocks()

    // Create test data
    mockAgent = {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'Test agent description',
      avatar: 'test-avatar.png',
      instructions: 'You are a helpful assistant',
      model: 'claude-3-5-sonnet-20241022',
      tools: ['web-search'],
      knowledges: ['test-kb'],
      configuration: { temperature: 0.7 },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    mockSession = {
      id: 'session-1',
      agent_ids: ['agent-1'],
      user_goal: 'Test goal',
      status: 'idle',
      accessible_paths: ['/test/workspace'],
      latest_claude_session_id: undefined,
      max_turns: 10,
      permission_mode: 'default',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    // Setup default mocks
    vi.mocked(fs.promises.stat).mockResolvedValue({ isFile: () => true } as any)
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)

    mockAgentService.getSessionById.mockImplementation(() => {
      console.log('getSessionById mock called')
      return Promise.resolve({ success: true, data: mockSession })
    })
    mockAgentService.getAgentById.mockImplementation(() => {
      console.log('getAgentById mock called')
      return Promise.resolve({ success: true, data: mockAgent })
    })
    mockAgentService.updateSessionStatus.mockImplementation(() => {
      console.log('updateSessionStatus mock called')
      return Promise.resolve({ success: true })
    })
    mockAgentService.addSessionLog.mockImplementation(() => {
      console.log('addSessionLog mock called')
      return Promise.resolve({ success: true })
    })

    service = AgentExecutionService.getTestInstance(mockGetLoginShellEnvironment)
  })

  describe('Basic Functionality', () => {
    it('should create a singleton instance', () => {
      const instance1 = AgentExecutionService.getInstance()
      const instance2 = AgentExecutionService.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should validate arguments correctly', async () => {
      const invalidSessionResult = await service.runAgent('', 'Test prompt')
      expect(invalidSessionResult.success).toBe(false)
      expect(invalidSessionResult.error).toBe('Invalid session ID provided')

      const invalidPromptResult = await service.runAgent('session-1', '   ')
      expect(invalidPromptResult.success).toBe(false)
      expect(invalidPromptResult.error).toBe('Invalid prompt provided')
    })

    it('should handle missing agent script', async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error('File not found'))

      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Agent script not found: /test/resources/agents/claude_code_agent.py')
    })

    it('should handle missing session', async () => {
      mockAgentService.getSessionById.mockResolvedValue({ success: false, error: 'Session not found' })

      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Session not found')
    })

    it('should successfully start agent execution', async () => {
      const { spawn } = await import('child_process')

      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(true)
      expect(spawn).toHaveBeenCalledWith(
        'uv',
        expect.arrayContaining([
          'run',
          '--script',
          '/test/resources/agents/claude_code_agent.py',
          '--prompt',
          'Test prompt'
        ]),
        expect.any(Object)
      )

      expect(mockAgentService.updateSessionStatus).toHaveBeenCalledWith('session-1', 'running')
    })
  })

  describe('Process Management', () => {
    it('should track running processes', async () => {
      await service.runAgent('session-1', 'Test prompt')

      const info = service.getRunningProcessInfo('session-1')
      expect(info.isRunning).toBe(true)
      expect(info.pid).toBe(12345)

      const sessions = service.getRunningSessions()
      expect(sessions).toContain('session-1')
    })

    it('should handle process not found for stop', async () => {
      const result = await service.stopAgent('non-existent-session')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No running process found for this session')
    })

    it('should successfully stop a running agent', async () => {
      await service.runAgent('session-1', 'Test prompt')

      const result = await service.stopAgent('session-1')

      expect(result.success).toBe(true)
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(mockAgentService.updateSessionStatus).toHaveBeenCalledWith('session-1', 'stopped')
    })
  })
})
