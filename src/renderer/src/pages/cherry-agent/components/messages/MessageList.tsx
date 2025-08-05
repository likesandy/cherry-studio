import { loggerService } from '@renderer/services/LoggerService'
import { SessionLogEntity } from '@renderer/types/agent'
import React from 'react'

import { ProcessedLog } from '../../utils'
import { formatMessageContent } from '../../utils/formatters'
import { AgentMessage } from './AgentMessage'
import { EmptyConversation } from './EmptyConversation'
import { SystemMessage } from './SystemMessage'
import { ToolCallMessage } from './ToolCallMessage'
import { ToolResultMessage } from './ToolResultMessage'
import { UserMessage } from './UserMessage'

const logger = loggerService.withContext('MessageList')

interface MessageListProps {
  logs: ProcessedLog[]
  collapsedSystemMessages: Set<number>
  collapsedToolCalls: Set<number>
  onToggleSystemMessage: (logId: number) => void
  onToggleToolCall: (logId: number) => void
}

export const MessageList: React.FC<MessageListProps> = ({
  logs,
  collapsedSystemMessages,
  collapsedToolCalls,
  onToggleSystemMessage,
  onToggleToolCall
}) => {
  if (logs.length === 0) {
    return <EmptyConversation />
  }

  return (
    <>
      {logs.map((log) => {
        // Handle parsed tool calls from raw logs
        if (log.type === 'parsed_tool_call') {
          const parsedLog = log as any
          const { toolName, toolInput } = parsedLog.toolInfo
          const logIdHash = (parsedLog.id as string).hashCode() // Convert string to number for consistency
          const isCollapsed = collapsedToolCalls.has(logIdHash)
          const hasParameters = Object.keys(toolInput).length > 0

          logger.info(`Tool call`, { toolName, toolInput })

          return (
            <ToolCallMessage
              key={parsedLog.id}
              toolName={toolName}
              toolInput={toolInput}
              createdAt={parsedLog.created_at}
              isCollapsed={isCollapsed}
              hasParameters={hasParameters}
              onToggle={() => hasParameters && onToggleToolCall(logIdHash)}
            />
          )
        }

        // Handle structured tool calls (fallback for existing data)
        if (log.type === 'tool_call') {
          const sessionLog = log as SessionLogEntity
          const { toolName, toolInput } = {
            toolName: (sessionLog.content as any)?.tool_name || 'Unknown Tool',
            toolInput: (sessionLog.content as any)?.tool_input || {}
          }
          const isCollapsed = collapsedToolCalls.has(sessionLog.id)
          const hasParameters = Object.keys(toolInput).length > 0

          return (
            <ToolCallMessage
              key={sessionLog.id}
              toolName={toolName}
              toolInput={toolInput}
              createdAt={sessionLog.created_at}
              isCollapsed={isCollapsed}
              hasParameters={hasParameters}
              onToggle={() => hasParameters && onToggleToolCall(sessionLog.id)}
            />
          )
        }

        // Handle parsed tool results from raw logs
        if (log.type === 'parsed_tool_result') {
          const parsedLog = log as any
          const { content, isError } = parsedLog.toolInfo
          return (
            <ToolResultMessage
              key={parsedLog.id}
              content={content}
              isError={isError}
              createdAt={parsedLog.created_at}
            />
          )
        }

        // Handle structured tool results (fallback for existing data)
        if (log.type === 'tool_result') {
          const sessionLog = log as SessionLogEntity
          const { content, isError } = {
            content: (sessionLog.content as any)?.content || 'No result',
            isError: (sessionLog.content as any)?.is_error || false
          }
          return (
            <ToolResultMessage
              key={sessionLog.id}
              content={content}
              isError={isError}
              createdAt={sessionLog.created_at}
            />
          )
        }

        const sessionLog = log as SessionLogEntity
        const content = formatMessageContent(sessionLog)
        if (!content) return null

        // Render system messages differently
        if (sessionLog.role === 'system') {
          const isCollapsed = collapsedSystemMessages.has(sessionLog.id)

          return (
            <SystemMessage
              key={sessionLog.id}
              log={sessionLog}
              isCollapsed={isCollapsed}
              onToggle={() => onToggleSystemMessage(sessionLog.id)}
            />
          )
        }

        // Render user and agent messages
        const isUser = sessionLog.role === 'user'

        if (isUser) {
          return <UserMessage key={sessionLog.id} content={content} createdAt={sessionLog.created_at} />
        } else {
          return <AgentMessage key={sessionLog.id} content={content} createdAt={sessionLog.created_at} />
        }
      })}
    </>
  )
}
