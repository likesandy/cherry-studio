import { loggerService } from '@renderer/services/LoggerService'
import { AgentEntity, CreateAgentInput, UpdateAgentInput } from '@renderer/types/agent'
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

  const updateAgent = useCallback(
    async (input: UpdateAgentInput) => {
      try {
        const result = await window.api.agent.update(input)
        if (result.success) {
          message.success('Agent updated successfully')
          loadAgents()
          // Update selected agent if it was the one being edited
          if (selectedAgent?.id === input.id) {
            const updatedAgent = { ...selectedAgent, ...input }
            setSelectedAgent(updatedAgent)
          }
          return true
        } else {
          message.error(result.error || 'Failed to update agent')
          return false
        }
      } catch (error) {
        message.error('Failed to update agent')
        logger.error('Failed to update agent:', { error })
        return false
      }
    },
    [loadAgents, selectedAgent]
  )

  const deleteAgent = useCallback(
    async (id: string) => {
      try {
        const result = await window.api.agent.delete(id)
        if (result.success) {
          message.success('Agent deleted successfully')
          // Clear selection if the deleted agent was selected
          if (selectedAgent?.id === id) {
            setSelectedAgent(null)
          }
          loadAgents()
          return true
        } else {
          message.error(result.error || 'Failed to delete agent')
          return false
        }
      } catch (error) {
        message.error('Failed to delete agent')
        logger.error('Failed to delete agent:', { error })
        return false
      }
    },
    [loadAgents, selectedAgent]
  )

  const duplicateAgent = useCallback(
    async (agent: AgentEntity) => {
      try {
        const duplicateData: CreateAgentInput = {
          name: `${agent.name} (Copy)`,
          description: agent.description,
          avatar: agent.avatar,
          instructions: agent.instructions,
          model: agent.model,
          tools: agent.tools,
          knowledges: agent.knowledges,
          configuration: agent.configuration
        }
        return await createAgent(duplicateData)
      } catch (error) {
        message.error('Failed to duplicate agent')
        logger.error('Failed to duplicate agent:', { error })
        return false
      }
    },
    [createAgent]
  )

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  return {
    agents,
    selectedAgent,
    setSelectedAgent,
    loadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    duplicateAgent
  }
}
