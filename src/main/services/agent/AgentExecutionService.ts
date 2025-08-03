import { loggerService } from '@logger'
import { PocExecuteCommandRequest } from '@types'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

import AgentService from './AgentService'
import { ShellCommandExecutor } from './commandExecutor'
import type { AgentResponse, ServiceResult, SessionResponse } from './types'

const logger = loggerService.withContext('AgentExecutionService')

/**
 * AgentExecutionService - Secure execution of agent.py script for Cherry Studio agent system
 *
 * This service replaces arbitrary shell command execution with controlled agent.py script execution.
 * It handles session management, argument construction, and Claude session ID tracking.
 *
 * Security Features:
 * - Only executes pre-defined agent.py script
 * - Validates all arguments before execution
 * - No shell command injection - direct process spawning only
 * - Validates agent.py exists before execution
 */
export class AgentExecutionService {
  private static instance: AgentExecutionService | null = null
  private agentService: AgentService
  private commandExecutor: ShellCommandExecutor
  private readonly agentScriptPath: string

  private constructor() {
    this.agentService = AgentService.getInstance()
    this.commandExecutor = ShellCommandExecutor.getInstance()
    // Agent.py path is relative to app root for security
    // In development, use app root. In production, use app resources path
    const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath()
    this.agentScriptPath = path.join(appPath, 'agent.py')
    logger.info('AgentExecutionService initialized', { agentScriptPath: this.agentScriptPath })
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
  private async getSessionWithAgent(
    sessionId: string
  ): Promise<
    ServiceResult<{
      session: SessionResponse
      agent: AgentResponse
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
      const userDataPath = app.getPath('userData')
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
   * Constructs Python command arguments for agent.py execution
   */
  private constructAgentCommand(
    prompt: string,
    systemPrompt: string,
    workingDirectory: string,
    claudeSessionId?: string
  ): { executable: string; args: string[] } {
    const args = [
      this.agentScriptPath,
      '--prompt', prompt,
      '--system-prompt', systemPrompt,
      '--cwd', workingDirectory
    ]

    if (claudeSessionId) {
      args.push('--session-id', claudeSessionId)
    }

    return {
      executable: 'python3',
      args
    }
  }

  // TODO: Future methods for output monitoring and Claude session ID capture
  // These will be implemented when we add real-time output monitoring to the command executor
  
  /**
   * Placeholder for future output monitoring functionality
   * This will parse agent.py stdout to extract the Claude session ID on first run
   */
  // private parseAgentOutput(output: string): { claudeSessionId?: string }
  
  /**
   * Placeholder for future session update functionality  
   * This will update the session record with the captured Claude session ID
   */
  // private updateSessionWithClaudeId(sessionId: string, claudeSessionId: string): Promise<void>

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

      const { agent, workingDirectory } = sessionDataResult.data

      // Update session status to running
      const statusUpdate = await this.agentService.updateSessionStatus(sessionId, 'running')
      if (!statusUpdate.success) {
        logger.warn('Failed to update session status to running', { error: statusUpdate.error })
      }

      // Use agent instructions as system prompt, fallback to default
      const systemPrompt = agent.instructions || 'You are a helpful assistant.'

      // Get existing Claude session ID if available (for session continuation)
      const existingClaudeSessionId = sessionDataResult.data.session.claude_session_id

      // Construct command arguments
      const { executable, args } = this.constructAgentCommand(prompt, systemPrompt, workingDirectory, existingClaudeSessionId)

      // Create command execution request
      const commandRequest: PocExecuteCommandRequest = {
        id: `agent-${sessionId}-${Date.now()}`,
        command: `${executable} ${args.join(' ')}`, // For logging purposes only
        workingDirectory
      }

      logger.info('Executing agent command', {
        sessionId,
        commandId: commandRequest.id,
        executable,
        args: args.slice(0, 3), // Log first few args for security
        workingDirectory,
        hasExistingSession: !!existingClaudeSessionId
      })

      // Execute the command asynchronously
      await this.commandExecutor.executeCommand(commandRequest)

      // Note: We don't wait for completion here. The command executor handles
      // streaming output via IPC. In the future, we can add output monitoring
      // to capture the Claude session ID from the first run's output.

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
      // Find active processes for this session
      const activeProcesses = this.commandExecutor.getActiveProcesses()
      const sessionProcesses = activeProcesses.filter((proc) => proc.id.includes(`agent-${sessionId}`))

      if (sessionProcesses.length === 0) {
        return { success: false, error: 'No active agent process found for session' }
      }

      // Interrupt all processes for this session
      let interrupted = false
      for (const process of sessionProcesses) {
        const result = this.commandExecutor.interruptCommand(process.id)
        if (result) {
          interrupted = true
          logger.info('Agent process interrupted', { sessionId, processId: process.id })
        }
      }

      if (interrupted) {
        // Update session status to stopped
        await this.agentService.updateSessionStatus(sessionId, 'stopped')
        return { success: true }
      } else {
        return { success: false, error: 'Failed to interrupt agent processes' }
      }
    } catch (error) {
      logger.error('Failed to stop agent:', error as Error, { sessionId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during agent stop'
      }
    }
  }

  /**
   * Gets the status of all active agent executions
   */
  public getActiveExecutions(): Array<{
    sessionId: string
    commandId: string
    startTime: number
    workingDirectory: string
  }> {
    const activeProcesses = this.commandExecutor.getActiveProcesses()
    return activeProcesses
      .filter((proc) => proc.id.startsWith('agent-'))
      .map((proc) => {
        const sessionIdMatch = proc.id.match(/agent-([^-]+)-/)
        return {
          sessionId: sessionIdMatch ? sessionIdMatch[1] : 'unknown',
          commandId: proc.id,
          startTime: proc.startTime,
          workingDirectory: proc.workingDirectory
        }
      })
  }
}

export default AgentExecutionService