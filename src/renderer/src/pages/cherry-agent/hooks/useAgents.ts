import { loggerService } from '@renderer/services/LoggerService'
import { AgentEntity, CreateAgentInput } from '@renderer/types/agent'
import { message } from 'antd'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('useAgents')

export const useAgents = () => {
  const [agents, setAgents] = useState<AgentEntity[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentEntity | null>(null)

  const loadAgents = useCallback(async () => {
    try {
      const result = await window.api.agent.list()
      if (result.success) {
        setAgents(result.data.items)
      }
    } catch (error) {
      logger.error('Failed to load agents:', { error })
    }
  }, [])

  const createAgent = useCallback(
    async (input: CreateAgentInput) => {
      try {
        const result = await window.api.agent.create(input)
        if (result.success) {
          message.success('Agent created successfully')
          loadAgents()
          return true
        } else {
          message.error(result.error || 'Failed to create agent')
          return false
        }
      } catch (error) {
        message.error('Failed to create agent')
        logger.error('Failed to create agent:', { error })
        return false
      }
    },
    [loadAgents]
  )

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  return {
    agents,
    selectedAgent,
    setSelectedAgent,
    loadAgents,
    createAgent
  }
}
