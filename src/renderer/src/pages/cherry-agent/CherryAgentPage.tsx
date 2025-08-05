import { MenuFoldOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { loggerService } from '@renderer/services/LoggerService'
import {
  AgentEntity,
  CreateAgentInput,
  CreateSessionInput,
  SessionEntity,
  SessionLogEntity
} from '@renderer/types/agent'
import { Button, Input, message, Modal, Select, Tooltip } from 'antd'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('CherryAgentPage')

// Helper function to format message content for display
const formatMessageContent = (log: SessionLogEntity): string => {
  if (typeof log.content === 'string') {
    return log.content
  }

  if (log.content && typeof log.content === 'object') {
    // Check for common message formats
    if ('text' in log.content && log.content.text) {
      return log.content.text
    }
    if ('message' in log.content && log.content.message) {
      return log.content.message
    }
    if ('data' in log.content && log.content.data) {
      return log.content.data
    }
    if ('output' in log.content && log.content.output) {
      return log.content.output
    }

    // If it's a system message with command info, format it nicely
    if (log.role === 'system' && 'command' in log.content) {
      return `Command: ${log.content.command}`
    }

    // If it's an error message
    if ('error' in log.content) {
      return `Error: ${log.content.error}`
    }

    // Last resort: stringify but try to make it readable
    return JSON.stringify(log.content, null, 2)
  }

  return 'No content'
}

const CherryAgentPage: React.FC = () => {
  const { isLeftNavbar } = useNavbarPosition()
  const [sidebarCollapsed] = useState(false)
  const [agents, setAgents] = useState<AgentEntity[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentEntity | null>(null)
  const [sessions, setSessions] = useState<SessionEntity[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionEntity | null>(null)
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntity[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', model: 'claude-3-5-sonnet-20241022' })
  const [inputMessage, setInputMessage] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  // Load agents on mount
  useEffect(() => {
    loadAgents()
  }, [])

  // Set up agent execution listeners
  useEffect(() => {
    const unsubscribeOutput = window.api.agent.onOutput((data) => {
      if (data.sessionId === selectedSession?.id) {
        // Reload logs to show new output
        loadSessionLogs()
      }
    })

    const unsubscribeComplete = window.api.agent.onComplete((data) => {
      if (data.sessionId === selectedSession?.id) {
        setIsRunning(false)
        loadSessionLogs()
        message.success('Agent execution completed')
      }
    })

    const unsubscribeError = window.api.agent.onError((data) => {
      if (data.sessionId === selectedSession?.id) {
        setIsRunning(false)
        message.error(`Agent execution failed: ${data.error}`)
        loadSessionLogs()
      }
    })

    return () => {
      unsubscribeOutput()
      unsubscribeComplete()
      unsubscribeError()
    }
  }, [selectedSession?.id])

  // Load sessions when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      loadSessions()
    } else {
      setSessions([])
      setSelectedSession(null)
    }
  }, [selectedAgent])

  // Load session logs when session is selected
  useEffect(() => {
    if (selectedSession) {
      loadSessionLogs()
    } else {
      setSessionLogs([])
    }
  }, [selectedSession])

  const loadAgents = async () => {
    try {
      const result = await window.api.agent.list()
      if (result.success) {
        setAgents(result.data.items)
      }
    } catch (error) {
      logger.error('Failed to load agents:', { error })
    }
  }

  const loadSessions = async () => {
    try {
      const result = await window.api.session.list()
      if (result.success) {
        // Filter sessions for selected agent
        const agentSessions = result.data.items.filter((session) => session.agent_ids.includes(selectedAgent!.id))
        setSessions(agentSessions)
      }
    } catch (error) {
      logger.error('Failed to load sessions:', { error })
    }
  }

  const handleCreateSession = async () => {
    if (!selectedAgent) return

    try {
      const input: CreateSessionInput = {
        agent_ids: [selectedAgent.id],
        user_goal: 'New conversation',
        status: 'idle'
      }
      const result = await window.api.session.create(input)
      if (result.success) {
        message.success('Session created successfully')
        loadSessions()
      } else {
        message.error(result.error || 'Failed to create session')
      }
    } catch (error) {
      message.error('Failed to create session')
      logger.error('Failed to create session:', { error })
    }
  }

  const loadSessionLogs = async () => {
    if (!selectedSession) return

    try {
      const result = await window.api.session.getLogs({ session_id: selectedSession.id })
      if (result.success) {
        setSessionLogs(result.data.items)
      }
    } catch (error) {
      logger.error('Failed to load session logs:', { error })
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedSession || isRunning) return

    setIsRunning(true)
    const userMessage = inputMessage.trim()
    setInputMessage('')

    try {
      // Start agent execution
      const result = await window.api.agent.run(selectedSession.id, userMessage)
      if (result.success) {
        message.success('Message sent to agent')
        // Note: isRunning will be set to false by the completion listener
      } else {
        message.error(result.error || 'Failed to send message')
        setIsRunning(false)
      }
    } catch (error) {
      message.error('Failed to send message')
      logger.error('Failed to send message:', { error })
      setIsRunning(false)
    }
  }

  const handleCreateAgent = async () => {
    if (!createForm.name.trim()) {
      message.error('Agent name is required')
      return
    }

    try {
      const input: CreateAgentInput = {
        name: createForm.name.trim(),
        model: createForm.model
      }
      const result = await window.api.agent.create(input)
      if (result.success) {
        message.success('Agent created successfully')
        setShowCreateModal(false)
        setCreateForm({ name: '', model: 'claude-3-5-sonnet-20241022' })
        loadAgents()
      } else {
        message.error(result.error || 'Failed to create agent')
      }
    } catch (error) {
      message.error('Failed to create agent')
      logger.error('Failed to create agent:', { error })
    }
  }

  return (
    <Container id="cherry-agent-page">
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none', gap: 10 }}>CherryAgent</NavbarCenter>
      </Navbar>
      <ContentContainer id={isLeftNavbar ? 'content-container' : undefined}>
        {/* Left Sidebar - Only show when not collapsed */}
        {!sidebarCollapsed && (
          <Sidebar>
            <SidebarHeader>
              <HeaderLabel>agents</HeaderLabel>
              <HeaderActions>
                {agents.length === 0 ? (
                  <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => setShowCreateModal(true)}>
                    Create Agent
                  </Button>
                ) : (
                  <ActionButton
                    type="text"
                    icon={<PlusOutlined />}
                    size="small"
                    title="Create New Agent"
                    onClick={() => setShowCreateModal(true)}
                  />
                )}
                <CollapseButton type="text" icon={<MenuFoldOutlined />} size="small" />
              </HeaderActions>
            </SidebarHeader>
            <SidebarContent>
              {/* Agents Section */}
              <AgentsList>
                {agents.map((agent) => (
                  <AgentItem
                    key={agent.id}
                    $selected={selectedAgent?.id === agent.id}
                    onClick={() => setSelectedAgent(agent)}>
                    <AgentName>{agent.name}</AgentName>
                    <AgentModel>{agent.model}</AgentModel>
                  </AgentItem>
                ))}
              </AgentsList>

              {/* Sessions Section */}
              <SectionHeader
                style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                <SessionsLabel>sessions {selectedAgent ? `(${selectedAgent.name})` : ''}</SessionsLabel>
                {selectedAgent && (
                  <Tooltip title="Create new session">
                    <ActionButton type="text" icon={<PlusOutlined />} size="small" onClick={handleCreateSession} />
                  </Tooltip>
                )}
              </SectionHeader>
              <SessionsList>
                {sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    $selected={selectedSession?.id === session.id}
                    onClick={() => setSelectedSession(session)}>
                    <SessionTitle>
                      {session.user_goal && session.user_goal !== 'New conversation'
                        ? session.user_goal
                        : 'New conversation'}
                    </SessionTitle>
                    <SessionStatus $status={session.status}>{session.status}</SessionStatus>
                    <SessionDate>{new Date(session.created_at).toLocaleDateString()}</SessionDate>
                  </SessionItem>
                ))}
                {selectedAgent && sessions.length === 0 && (
                  <EmptyMessage>No sessions yet. Create one to start chatting!</EmptyMessage>
                )}
              </SessionsList>
            </SidebarContent>
            <SidebarFooter>
              <FooterLabel>footer</FooterLabel>
              <ActionButton type="text" icon={<SettingOutlined />} title="Settings" size="small" />
            </SidebarFooter>
          </Sidebar>
        )}

        {/* Main Content Area */}
        <MainContent>
          {selectedSession ? (
            <>
              <ConversationArea>
                <ConversationHeader>
                  <h3>
                    {selectedAgent?.name} -{' '}
                    {selectedSession.user_goal && selectedSession.user_goal !== 'New conversation'
                      ? selectedSession.user_goal
                      : 'Conversation'}
                  </h3>
                  <SessionStatusBadge $status={selectedSession.status}>{selectedSession.status}</SessionStatusBadge>
                </ConversationHeader>
                <MessagesContainer>
                  {sessionLogs.map((log) => (
                    <MessageBubble key={log.id} $role={log.role}>
                      <MessageRole>{log.role}</MessageRole>
                      <MessageContent>{formatMessageContent(log)}</MessageContent>
                      <MessageTime>{new Date(log.created_at).toLocaleTimeString()}</MessageTime>
                    </MessageBubble>
                  ))}
                  {sessionLogs.length === 0 && (
                    <EmptyConversation>No messages yet. Start the conversation below!</EmptyConversation>
                  )}
                </MessagesContainer>
              </ConversationArea>
              <InputArea>
                <MessageInput>
                  <Input.TextArea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={3}
                    disabled={isRunning}
                    onPressEnter={(e) => {
                      if (e.shiftKey) return // Allow newline with Shift+Enter
                      e.preventDefault()
                      handleSendMessage()
                    }}
                  />
                  <SendButton
                    type="primary"
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isRunning}
                    loading={isRunning}>
                    Send
                  </SendButton>
                </MessageInput>
              </InputArea>
            </>
          ) : (
            <SelectionPrompt>
              {selectedAgent
                ? 'Select a session to start chatting'
                : 'Select an agent and create a session to get started'}
            </SelectionPrompt>
          )}
        </MainContent>
      </ContentContainer>
      {/* Create Agent Modal */}
      <Modal
        title="Create New Agent"
        open={showCreateModal}
        onOk={handleCreateAgent}
        onCancel={() => setShowCreateModal(false)}
        width={400}>
        <div style={{ marginBottom: 16 }}>
          <label>Agent Name:</label>
          <Input
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="Enter agent name"
            style={{ marginTop: 4 }}
          />
        </div>
        <div>
          <label>Model:</label>
          <Select
            value={createForm.model}
            onChange={(value) => setCreateForm({ ...createForm, model: value })}
            style={{ width: '100%', marginTop: 4 }}>
            <Select.Option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</Select.Option>
            <Select.Option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</Select.Option>
            <Select.Option value="gpt-4o">GPT-4o</Select.Option>
          </Select>
        </div>
      </Modal>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100vh;
  width: 100%;
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;
  height: calc(100vh - 60px); /* Account for navbar */
`

const Sidebar = styled.div`
  width: 260px;
  min-width: 260px;
  background-color: var(--color-background);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  box-shadow: 1px 0 4px rgba(0, 0, 0, 0.05);
`

const SidebarHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 56px;
  background-color: var(--color-background-soft);
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const SidebarContent = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
`

const SidebarFooter = styled.div`
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

const CollapseButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    color: var(--color-text);
    background-color: var(--color-background-hover);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`

const ActionButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: none;
  box-shadow: none;

  &:hover {
    color: var(--color-text);
    background-color: var(--color-background-hover);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &:focus {
    box-shadow: none;
    border: none;
  }
`

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0; /* Allow flex shrinking */
`

const HeaderLabel = styled.span`
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const FooterLabel = styled.span`
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const SessionsLabel = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const SessionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const AgentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
  overflow: auto;
`

const AgentItem = styled.div<{ $selected: boolean }>`
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'transparent')};
  border: 1px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};

  &:hover {
    background-color: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'var(--color-background-hover)')};
  }
`

const AgentName = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 4px;
`

const AgentModel = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

const SessionItem = styled.div<{ $selected: boolean }>`
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'transparent')};
  border: 1px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};

  &:hover {
    background-color: ${(props) => (props.$selected ? 'var(--color-primary-light)' : 'var(--color-background-hover)')};
  }
`

const SessionTitle = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const SessionStatus = styled.div<{ $status: string }>`
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

const SessionDate = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
`

const EmptyMessage = styled.div`
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 12px;
  padding: 20px;
  font-style: italic;
`

const ConversationArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const ConversationHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-background-soft);

  h3 {
    margin: 0;
    color: var(--color-text);
    font-size: 16px;
  }
`

const SessionStatusBadge = styled.span<{ $status: string }>`
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

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const MessageBubble = styled.div<{ $role: string }>`
  align-self: ${(props) => (props.$role === 'user' ? 'flex-end' : 'flex-start')};
  max-width: ${(props) => (props.$role === 'system' ? '90%' : '70%')};
  background-color: ${(props) => {
    if (props.$role === 'user') return 'var(--color-primary)'
    if (props.$role === 'system') return 'var(--color-warning-light)'
    return 'var(--color-background-muted)'
  }};
  color: ${(props) => (props.$role === 'user' ? 'white' : 'var(--color-text)')};
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  word-break: break-word;
  overflow-wrap: break-word;
`

const MessageRole = styled.div`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
  opacity: 0.7;
`

const MessageContent = styled.div`
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
`

const MessageTime = styled.div`
  font-size: 10px;
  margin-top: 4px;
  opacity: 0.6;
`

const EmptyConversation = styled.div`
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: 40px 20px;
`

const InputArea = styled.div`
  border-top: 1px solid var(--color-border);
  padding: 16px 20px;
  background-color: var(--color-background);
  flex-shrink: 0; /* Don't allow this to shrink */
`

const MessageInput = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
  width: 100%;

  .ant-input {
    flex: 1;
    min-width: 0; /* Allow text area to shrink */
  }
`

const SendButton = styled(Button)`
  height: auto;
  padding: 8px 16px;
`

const SelectionPrompt = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 16px;
  text-align: center;
`

export default CherryAgentPage
