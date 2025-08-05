import { loggerService } from '@renderer/services/LoggerService'
import { SessionEntity, SessionLogEntity } from '@renderer/types/agent'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('useSessionLogs')

export const useSessionLogs = (selectedSession: SessionEntity | null) => {
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntity[]>([])

  const loadSessionLogs = useCallback(async () => {
    if (!selectedSession) return

    try {
      const result = await window.api.session.getLogs({ session_id: selectedSession.id })
      if (result.success) {
        setSessionLogs(result.data.items)
      }
    } catch (error) {
      logger.error('Failed to load session logs:', { error })
    }
  }, [selectedSession])

  // Load session logs when session is selected
  useEffect(() => {
    if (selectedSession) {
      loadSessionLogs()
    } else {
      setSessionLogs([])
    }
  }, [selectedSession, loadSessionLogs])

  return {
    sessionLogs,
    loadSessionLogs
  }
}
