import React from 'react'

import {
  EmptyConversationComponent,
  EmptyConversationIcon,
  EmptyConversationSubtitle,
  EmptyConversationTitle
} from '../../styles'

export const EmptyConversation: React.FC = () => {
  return (
    <EmptyConversationComponent>
      <EmptyConversationIcon>💬</EmptyConversationIcon>
      <EmptyConversationTitle>No messages yet</EmptyConversationTitle>
      <EmptyConversationSubtitle>Start the conversation below!</EmptyConversationSubtitle>
    </EmptyConversationComponent>
  )
}
