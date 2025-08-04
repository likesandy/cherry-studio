import { loggerService } from '@logger'
import { getDataPath, getResourcePath } from '@main/utils'
import type {
  AgentEntity,
  CreateSessionLogInput,
  ExecutionCompleteContent,
  ExecutionInterruptContent,
  ExecutionStartContent,
  ServiceResult,
  SessionEntity
} from '@types'
import { ChildProcess, spawn } from 'child_process'
import { BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'

import AgentService from './AgentService'

const logger = loggerService.withContext('AgentExecutionService')

/**
 * AgentExecutionService - Secure execution of agent.py script for Cherry Studio agent system
 *
 * This service handles session management, argument construction, and Claude session ID tracking.
 *
 */
export class AgentExecutionService {
  private static instance: AgentExecutionService | null = null
  private agentService: AgentService
  private readonly agentScriptPath: string
  private runningProcesses: Map<string, ChildProcess> = new Map()

  private constructor() {
    this.agentService = AgentService.getInstance()
    // Agent.py path is relative to app root for security
    // In development, use app root. In production, use app resources path
    this.agentScriptPath = path.join(getResourcePath(), 'agents', 'claude_code_agent.py')
    logger.info('initialized', { agentScriptPath: this.agentScriptPath })
  }

  public static getInstance(): AgentExecutionService {
    if (!AgentExecutionService.instance) {
      AgentExecutionService.instance = new AgentExecutionService()
    }
    return AgentExecutionService.instance
  }

  /**
   * Validates that the agent.py script exists and is accessible
   */
  private async validateAgentScript(): Promise<ServiceResult<void>> {
    try {
      const stats = await fs.promises.stat(this.agentScriptPath)
      if (!stats.isFile()) {
        return {
          success: false,
          error: `Agent script is not a file: ${this.agentScriptPath}`
        }
      }
      return { success: true }
    } catch (error) {
      logger.error('Agent script validation failed:', error as Error)
      return {
        success: false,
        error: `Agent script not found: ${this.agentScriptPath}`
      }
    }
  }

  /**
   * Validates execution arguments for security
   */
  private validateArguments(sessionId: string, prompt: string): ServiceResult<void> {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      return { success: false, error: 'Invalid session ID provided' }
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return { success: false, error: 'Invalid prompt provided' }
    }

    // Note: We don't need extensive sanitization here since we use direct process spawning
    // without shell execution, which prevents command injection

    return { success: true }
  }

  /**
   * Retrieves session data and associated agent information
   */
  private async getSessionWithAgent(sessionId: string): Promise<
    ServiceResult<{
      session: SessionEntity
      agent: AgentEntity
      workingDirectory: string
    }>
  > {
    // Get session data
    const sessionResult = await this.agentService.getSessionById(sessionId)
    if (!sessionResult.success || !sessionResult.data) {
      return { success: false, error: sessionResult.error || 'Session not found' }
    }

    const session = sessionResult.data

    // Get the first agent (assuming single agent for now, multi-agent can be added later)
    if (!session.agent_ids.length) {
      return { success: false, error: 'No agents associated with session' }
    }

    const agentResult = await this.agentService.getAgentById(session.agent_ids[0])
    if (!agentResult.success || !agentResult.data) {
      return { success: false, error: agentResult.error || 'Agent not found' }
    }

    const agent = agentResult.data

    // Determine working directory - use first accessible path or default
    let workingDirectory: string
    if (session.accessible_paths && session.accessible_paths.length > 0) {
      workingDirectory = session.accessible_paths[0]
    } else {
      // Default to user data directory with session-specific subdirectory
      const userDataPath = getDataPath()
      workingDirectory = path.join(userDataPath, 'agent-sessions', sessionId)
    }

    // Ensure working directory exists
    try {
      await fs.promises.mkdir(workingDirectory, { recursive: true })
    } catch (error) {
      logger.error('Failed to create working directory:', error as Error, { workingDirectory })
      return { success: false, error: 'Failed to create working directory' }
    }

    return {
      success: true,
      data: { session, agent, workingDirectory }
    }
  }

  /**
   * Main method to run an agent for a given session with a prompt
   *
   * @param sessionId - The session ID to execute the agent for
   * @param prompt - The user prompt to send to the agent
   * @returns Promise that resolves when execution starts (not when it completes)
   */
  public async runAgent(sessionId: string, prompt: string): Promise<ServiceResult<void>> {
    logger.info('Starting agent execution', { sessionId, promptLength: prompt.length })

    try {
      // Validate arguments
      const argValidation = this.validateArguments(sessionId, prompt)
      if (!argValidation.success) {
        return argValidation
      }

      // Validate agent script exists
      const scriptValidation = await this.validateAgentScript()
      if (!scriptValidation.success) {
        return scriptValidation
      }

      // Get session and agent data
      const sessionDataResult = await this.getSessionWithAgent(sessionId)
      if (!sessionDataResult.success || !sessionDataResult.data) {
        return { success: false, error: sessionDataResult.error }
      }

      const { agent, session, workingDirectory } = sessionDataResult.data

      // Update session status to running
      const statusUpdate = await this.agentService.updateSessionStatus(sessionId, 'running')
      if (!statusUpdate.success) {
        logger.warn('Failed to update session status to running', { error: statusUpdate.error })
      }

      // Get existing Claude session ID if available (for session continuation)
      const existingClaudeSessionId = session.latest_claude_session_id

      // Construct command arguments
      const executable = 'uv'
      const args: any[] = ['run', '--script', this.agentScriptPath, '--prompt', prompt]

      if (existingClaudeSessionId) {
        args.push('--session-id', existingClaudeSessionId)
      } else {
        const initArgs = [
          '--system-prompt',
          agent.instructions || 'You are a helpful assistant.',
          '--cwd',
          workingDirectory,
          '--permission-mode',
          session.permission_mode || 'default',
          '--max-turns',
          String(session.max_turns || 10)
        ]
        args.push(...initArgs)
      }

      logger.info('Executing agent command', {
        sessionId,
        executable,
        args: args.slice(0, 3), // Log first few args for security
        workingDirectory,
        hasExistingSession: !!existingClaudeSessionId
      })

      // Execute the command asynchronously (don't await completion, just startup)
      this.executeAgentProcess(sessionId, executable, args, workingDirectory).catch(error => {
        logger.error('Agent process execution failed:', error as Error, { sessionId })
        this.agentService.updateSessionStatus(sessionId, 'failed').catch(() => {})
      })

      return { success: true }
    } catch (error) {
      logger.error('Agent execution failed:', error as Error, { sessionId })

      // Update session status to failed
      await this.agentService.updateSessionStatus(sessionId, 'failed')

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during agent execution'
      }
    }
  }

  /**
   * Interrupts a running agent execution
   *
   * @param sessionId - The session ID to stop
   * @returns Whether the interruption was successful
   */
  public async stopAgent(sessionId: string): Promise<ServiceResult<void>> {
    logger.info('Stopping agent execution', { sessionId })

    try {
      const process = this.runningProcesses.get(sessionId)
      if (!process) {
        logger.warn('No running process found for session', { sessionId })
        return { success: false, error: 'No running process found for this session' }
      }

      // Log interruption
      const interruptContent: ExecutionInterruptContent = {
        sessionId,
        reason: 'user_stop',
        message: 'Execution stopped by user request'
      }

      await this.addSessionLog(sessionId, 'system', 'execution_interrupt', interruptContent)

      // Kill the process
      process.kill('SIGTERM')

      // Give it a moment to terminate gracefully, then force kill if needed
      setTimeout(() => {
        if (!process.killed) {
          logger.warn('Process did not terminate gracefully, force killing', { sessionId })
          process.kill('SIGKILL')
        }
      }, 5000)

      // Update session status
      await this.agentService.updateSessionStatus(sessionId, 'stopped')

      return { success: true }
    } catch (error) {
      logger.error('Failed to stop agent:', error as Error, { sessionId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during agent stop'
      }
    }
  }

  /**
   * Execute the agent process and handle stdio streaming
   */
  private async executeAgentProcess(
    sessionId: string,
    executable: string,
    args: string[],
    workingDirectory: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Spawn the process
        const process = spawn(executable, args, {
          cwd: workingDirectory,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...globalThis.process.env,
            // Add any necessary environment variables
            PYTHONUNBUFFERED: '1' // Ensure Python output is not buffered
          }
        })

        // Store the process for later management
        this.runningProcesses.set(sessionId, process)

        // Log execution start
        const startContent: ExecutionStartContent = {
          sessionId,
          agentId: sessionId, // For now, using sessionId as agentId
          command: `${executable} ${args.join(' ')}`,
          workingDirectory
        }

        this.addSessionLog(sessionId, 'system', 'execution_start', startContent).catch((error) => {
          logger.warn('Failed to log execution start:', error)
        })

        // Handle stdout
        process.stdout?.on('data', (data: Buffer) => {
          const output = data.toString()
          logger.verbose('Agent stdout:', {
            sessionId,
            output: output.slice(0, 200) + (output.length > 200 ? '...' : '')
          })

          // Stream output to renderer processes via IPC
          this.streamToRenderers('agent-output', {
            sessionId,
            type: 'stdout',
            data: output,
            timestamp: Date.now()
          })

          // Store in database
          this.addSessionLog(sessionId, 'agent', 'output', { type: 'stdout', data: output }).catch((error) => {
            logger.warn('Failed to log stdout:', error)
          })
        })

        // Handle stderr
        process.stderr?.on('data', (data: Buffer) => {
          const output = data.toString()
          logger.verbose('Agent stderr:', {
            sessionId,
            output: output.slice(0, 200) + (output.length > 200 ? '...' : '')
          })

          // Stream output to renderer processes via IPC
          this.streamToRenderers('agent-output', {
            sessionId,
            type: 'stderr',
            data: output,
            timestamp: Date.now()
          })

          // Store in database
          this.addSessionLog(sessionId, 'agent', 'output', { type: 'stderr', data: output }).catch((error) => {
            logger.warn('Failed to log stderr:', error)
          })
        })

        // Handle process exit
        process.on('exit', async (code, signal) => {
          this.runningProcesses.delete(sessionId)

          const success = code === 0
          const status = success ? 'completed' : 'failed'

          logger.info('Agent process exited', { sessionId, code, signal, success })

          // Log execution completion
          const completeContent: ExecutionCompleteContent = {
            sessionId,
            success,
            exitCode: code ?? undefined,
            ...(signal && { error: `Process terminated by signal: ${signal}` })
          }

          try {
            await this.addSessionLog(sessionId, 'system', 'execution_complete', completeContent)
            await this.agentService.updateSessionStatus(sessionId, status)
          } catch (error) {
            logger.error('Failed to log execution completion:', error as Error)
          }

          // Stream completion event
          this.streamToRenderers('agent-complete', {
            sessionId,
            exitCode: code ?? -1,
            success,
            timestamp: Date.now()
          })

          resolve()
        })

        // Handle process errors
        process.on('error', async (error) => {
          this.runningProcesses.delete(sessionId)

          logger.error('Agent process error:', error, { sessionId })

          // Log execution error
          const completeContent: ExecutionCompleteContent = {
            sessionId,
            success: false,
            error: error.message
          }

          try {
            await this.addSessionLog(sessionId, 'system', 'execution_complete', completeContent)
            await this.agentService.updateSessionStatus(sessionId, 'failed')
          } catch (logError) {
            logger.error('Failed to log execution error:', logError as Error)
          }

          // Stream error event
          this.streamToRenderers('agent-error', {
            sessionId,
            error: error.message,
            timestamp: Date.now()
          })

          reject(error)
        })
      } catch (error) {
        logger.error('Failed to spawn agent process:', error as Error, { sessionId })
        reject(error)
      }
    })
  }

  /**
   * Add a session log entry
   */
  private async addSessionLog(
    sessionId: string,
    role: 'user' | 'agent' | 'system',
    type: string,
    content: Record<string, any>
  ): Promise<void> {
    try {
      const logInput: CreateSessionLogInput = {
        session_id: sessionId,
        role,
        type,
        content
      }

      const result = await this.agentService.addSessionLog(logInput)
      if (!result.success) {
        logger.warn('Failed to add session log:', { error: result.error, sessionId, type })
      }
    } catch (error) {
      logger.error('Error adding session log:', error as Error, { sessionId, type })
    }
  }

  /**
   * Get running process info for a session
   */
  public getRunningProcessInfo(sessionId: string): { isRunning: boolean; pid?: number } {
    const process = this.runningProcesses.get(sessionId)
    return {
      isRunning: process !== undefined && !process.killed,
      pid: process?.pid
    }
  }

  /**
   * Get all running sessions
   */
  public getRunningSessions(): string[] {
    return Array.from(this.runningProcesses.keys()).filter((sessionId) => {
      const process = this.runningProcesses.get(sessionId)
      return process && !process.killed
    })
  }

  /**
   * Stream data to all renderer processes
   */
  private streamToRenderers(channel: string, data: any): void {
    try {
      // Get all browser windows and send the data
      const windows = BrowserWindow.getAllWindows()
      windows.forEach((window) => {
        if (!window.isDestroyed()) {
          window.webContents.send(channel, data)
        }
      })
    } catch (error) {
      logger.warn('Failed to stream to renderers:', error as Error)
    }
  }
}

export default AgentExecutionService
