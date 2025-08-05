import React from 'react'
import styled from 'styled-components'

import { ProcessedLog } from '../../utils'
import { AgentMessage } from './AgentMessage'
import { ToolCallMessage } from './ToolCallMessage'
import { ToolResultMessage } from './ToolResultMessage'
import { UserMessage } from './UserMessage'

const MessageGroupContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
`

const ToolSequenceContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 4px;
`

interface MessageGroupProps {
  logs: ProcessedLog[]
  collapsedToolCalls: Set<number>
  onToggleToolCall: (logId: number) => void
  formatMessageContent: (log: any) => string | null
}

export const MessageGroup: React.FC<MessageGroupProps> = ({
  logs,
  collapsedToolCalls,
  onToggleToolCall,
  formatMessageContent
}) => {
  // Group consecutive tool calls and results
  const groupedMessages: Array<ProcessedLog | ProcessedLog[]> = []
  let currentToolGroup: ProcessedLog[] = []

  for (const log of logs) {
    const isToolRelated =
      log.type === 'tool_call' ||
      log.type === 'tool_result' ||
      log.type === 'parsed_tool_call' ||
      log.type === 'parsed_tool_result'

    if (isToolRelated) {
      currentToolGroup.push(log)
    } else {
      if (currentToolGroup.length > 0) {
        groupedMessages.push([...currentToolGroup])
        currentToolGroup = []
      }
      groupedMessages.push(log)
    }
  }

  // Don't forget the last tool group
  if (currentToolGroup.length > 0) {
    groupedMessages.push([...currentToolGroup])
  }

  return (
    <MessageGroupContainer>
      {groupedMessages.map((item, index) => {
        if (Array.isArray(item)) {
          // Tool sequence group
          return (
            <ToolSequenceContainer key={`tool-group-${index}`}>
              {item.map((log) => renderToolMessage(log, collapsedToolCalls, onToggleToolCall))}
            </ToolSequenceContainer>
          )
        } else {
          // Regular message
          return renderRegularMessage(item, formatMessageContent, `message-${index}`)
        }
      })}
    </MessageGroupContainer>
  )
}

function renderToolMessage(
  log: ProcessedLog,
  collapsedToolCalls: Set<number>,
  onToggleToolCall: (logId: number) => void
) {
  if (log.type === 'parsed_tool_call') {
    const parsedLog = log as any
    const { toolName, toolInput } = parsedLog.toolInfo
    const logIdHash = parsedLog.id.split('').reduce((a: number, b: string) => {
      a = (a << 5) - a + b.charCodeAt(0)
      return a & a
    }, 0)
    const isCollapsed = collapsedToolCalls.has(logIdHash)
    const hasParameters = Object.keys(toolInput).length > 0

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

  if (log.type === 'tool_call') {
    const sessionLog = log as any
    const { toolName, toolInput } = {
      toolName: sessionLog.content?.tool_name || 'Unknown Tool',
      toolInput: sessionLog.content?.tool_input || {}
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

  if (log.type === 'parsed_tool_result') {
    const parsedLog = log as any
    const { content, isError } = parsedLog.toolInfo
    return <ToolResultMessage key={parsedLog.id} content={content} isError={isError} createdAt={parsedLog.created_at} />
  }

  if (log.type === 'tool_result') {
    const sessionLog = log as any
    const { content, isError } = {
      content: sessionLog.content?.content || 'No result',
      isError: sessionLog.content?.is_error || false
    }
    return (
      <ToolResultMessage key={sessionLog.id} content={content} isError={isError} createdAt={sessionLog.created_at} />
    )
  }

  return null
}

function renderRegularMessage(log: ProcessedLog, formatMessageContent: (log: any) => string | null, key: string) {
  const sessionLog = log as any
  const content = formatMessageContent(sessionLog)
  if (!content) return null

  const isUser = sessionLog.role === 'user'

  if (isUser) {
    return <UserMessage key={key} content={content} createdAt={sessionLog.created_at} />
  } else {
    return <AgentMessage key={key} content={content} createdAt={sessionLog.created_at} />
  }
}
