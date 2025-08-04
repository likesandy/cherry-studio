import { loggerService } from '@logger'
import { getDataPath, getResourcePath } from '@main/utils'
import type { AgentEntity, ServiceResult, SessionEntity } from '@types'
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
          session.max_turns || '10'
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

      // Execute the command asynchronously
      // await this.commandExecutor.executeCommand(commandRequest)

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
    return { success: true }
  }
}

export default AgentExecutionService
