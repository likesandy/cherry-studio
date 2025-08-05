import styled from 'styled-components'

export const SidebarComponent = styled.div`
  width: 260px;
  min-width: 260px;
  background-color: var(--color-background);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  box-shadow: 1px 0 4px rgba(0, 0, 0, 0.05);
`

export const SidebarHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  min-height: 56px;
  background-color: var(--color-background-soft);
`

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const SidebarContent = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
`

export const SidebarFooter = styled.div`
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  background-color: var(--color-background-soft);
`

export const HeaderLabel = styled.span`
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

export const FooterLabel = styled.span`
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

export const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

export const SessionsLabel = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

export const SessionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const AgentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  // margin-bottom: 24px;
  // overflow: auto;
`

export const AgentItem = styled.div<{ $selected: boolean }>`
  border-radius: 8px;
  transition: all 0.2s ease;
  background-color: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'transparent')};
  border: 1px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background-color: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'var(--color-background-hover)')};

    .agent-actions {
      opacity: 1;
    }
  }
`

export const AgentName = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 4px;
`

export const AgentModel = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export const SessionItem = styled.div<{ $selected: boolean }>`
  border-radius: 8px;
  transition: all 0.2s ease;
  background-color: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'transparent')};
  border: 1px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background-color: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'var(--color-background-hover)')};

    .session-actions {
      opacity: 1;
    }
  }
`

export const SessionContent = styled.div`
  flex: 1;
  padding: 12px;
  cursor: pointer;
  min-width: 0;
`

export const AgentActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;

  &.agent-actions {
    opacity: 0;
  }
`

export const SessionActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;

  &.session-actions {
    opacity: 0;
  }
`

export const SessionTitle = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SessionStatus = styled.div<{ $status: string }>`
  font-size: 12px;
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
  margin-bottom: 2px;
`

export const SessionDate = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
`

export const EmptyMessage = styled.div`
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 12px;
  padding: 20px;
  font-style: italic;
`
