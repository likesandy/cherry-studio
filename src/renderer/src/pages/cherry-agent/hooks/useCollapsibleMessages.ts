import { SessionLogEntity } from '@renderer/types/agent'
import { useCallback, useEffect, useState } from 'react'

export const useCollapsibleMessages = (sessionLogs: SessionLogEntity[]) => {
  const [collapsedSystemMessages, setCollapsedSystemMessages] = useState<Set<number>>(new Set())
  const [collapsedToolCalls, setCollapsedToolCalls] = useState<Set<number>>(new Set())

  // Toggle system message collapse
  const toggleSystemMessage = useCallback((logId: number) => {
    setCollapsedSystemMessages((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }, [])

  // Toggle tool call collapse
  const toggleToolCall = useCallback((logId: number) => {
    setCollapsedToolCalls((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }, [])

  // Initialize collapsed state for system messages (collapsed by default)
  useEffect(() => {
    const systemMessages = sessionLogs.filter((log) => log.role === 'system')
    setCollapsedSystemMessages(new Set(systemMessages.map((log) => log.id)))
  }, [sessionLogs])

  // Tool calls should be expanded by default, so we don't initialize them as collapsed

  return {
    collapsedSystemMessages,
    collapsedToolCalls,
    toggleSystemMessage,
    toggleToolCall
  }
}
