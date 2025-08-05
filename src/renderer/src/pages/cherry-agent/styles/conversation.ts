import styled from 'styled-components'

export const ConversationAreaComponent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  max-height: 85%;
`

export const ConversationHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-background-soft);
  gap: 16px;

  h3 {
    margin: 0;
    color: var(--color-text);
    font-size: 16px;
  }
`

export const ConversationTitle = styled.div`
  flex: 1;
  min-width: 0;

  h3 {
    margin: 0;
    color: var(--color-text);
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const ConversationMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

export const MetricBadge = styled.span`
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background-color: var(--color-background-muted);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  white-space: nowrap;
`

export const ErrorBadge = styled.span`
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  background-color: var(--color-error-light);
  color: var(--color-error);
  border: 1px solid var(--color-error-light);
  display: flex;
  align-items: center;
  gap: 4px;
`

export const SessionStatusBadge = styled.span<{ $status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  background-color: ${(props) => {
    switch (props.$status) {
      case 'running':
        return 'var(--color-success-light)'
      case 'failed':
        return 'var(--color-error-light)'
      case 'completed':
        return 'var(--color-primary-light)'
      default:
        return 'var(--color-background-muted)'
    }
  }};
  color: ${(props) => {
    switch (props.$status) {
      case 'running':
        return 'var(--color-success)'
      case 'failed':
        return 'var(--color-error)'
      case 'completed':
        return 'var(--color-primary)'
      default:
        return 'var(--color-text-secondary)'
    }
  }};
`

export const InputAreaComponent = styled.div`
  padding: 20px 24px;
  flex-shrink: 0;
`

export const MessageInput = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
`
