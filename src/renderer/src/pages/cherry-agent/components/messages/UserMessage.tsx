import React from 'react'

import { MessageTimestamp, MessageWrapper, UserMessageComponent, UserMessageContent } from '../../styles'

interface UserMessageProps {
  content: string
  createdAt: string
}

export const UserMessage: React.FC<UserMessageProps> = ({ content, createdAt }) => {
  return (
    <MessageWrapper $align="right">
      <UserMessageComponent>
        <UserMessageContent>{content}</UserMessageContent>
        <MessageTimestamp>{new Date(createdAt).toLocaleTimeString()}</MessageTimestamp>
      </UserMessageComponent>
    </MessageWrapper>
  )
}
