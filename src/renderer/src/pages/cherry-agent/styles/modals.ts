import styled from 'styled-components'

// Session Modal Styles
export const SessionModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 8px 0;
`

export const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const FormLabel = styled.label`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
  display: flex;
  align-items: center;
`

export const FormHint = styled.div`
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-style: italic;
`

export const EmptyPathsMessage = styled.div`
  padding: 16px;
  background: var(--color-background-muted);
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
`

export const PathsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px;
  background: var(--color-background-soft);
`

export const PathItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  gap: 8px;
`

export const PathText = styled.div`
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
