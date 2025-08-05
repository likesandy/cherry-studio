import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import React from 'react'

import {
  ToolResultCard,
  ToolResultContent,
  ToolResultHeader,
  ToolResultIcon,
  ToolResultTime,
  ToolResultTitle
} from '../../styles'

interface ToolResultMessageProps {
  content: string
  isError: boolean
  createdAt: string
}

export const ToolResultMessage: React.FC<ToolResultMessageProps> = ({ content, isError, createdAt }) => {
  return (
    <ToolResultCard $isError={isError}>
      <ToolResultHeader>
        <ToolResultTitle>
          <ToolResultIcon $isError={isError}>
            {isError ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
          </ToolResultIcon>
          <span>{isError ? 'Tool Error' : 'Tool Result'}</span>
        </ToolResultTitle>
        <ToolResultTime>{new Date(createdAt).toLocaleTimeString()}</ToolResultTime>
      </ToolResultHeader>
      <ToolResultContent $isError={isError}>
        {content.length > 200 ? `${content.substring(0, 200)}...` : content}
      </ToolResultContent>
    </ToolResultCard>
  )
}
