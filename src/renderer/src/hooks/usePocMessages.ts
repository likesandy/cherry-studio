import { loggerService } from '@logger'
import { agentCommandService } from '@renderer/services/AgentCommandService'
import { agentManagementService } from '@renderer/services/AgentManagementService'
import type { PocMessage } from '@types'
import { useCallback, useEffect, useRef, useState } from 'react'

const logger = loggerService.withContext('UsePocMessages')

/**
 * Hook for managing PoC command messages state
 *
 * Features:
 * - Manages list of messages (user commands, output, errors)
 * - Adds user commands with proper timestamps
 * - Appends streaming output from command execution
 * - Handles message completion status
 * - Real-time updates from AgentCommandService events
 */
export function usePocMessages(currentSessionId?: string) {
  const [messages, setMessages] = useState<PocMessage[]>([])
  const persistTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  /**
   * Adds a user command message to the list and persists to database
   */
  const addUserCommand = useCallback(async (command: string, commandId: string, sessionId?: string) => {
    const message: PocMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'user-command',
      content: command,
      timestamp: Date.now(),
      commandId,
      sessionId,
      isComplete: true
    }

    setMessages((prev) => [...prev, message])
    logger.debug('Added user command message', { commandId, sessionId, command: command.substring(0, 50) })

    // Persist to database if sessionId is provided
    if (sessionId) {
      try {
        await agentManagementService.addSessionLog({
          session_id: sessionId,
          role: 'user',
          type: 'action',
          content: {
            command,
            commandId,
            timestamp: message.timestamp
          }
        })
        logger.debug('Persisted user command to database', { sessionId, commandId })
      } catch (error) {
        logger.error('Failed to persist user command to database', { error, sessionId, commandId })
      }
    }
  }, [])

  /**
   * Appends streaming output to existing message or creates new one and persists to database
   */
  const appendOutput = useCallback(
    async (
      commandId: string,
      content: string,
      type: 'output' | 'error' = 'output',
      isComplete: boolean = false,
      sessionId?: string
    ) => {
      let shouldPersist = false

      setMessages((prev) => {
        // Find existing output message for this command
        const existingIndex = prev.findIndex(
          (msg) => msg.commandId === commandId && msg.type === type && !msg.isComplete
        )

        if (existingIndex >= 0) {
          // Update existing message
          const updated = [...prev]
          const newContent = updated[existingIndex].content + content
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: newContent,
            isComplete,
            timestamp: Date.now()
          }
          shouldPersist = isComplete // Only persist when complete to avoid too many DB writes
          return updated
        } else {
          // Create new output message
          const message: PocMessage = {
            id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            content,
            timestamp: Date.now(),
            commandId,
            sessionId,
            isComplete
          }
          shouldPersist = isComplete // Only persist when complete
          return [...prev, message]
        }
      })

      // Get the full content by finding the message again after state update
      const getCurrentFullContent = () => {
        return new Promise<string>((resolve) => {
          setMessages((prev) => {
            const existingMessage = prev.find((msg) => msg.commandId === commandId && msg.type === type)
            resolve(existingMessage?.content || content)
            return prev // Don't change the state, just read it
          })
        })
      }

      const actualFullContent = await getCurrentFullContent()

      logger.verbose('Appended output', {
        commandId,
        type,
        contentLength: content.length,
        isComplete,
        shouldPersist,
        sessionId,
        fullContent: actualFullContent.substring(0, 100) + (actualFullContent.length > 100 ? '...' : ''),
        content
      })

      // Persist to database - immediately when complete, debounced when streaming
      if (sessionId) {
        const persistKey = `${sessionId}_${commandId}_${type}`

        // Clear any existing timeout for this command
        const existingTimeout = persistTimeouts.current.get(persistKey)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }

        const persistToDatabase = async () => {
          try {
            await agentManagementService.addSessionLog({
              session_id: sessionId,
              role: 'agent',
              type: 'observation',
              content: {
                commandId,
                type,
                output: actualFullContent,
                timestamp: Date.now(),
                isStreaming: !isComplete
              }
            })
            logger.debug('Persisted command output to database', {
              sessionId,
              commandId,
              type,
              isComplete,
              contentLength: actualFullContent.length
            })
          } catch (error) {
            logger.error('Failed to persist command output to database', { error, sessionId, commandId, type })
          }
        }

        if (isComplete) {
          // Persist immediately when complete
          await persistToDatabase()
          persistTimeouts.current.delete(persistKey)
        } else {
          // Debounce streaming content (persist after 2 seconds of no new content)
          const timeout = setTimeout(persistToDatabase, 2000)
          persistTimeouts.current.set(persistKey, timeout)
        }
      }
    },
    []
  )

  /**
   * Marks a message as complete (stops streaming)
   */
  const completeMessage = useCallback((commandId: string, type: 'output' | 'error' = 'output') => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.commandId === commandId && msg.type === type ? { ...msg, isComplete: true, timestamp: Date.now() } : msg
      )
    )
    logger.debug('Completed message', { commandId, type })
  }, [])

  /**
   * Adds a system message (e.g., command completion notifications) and persists to database
   */
  const addSystemMessage = useCallback(async (content: string, commandId?: string, sessionId?: string) => {
    const message: PocMessage = {
      id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'system',
      content,
      timestamp: Date.now(),
      commandId,
      sessionId,
      isComplete: true
    }

    setMessages((prev) => [...prev, message])
    logger.debug('Added system message', { content, commandId, sessionId })

    // Persist to database if sessionId is provided
    if (sessionId) {
      try {
        await agentManagementService.addSessionLog({
          session_id: sessionId,
          role: 'agent',
          type: 'message',
          content: {
            text: content,
            commandId,
            timestamp: message.timestamp
          }
        })
        logger.debug('Persisted system message to database', { sessionId, commandId })
      } catch (error) {
        logger.error('Failed to persist system message to database', { error, sessionId, commandId })
      }
    }
  }, [])

  /**
   * Clears all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    logger.info('Cleared all messages')
  }, [])

  /**
   * Gets messages for a specific command
   */
  const getMessagesForCommand = useCallback(
    (commandId: string): PocMessage[] => {
      return messages.filter((msg) => msg.commandId === commandId)
    },
    [messages]
  )

  /**
   * Gets messages for a specific session
   */
  const getMessagesForSession = useCallback(
    (sessionId: string): PocMessage[] => {
      // logger.debug('Getting messages for session', { messages })
      return messages.filter((msg) => msg.sessionId === sessionId)
    },
    [messages]
  )

  /**
   * Load session logs from database and convert to PocMessage format
   */
  const loadSessionLogs = useCallback(async (sessionId: string) => {
    try {
      // logger.debug('Loading session logs from database', { sessionId })
      const result = await agentManagementService.getSessionLogs({ session_id: sessionId })

      if (result.success && result.data) {
        const sessionLogs = result.data.items
        const convertedMessages: PocMessage[] = []

        // Group observation logs by commandId and type to get the latest version
        const observationGroups = new Map<string, any>()

        sessionLogs.forEach((log) => {
          const baseMessage = {
            id: `db_${log.id}_${Date.now()}`,
            timestamp: new Date(log.created_at).getTime(),
            sessionId: log.session_id,
            isComplete: true
          }

          // Convert session log to PocMessage based on type and role
          if (log.role === 'user' && log.type === 'action' && log.content.command) {
            convertedMessages.push({
              ...baseMessage,
              type: 'user-command',
              content: log.content.command,
              commandId: log.content.commandId
            })
          } else if (log.role === 'agent' && log.type === 'observation' && log.content.output) {
            // For observations, keep track of the latest version for each commandId+type combination
            const key = `${log.content.commandId}_${log.content.type}`
            const existing = observationGroups.get(key)

            // Use the latest observation (highest timestamp) or the one marked as not streaming
            if (
              !existing ||
              new Date(log.created_at).getTime() > new Date(existing.created_at).getTime() ||
              !log.content.isStreaming
            ) {
              observationGroups.set(key, log)
            }
          } else if (log.role === 'agent' && log.type === 'message' && log.content.text) {
            convertedMessages.push({
              ...baseMessage,
              type: 'system',
              content: log.content.text,
              commandId: log.content.commandId
            })
          }
        })

        // Add the latest observation messages
        observationGroups.forEach((log) => {
          convertedMessages.push({
            id: `db_${log.id}_${Date.now()}`,
            timestamp: new Date(log.created_at).getTime(),
            sessionId: log.session_id,
            isComplete: true,
            type: log.content.type === 'error' ? 'error' : 'output',
            content: log.content.output,
            commandId: log.content.commandId
          })
        })

        // Sort by timestamp and add to messages
        convertedMessages.sort((a, b) => a.timestamp - b.timestamp)
        setMessages((prev) => {
          // Filter out existing messages for this session and add the loaded ones
          const filteredMessages = prev.filter((msg) => msg.sessionId !== sessionId)
          return [...filteredMessages, ...convertedMessages]
        })

        // logger.info(`Loaded ${convertedMessages.length} messages from database for session ${sessionId}`)
      }
    } catch (error) {
      logger.error('Failed to load session logs from database', { error, sessionId })
    }
  }, [])

  /**
   * Gets the latest incomplete output message for a command
   */
  const getStreamingMessage = useCallback(
    (commandId: string, type: 'output' | 'error' = 'output'): PocMessage | undefined => {
      return messages.find((msg) => msg.commandId === commandId && msg.type === type && !msg.isComplete)
    },
    [messages]
  )

  // Set up event listeners for AgentCommandService
  useEffect(() => {
    logger.debug('Setting up AgentCommandService event listeners')

    // Handle command output
    const unsubscribeOutput = agentCommandService.on('commandOutput', async (output) => {
      const { commandId, type, data } = output

      if (type === 'stdout' || type === 'stderr') {
        const messageType = type === 'stderr' ? 'error' : 'output'
        await appendOutput(commandId, data, messageType, false, currentSessionId)
      } else if (type === 'exit') {
        // Complete any streaming messages when command exits
        completeMessage(commandId, 'output')
        completeMessage(commandId, 'error')

        // Add system message for command completion
        const exitCode = output.exitCode ?? 0
        if (exitCode != 0) {
          await addSystemMessage(`Command exited with code ${exitCode}`, commandId, currentSessionId)
        }
      } else if (type === 'error') {
        await appendOutput(commandId, data, 'error', true, currentSessionId)
      }
    })

    // Handle command errors
    const unsubscribeError = agentCommandService.on('commandError', async ({ commandId, error }) => {
      await addSystemMessage(`Command error: ${error}`, commandId, currentSessionId)
    })

    // Cleanup on unmount
    return () => {
      logger.debug('Cleaning up AgentCommandService event listeners')
      unsubscribeOutput()
      unsubscribeError()

      // Clear any pending persist timeouts
      persistTimeouts.current.forEach((timeout) => clearTimeout(timeout))
      persistTimeouts.current.clear()
    }
  }, [appendOutput, completeMessage, addSystemMessage, currentSessionId])

  return {
    messages,
    addUserCommand,
    appendOutput,
    completeMessage,
    addSystemMessage,
    clearMessages,
    getMessagesForCommand,
    getMessagesForSession,
    getStreamingMessage,
    loadSessionLogs
  }
}
