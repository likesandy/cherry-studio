import { DownOutlined, ExclamationCircleOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons'
import { SessionLogEntity } from '@renderer/types/agent'
import React from 'react'

import {
  CollapseIcon,
  MetadataIcon,
  MetadataItem,
  MetadataLabel,
  MetadataValue,
  SystemMessageCard,
  SystemMessageContent,
  SystemMessageHeader,
  SystemMessageHeaderRight,
  SystemMessageIcon,
  SystemMessageTime,
  SystemMessageTitle
} from '../../styles'
import { extractSystemMetadata, getSystemMessageStatus, getSystemMessageTitle } from '../../utils'

interface SystemMessageProps {
  log: SessionLogEntity
  isCollapsed: boolean
  onToggle: () => void
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ log, isCollapsed, onToggle }) => {
  const metadata = extractSystemMetadata(log)
  const title = getSystemMessageTitle(log)
  const status = getSystemMessageStatus(log)

  return (
    <SystemMessageCard $status={status}>
      <SystemMessageHeader onClick={onToggle} $clickable={metadata.length > 0}>
        <SystemMessageTitle>
          <SystemMessageIcon $status={status}>
            {status === 'error' ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}
          </SystemMessageIcon>
          <span>{title}</span>
        </SystemMessageTitle>
        <SystemMessageHeaderRight>
          <SystemMessageTime>{new Date(log.created_at).toLocaleTimeString()}</SystemMessageTime>
          {metadata.length > 0 && (
            <CollapseIcon $collapsed={isCollapsed}>{isCollapsed ? <RightOutlined /> : <DownOutlined />}</CollapseIcon>
          )}
        </SystemMessageHeaderRight>
      </SystemMessageHeader>
      {!isCollapsed && metadata.length > 0 && (
        <SystemMessageContent>
          {metadata.map((item, index) => (
            <MetadataItem key={index}>
              <MetadataLabel>
                {item.icon && <MetadataIcon>{item.icon}</MetadataIcon>}
                {item.label}
              </MetadataLabel>
              <MetadataValue>{item.value}</MetadataValue>
            </MetadataItem>
          ))}
        </SystemMessageContent>
      )}
    </SystemMessageCard>
  )
}
