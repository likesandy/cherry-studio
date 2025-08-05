import styled, { keyframes } from 'styled-components'

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

export const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: linear-gradient(to bottom, var(--color-background), var(--color-background-soft));
`

// System Message Styles
export const SystemMessageCard = styled.div<{ $status: 'info' | 'success' | 'warning' | 'error' }>`
  background: var(--color-background);
  border: 1px solid
    ${(props) => {
      switch (props.$status) {
        case 'success':
          return 'var(--color-success-light)'
        case 'error':
          return 'var(--color-error-light)'
        case 'warning':
          return 'var(--color-warning-light)'
        default:
          return 'var(--color-border)'
      }
    }};
  border-radius: 12px;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease-out;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`

export const SystemMessageHeader = styled.div<{ $clickable: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-background-soft);
  cursor: ${(props) => (props.$clickable ? 'pointer' : 'default')};
  transition: background-color 0.2s ease;

  ${(props) =>
    props.$clickable &&
    `
    &:hover {
      background: var(--color-background-hover);
    }
  `}
`

export const SystemMessageTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
`

export const SystemMessageIcon = styled.div<{ $status: 'info' | 'success' | 'warning' | 'error' }>`
  width: 16px;
  height: 16px;
  color: ${(props) => {
    switch (props.$status) {
      case 'success':
        return 'var(--color-success)'
      case 'error':
        return 'var(--color-error)'
      case 'warning':
        return 'var(--color-warning)'
      default:
        return 'var(--color-primary)'
    }
  }};
`

export const SystemMessageHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const SystemMessageTime = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
`

export const CollapseIcon = styled.div<{ $collapsed: boolean }>`
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary);
  transition: transform 0.2s ease;
  transform: ${(props) => (props.$collapsed ? 'rotate(0deg)' : 'rotate(0deg)')};
`

export const SystemMessageContent = styled.div`
  padding: 16px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-background);
`

export const MetadataItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-light);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
`

export const MetadataLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  min-width: 120px;
`

export const MetadataIcon = styled.div`
  width: 12px;
  height: 12px;
  color: var(--color-text-tertiary);
`

export const MetadataValue = styled.div`
  font-size: 13px;
  color: var(--color-text);
  text-align: right;
  word-break: break-all;
  max-width: 60%;
  background: var(--color-background-muted);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
`

// Message Wrapper
export const MessageWrapper = styled.div<{ $align: 'left' | 'right' }>`
  display: flex;
  justify-content: ${(props) => (props.$align === 'right' ? 'flex-end' : 'flex-start')};
  animation: ${fadeIn} 0.3s ease-out;
`

// User Message Styles
export const UserMessageComponent = styled.div`
  max-width: 70%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #1890ff));
  color: white;
  border-radius: 18px 18px 4px 18px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
  position: relative;
`

export const UserMessageContent = styled.div`
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  margin-bottom: 4px;
`

// Agent Message Styles
export const AgentMessageComponent = styled.div`
  max-width: 85%;
  display: flex;
  gap: 12px;
  align-items: flex-start;
`

export const AgentAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-success), var(--color-success-dark, #52c41a));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`

export const AgentMessageContent = styled.div`
  flex: 1;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px 18px 18px 18px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`

export const AgentMessageText = styled.div`
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);

  strong {
    font-weight: 600;
    color: var(--color-text);
  }

  em {
    font-style: italic;
    color: var(--color-text-secondary);
  }

  code {
    background: var(--color-background-muted);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    color: var(--color-primary);
  }

  pre {
    background: var(--color-background-muted);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
    border-left: 3px solid var(--color-primary);

    code {
      background: none;
      padding: 0;
      color: var(--color-text);
    }
  }
`

// Shared Message Timestamp
export const MessageTimestamp = styled.div`
  font-size: 11px;
  opacity: 0.7;
  padding: 8px 16px;
  background: var(--color-background-soft);
  border-top: 1px solid var(--color-border-light);
  color: var(--color-text-tertiary);
`

// Empty State
export const EmptyConversationComponent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  flex: 1;
`

export const EmptyConversationIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
`

export const EmptyConversationTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 8px;
`

export const EmptyConversationSubtitle = styled.div`
  font-size: 14px;
  color: var(--color-text-secondary);
`

// Tool Call Styles
export const ToolCallCard = styled.div`
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary-lighter, #e6f7ff));
  border: 1px solid var(--color-primary);
  border-radius: 12px;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease-out;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
  margin: 8px 0;
`

export const ToolCallHeader = styled.div<{ $clickable?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(24, 144, 255, 0.1);
  border-bottom: 1px solid var(--color-primary-light);
  cursor: ${(props) => (props.$clickable ? 'pointer' : 'default')};
  transition: background-color 0.2s ease;

  ${(props) =>
    props.$clickable &&
    `
    &:hover {
      background: rgba(24, 144, 255, 0.15);
    }
  `}
`

export const ToolCallTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--color-primary);
`

export const ToolCallIcon = styled.div`
  width: 16px;
  height: 16px;
  color: var(--color-primary);
`

export const ToolCallHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const ToolCallTime = styled.div`
  font-size: 11px;
  color: var(--color-primary);
  opacity: 0.7;
`

export const ToolCallContent = styled.div`
  padding: 12px 16px;
  background: var(--color-background);
`

export const ToolParameter = styled.div`
  display: flex;
  margin-bottom: 8px;
  gap: 8px;

  &:last-child {
    margin-bottom: 0;
  }
`

export const ParameterLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  min-width: 60px;
  flex-shrink: 0;
`

export const ParameterValue = styled.div`
  flex: 1;
  font-size: 12px;
  color: var(--color-text);
  background: var(--color-background-muted);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  word-break: break-all;
  white-space: pre-wrap;
`

// Tool Result Styles
export const ToolResultCard = styled.div<{ $isError: boolean }>`
  background: ${(props) => (props.$isError ? 'var(--color-error-light)' : 'var(--color-success-light)')};
  border: 1px solid ${(props) => (props.$isError ? 'var(--color-error)' : 'var(--color-success)')};
  border-radius: 12px;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease-out;
  box-shadow: 0 2px 8px ${(props) => (props.$isError ? 'rgba(255, 77, 79, 0.15)' : 'rgba(82, 196, 26, 0.15)')};
  margin: 8px 0;
`

export const ToolResultHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
`

export const ToolResultTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 14px;
`

export const ToolResultIcon = styled.div<{ $isError: boolean }>`
  width: 16px;
  height: 16px;
  color: ${(props) => (props.$isError ? 'var(--color-error)' : 'var(--color-success)')};
`

export const ToolResultTime = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
  opacity: 0.7;
`

export const ToolResultContent = styled.div<{ $isError: boolean }>`
  padding: 12px 16px;
  background: var(--color-background);
  font-size: 13px;
  color: ${(props) => (props.$isError ? 'var(--color-error)' : 'var(--color-text)')};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  white-space: pre-wrap;
  word-break: break-word;
`
