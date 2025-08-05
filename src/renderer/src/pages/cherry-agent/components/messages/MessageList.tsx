import { SessionLogEntity } from '@renderer/types/agent'
import React from 'react'

import { ProcessedLog } from '../../utils'
import { formatMessageContent } from '../../utils/formatters'
import { EmptyConversation } from './EmptyConversation'
import { MessageGroup } from './MessageGroup'
import { SystemMessage } from './SystemMessage'

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

  // Separate system messages from conversation messages
  const systemMessages = logs.filter((log) => {
    const sessionLog = log as SessionLogEntity
    return sessionLog.role === 'system'
  })

  const conversationMessages = logs.filter((log) => {
    const sessionLog = log as SessionLogEntity
    return sessionLog.role !== 'system'
  })

  return (
    <>
      {/* Render system messages first */}
      {systemMessages.map((log) => {
        const sessionLog = log as SessionLogEntity
        const isCollapsed = collapsedSystemMessages.has(sessionLog.id)

        return (
          <SystemMessage
            key={sessionLog.id}
            log={sessionLog}
            isCollapsed={isCollapsed}
            onToggle={() => onToggleSystemMessage(sessionLog.id)}
          />
        )
      })}

      {/* Render conversation with grouped tool messages */}
      <MessageGroup
        logs={conversationMessages}
        collapsedToolCalls={collapsedToolCalls}
        onToggleToolCall={onToggleToolCall}
        formatMessageContent={formatMessageContent}
      />
    </>
  )
}
