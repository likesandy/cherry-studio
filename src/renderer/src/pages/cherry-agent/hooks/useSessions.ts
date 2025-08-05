import { loggerService } from '@renderer/services/LoggerService'
import { AgentEntity, CreateSessionInput, SessionEntity, UpdateSessionInput } from '@renderer/types/agent'
import { message, Modal } from 'antd'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('useSessions')

export const useSessions = (selectedAgent: AgentEntity | null) => {
  const [sessions, setSessions] = useState<SessionEntity[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionEntity | null>(null)

  const loadSessions = useCallback(async () => {
    if (!selectedAgent) return
    try {
      const result = await window.api.session.list()
      if (result.success) {
        // Filter sessions for selected agent
        const agentSessions = result.data.items.filter((session) => session.agent_ids.includes(selectedAgent.id))
        setSessions(agentSessions)
      }
    } catch (error) {
      logger.error('Failed to load sessions:', { error })
    }
  }, [selectedAgent])

  const createSession = useCallback(
    async (input: CreateSessionInput) => {
      try {
        const result = await window.api.session.create(input)
        if (result.success) {
          message.success('Session created successfully')
          loadSessions()
          return true
        } else {
          message.error(result.error || 'Failed to create session')
          return false
        }
      } catch (error) {
        message.error('Failed to create session')
        logger.error('Failed to create session:', { error })
        return false
      }
    },
    [loadSessions]
  )

  const updateSession = useCallback(
    async (input: UpdateSessionInput) => {
      try {
        const result = await window.api.session.update(input)
        if (result.success) {
          message.success('Session updated successfully')
          loadSessions()
          return true
        } else {
          message.error(result.error || 'Failed to update session')
          return false
        }
      } catch (error) {
        message.error('Failed to update session')
        logger.error('Failed to update session:', { error })
        return false
      }
    },
    [loadSessions]
  )

  const deleteSession = useCallback(
    async (session: SessionEntity) => {
      return new Promise<void>((resolve) => {
        Modal.confirm({
          title: 'Delete Session',
          content: `Are you sure you want to delete this session? This action cannot be undone.`,
          okText: 'Delete',
          okType: 'danger',
          onOk: async () => {
            try {
              const result = await window.api.session.delete(session.id)
              if (result.success) {
                message.success('Session deleted successfully')
                if (selectedSession?.id === session.id) {
                  setSelectedSession(null)
                }
                loadSessions()
              } else {
                message.error(result.error || 'Failed to delete session')
              }
            } catch (error) {
              message.error('Failed to delete session')
              logger.error('Failed to delete session:', { error })
            }
            resolve()
          },
          onCancel: () => resolve()
        })
      })
    },
    [selectedSession?.id, loadSessions]
  )

  // Load sessions when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      loadSessions()
    } else {
      setSessions([])
      setSelectedSession(null)
    }
  }, [selectedAgent, loadSessions])

  return {
    sessions,
    selectedSession,
    setSelectedSession,
    loadSessions,
    createSession,
    updateSession,
    deleteSession
  }
}
