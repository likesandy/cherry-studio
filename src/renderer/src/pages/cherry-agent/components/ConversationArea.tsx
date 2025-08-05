import { ExclamationCircleOutlined } from '@ant-design/icons'
import { AgentEntity, SessionEntity, SessionLogEntity } from '@renderer/types/agent'
import React from 'react'

import {
  ConversationAreaComponent,
  ConversationHeader,
  ConversationMeta,
  ConversationTitle,
  ErrorBadge,
  MessagesContainer,
  MetricBadge,
  SessionStatusBadge
} from '../styles'
import { getSessionMetrics, processLogsWithToolInfo } from '../utils'
import { MessageList } from './messages'

interface ConversationAreaProps {
  selectedAgent: AgentEntity | null
  selectedSession: SessionEntity | null
  sessionLogs: SessionLogEntity[]
  collapsedSystemMessages: Set<number>
  collapsedToolCalls: Set<number>
  onToggleSystemMessage: (logId: number) => void
  onToggleToolCall: (logId: number) => void
}

export const ConversationArea: React.FC<ConversationAreaProps> = ({
  selectedAgent,
  selectedSession,
  sessionLogs,
  collapsedSystemMessages,
  collapsedToolCalls,
  onToggleSystemMessage,
  onToggleToolCall
}) => {
  if (!selectedSession) {
    return null
  }

  const metrics = getSessionMetrics(sessionLogs)

  return (
    <ConversationAreaComponent>
      <ConversationHeader>
        <ConversationTitle>
          <h3>
            {selectedAgent?.name} -{' '}
            {selectedSession.user_goal && selectedSession.user_goal !== 'New conversation'
              ? selectedSession.user_goal
              : 'Conversation'}
          </h3>
        </ConversationTitle>
        <ConversationMeta>
          <SessionStatusBadge $status={selectedSession.status}>{selectedSession.status}</SessionStatusBadge>
          {metrics.turns && <MetricBadge title="Number of turns">{metrics.turns} turns</MetricBadge>}
          {metrics.duration && <MetricBadge title="Session duration">{metrics.duration}</MetricBadge>}
          {metrics.cost && <MetricBadge title="Total cost">{metrics.cost}</MetricBadge>}
          {metrics.hasError && (
            <ErrorBadge title="Session has errors">
              <ExclamationCircleOutlined />
            </ErrorBadge>
          )}
        </ConversationMeta>
      </ConversationHeader>
      <MessagesContainer>
        <MessageList
          logs={processLogsWithToolInfo(sessionLogs)}
          collapsedSystemMessages={collapsedSystemMessages}
          collapsedToolCalls={collapsedToolCalls}
          onToggleSystemMessage={onToggleSystemMessage}
          onToggleToolCall={onToggleToolCall}
        />
      </MessagesContainer>
    </ConversationAreaComponent>
  )
}
