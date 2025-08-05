import React from 'react'

import {
  AgentAvatar,
  AgentMessageComponent,
  AgentMessageContent,
  AgentMessageText,
  MessageTimestamp,
  MessageWrapper
} from '../../styles'
import { formatMarkdown } from '../../utils'

interface AgentMessageProps {
  content: string
  createdAt: string
}

export const AgentMessage: React.FC<AgentMessageProps> = ({ content, createdAt }) => {
  return (
    <MessageWrapper $align="left">
      <AgentMessageComponent>
        <AgentAvatar>🤖</AgentAvatar>
        <AgentMessageContent>
          <AgentMessageText dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }} />
          <MessageTimestamp>{new Date(createdAt).toLocaleTimeString()}</MessageTimestamp>
        </AgentMessageContent>
      </AgentMessageComponent>
    </MessageWrapper>
  )
}
