import type { AgentEntity, SessionEntity } from '@types'
import { EventEmitter } from 'events'
import fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock shell environment function
const mockGetLoginShellEnvironment = vi.fn(() => {
  return Promise.resolve({ PATH: '/usr/bin:/bin', PYTHONUNBUFFERED: '1' })
})

import { AgentExecutionService } from '../AgentExecutionService'

// Mock child_process
const mockProcess = new EventEmitter() as any
mockProcess.stdout = new EventEmitter()
mockProcess.stderr = new EventEmitter()
mockProcess.pid = 12345
mockProcess.kill = vi.fn()

// Define killed as a configurable property
Object.defineProperty(mockProcess, 'killed', {
  writable: true,
  configurable: true,
  value: false
})

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

// Create mock window
const mockWindow = {
  isDestroyed: vi.fn(() => false),
  webContents: {
    send: vi.fn()
  }
}

// Mock electron for both import and require
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [mockWindow])
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

describe('AgentExecutionService - Working Tests', () => {
  let service: AgentExecutionService
  let mockAgent: AgentEntity
  let mockSession: SessionEntity

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock process state
    mockProcess.killed = false
    // Remove listeners to prevent memory leaks in tests
    mockProcess.removeAllListeners()
    mockProcess.stdout.removeAllListeners()
    mockProcess.stderr.removeAllListeners()
    
    // Increase max listeners to prevent warnings
    mockProcess.setMaxListeners(20)
    mockProcess.stdout.setMaxListeners(20)
    mockProcess.stderr.setMaxListeners(20)
    

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
    
    mockAgentService.getSessionById.mockResolvedValue({ success: true, data: mockSession })
    mockAgentService.getAgentById.mockResolvedValue({ success: true, data: mockAgent })
    mockAgentService.updateSessionStatus.mockResolvedValue({ success: true })
    mockAgentService.addSessionLog.mockResolvedValue({ success: true })

    service = AgentExecutionService.getTestInstance(mockGetLoginShellEnvironment)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AgentExecutionService.getInstance()
      const instance2 = AgentExecutionService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('runAgent', () => {
    it('should successfully start agent execution', async () => {
      const { spawn } = await import('child_process')
      
      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(true)
      expect(spawn).toHaveBeenCalledWith('uv', [
        'run',
        '--script',
        '/test/resources/agents/claude_code_agent.py',
        '--prompt',
        'Test prompt',
        '--system-prompt',
        'You are a helpful assistant',
        '--cwd',
        '/test/workspace',
        '--permission-mode',
        'default',
        '--max-turns',
        '10'
      ], {
        cwd: '/test/workspace',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({
          PYTHONUNBUFFERED: '1'
        })
      })

      expect(mockAgentService.updateSessionStatus).toHaveBeenCalledWith('session-1', 'running')
    })

    it('should use existing Claude session ID when available', async () => {
      const { spawn } = await import('child_process')
      
      mockSession.latest_claude_session_id = 'claude-session-123'
      mockAgentService.getSessionById.mockResolvedValue({ success: true, data: mockSession })

      await service.runAgent('session-1', 'Test prompt')

      expect(spawn).toHaveBeenCalledWith('uv', [
        'run',
        '--script',
        '/test/resources/agents/claude_code_agent.py',
        '--prompt',
        'Test prompt',
        '--session-id',
        'claude-session-123'
      ], expect.any(Object))
    })

    it('should use default working directory when no accessible paths', async () => {
      mockSession.accessible_paths = []
      mockAgentService.getSessionById.mockResolvedValue({ success: true, data: mockSession })

      await service.runAgent('session-1', 'Test prompt')

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        '/test/data/agent-sessions/session-1',
        { recursive: true }
      )
    })

    it('should validate arguments and return error for invalid sessionId', async () => {
      const result = await service.runAgent('', 'Test prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid session ID provided')
    })

    it('should validate arguments and return error for invalid prompt', async () => {
      const result = await service.runAgent('session-1', '   ')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid prompt provided')
    })

    it('should return error when agent script does not exist', async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error('File not found'))

      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Agent script not found: /test/resources/agents/claude_code_agent.py')
    })

    it('should return error when session not found', async () => {
      mockAgentService.getSessionById.mockResolvedValue({ success: false, error: 'Session not found' })

      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Session not found')
    })

    it('should return error when agent not found', async () => {
      mockAgentService.getAgentById.mockResolvedValue({ success: false, error: 'Agent not found' })

      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Agent not found')
    })

    it('should return error when session has no agents', async () => {
      mockSession.agent_ids = []
      mockAgentService.getSessionById.mockResolvedValue({ success: true, data: mockSession })

      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No agents associated with session')
    })
  })

  describe('Process Management', () => {
    beforeEach(async () => {
      // Start an agent to have a running process
      await service.runAgent('session-1', 'Test prompt')
    })

    it('should track running processes', () => {
      const info = service.getRunningProcessInfo('session-1')
      expect(info.isRunning).toBe(true)
      expect(info.pid).toBe(12345)
    })

    it('should list running sessions', () => {
      const sessions = service.getRunningSessions()
      expect(sessions).toContain('session-1')
    })

    it('should handle stdout data', () => {
      mockProcess.stdout.emit('data', Buffer.from('Test stdout output'))

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:execution-output', {
        sessionId: 'session-1',
        type: 'stdout',
        data: 'Test stdout output',
        timestamp: expect.any(Number)
      })
    })

    it('should handle stderr data', () => {
      mockProcess.stderr.emit('data', Buffer.from('Test stderr output'))

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:execution-output', {
        sessionId: 'session-1',
        type: 'stderr',
        data: 'Test stderr output',
        timestamp: expect.any(Number)
      })
    })

    it('should handle process exit with success', async () => {
      mockProcess.emit('exit', 0, null)

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockAgentService.updateSessionStatus).toHaveBeenCalledWith('session-1', 'completed')
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:execution-complete', {
        sessionId: 'session-1',
        exitCode: 0,
        success: true,
        timestamp: expect.any(Number)
      })
    })

    it('should handle process exit with failure', async () => {
      mockProcess.emit('exit', 1, null)

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockAgentService.updateSessionStatus).toHaveBeenCalledWith('session-1', 'failed')
    })

    it('should handle process error', async () => {
      const error = new Error('Process error')
      mockProcess.emit('error', error)

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockAgentService.updateSessionStatus).toHaveBeenCalledWith('session-1', 'failed')
    })
  })

  describe('stopAgent', () => {
    beforeEach(async () => {
      await service.runAgent('session-1', 'Test prompt')
    })

    it('should successfully stop a running agent', async () => {
      const result = await service.stopAgent('session-1')

      expect(result.success).toBe(true)
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(mockAgentService.updateSessionStatus).toHaveBeenCalledWith('session-1', 'stopped')
    })

    it('should return error when no running process found', async () => {
      const result = await service.stopAgent('non-existent-session')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No running process found for this session')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully in addSessionLog', async () => {
      mockAgentService.addSessionLog.mockResolvedValue({ success: false, error: 'Database error' })

      await service.runAgent('session-1', 'Test prompt')
      mockProcess.stdout.emit('data', Buffer.from('Test output'))

      // Test should complete without throwing
    })

    it('should handle IPC streaming errors gracefully', async () => {
      const { BrowserWindow } = await import('electron')
      vi.mocked(BrowserWindow.getAllWindows).mockImplementation(() => {
        throw new Error('IPC error')
      })

      await service.runAgent('session-1', 'Test prompt')
      mockProcess.stdout.emit('data', Buffer.from('Test output'))

      // Test should complete without throwing
    })

    it('should handle working directory creation failure', async () => {
      vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error('Permission denied'))

      const result = await service.runAgent('session-1', 'Test prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create working directory')
    })

    it('should update session status correctly on execution error', async () => {
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('Spawn error')
      })

      const result = await service.runAgent('session-1', 'Test prompt')

      // When spawn throws, runAgent should return failure
      expect(result.success).toBe(false)
      expect(result.error).toBe('Spawn error')
    })
  })
})