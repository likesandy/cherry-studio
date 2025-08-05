import { loggerService } from '@renderer/services/LoggerService'
import { SessionEntity } from '@renderer/types/agent'
import { message } from 'antd'
import { useEffect, useState } from 'react'

const logger = loggerService.withContext('useAgentExecution')

export const useAgentExecution = (selectedSession: SessionEntity | null, loadSessionLogs: () => Promise<void>) => {
  const [isRunning, setIsRunning] = useState(false)

  const sendMessage = async (userMessage: string) => {
    if (!selectedSession || isRunning) return false

    setIsRunning(true)

    try {
      // Start agent execution
      const result = await window.api.agent.run(selectedSession.id, userMessage)
      if (result.success) {
        message.success('Message sent to agent')
        // Note: isRunning will be set to false by the completion listener
        return true
      } else {
        message.error(result.error || 'Failed to send message')
        setIsRunning(false)
        return false
      }
    } catch (error) {
      message.error('Failed to send message')
      logger.error('Failed to send message:', { error })
      setIsRunning(false)
      return false
    }
  }

  // Set up agent execution listeners
  useEffect(() => {
    const unsubscribeOutput = window.api.agent.onOutput((data) => {
      if (data.sessionId === selectedSession?.id) {
        // Reload logs to show new output
        loadSessionLogs()
      }
    })

    const unsubscribeComplete = window.api.agent.onComplete((data) => {
      if (data.sessionId === selectedSession?.id) {
        setIsRunning(false)
        loadSessionLogs()
        message.success('Agent execution completed')
      }
    })

    const unsubscribeError = window.api.agent.onError((data) => {
      if (data.sessionId === selectedSession?.id) {
        setIsRunning(false)
        message.error(`Agent execution failed: ${data.error}`)
        loadSessionLogs()
      }
    })

    return () => {
      unsubscribeOutput()
      unsubscribeComplete()
      unsubscribeError()
    }
  }, [selectedSession?.id, loadSessionLogs])

  return {
    isRunning,
    sendMessage
  }
}
