import { DownOutlined, RightOutlined } from '@ant-design/icons'
import React from 'react'

import {
  CollapseIcon,
  ParameterLabel,
  ParameterValue,
  ToolCallCard,
  ToolCallContent,
  ToolCallHeader,
  ToolCallHeaderRight,
  ToolCallIcon,
  ToolCallTime,
  ToolCallTitle,
  ToolParameter
} from '../../styles'
import { getToolIcon } from '../../utils'

interface ToolCallMessageProps {
  toolName: string
  toolInput: any
  createdAt: string
  isCollapsed: boolean
  hasParameters: boolean
  onToggle: () => void
}

export const ToolCallMessage: React.FC<ToolCallMessageProps> = ({
  toolName,
  toolInput,
  createdAt,
  isCollapsed,
  hasParameters,
  onToggle
}) => {
  return (
    <ToolCallCard>
      <ToolCallHeader onClick={onToggle} $clickable={hasParameters}>
        <ToolCallTitle>
          <ToolCallIcon>{getToolIcon(toolName)}</ToolCallIcon>
          <span>Using {toolName}</span>
        </ToolCallTitle>
        <ToolCallHeaderRight>
          <ToolCallTime>{new Date(createdAt).toLocaleTimeString()}</ToolCallTime>
          {hasParameters && (
            <CollapseIcon $collapsed={isCollapsed}>{isCollapsed ? <RightOutlined /> : <DownOutlined />}</CollapseIcon>
          )}
        </ToolCallHeaderRight>
      </ToolCallHeader>
      {!isCollapsed && hasParameters && (
        <ToolCallContent>
          {Object.entries(toolInput).map(([key, value]) => (
            <ToolParameter key={key}>
              <ParameterLabel>{key}:</ParameterLabel>
              <ParameterValue>{JSON.stringify(value, null, 2)}</ParameterValue>
            </ToolParameter>
          ))}
        </ToolCallContent>
      )}
    </ToolCallCard>
  )
}
