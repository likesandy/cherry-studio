import {
  ClockCircleOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  MenuFoldOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined as CogIcon,
  SettingOutlined,
  UserOutlined
} from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { loggerService } from '@renderer/services/LoggerService'
import {
  AgentEntity,
  CreateAgentInput,
  CreateSessionInput,
  PermissionMode,
  SessionEntity,
  SessionLogEntity,
  UpdateSessionInput
} from '@renderer/types/agent'
import { Button, Input, message, Modal, Select, Tooltip } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'

const logger = loggerService.withContext('CherryAgentPage')

// Simple markdown-like formatter
const formatMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n/g, '<br/>')
}

// Message metadata extractor
const extractSystemMetadata = (log: SessionLogEntity) => {
  const content = log.content as any
  const metadata: { label: string; value: string; icon?: React.ReactNode }[] = []

  switch (log.type) {
    case 'agent_session_init':
      if (content.system_prompt)
        metadata.push({ label: 'System Prompt', value: content.system_prompt, icon: <CogIcon /> })
      if (content.max_turns)
        metadata.push({ label: 'Max Turns', value: content.max_turns.toString(), icon: <ClockCircleOutlined /> })
      if (content.permission_mode)
        metadata.push({ label: 'Permission', value: content.permission_mode, icon: <UserOutlined /> })
      if (content.cwd) metadata.push({ label: 'Working Directory', value: content.cwd, icon: <InfoCircleOutlined /> })
      break
    case 'agent_session_started':
      if (content.session_id)
        metadata.push({ label: 'Claude Session ID', value: content.session_id, icon: <InfoCircleOutlined /> })
      break
    case 'agent_session_result':
      metadata.push({
        label: 'Status',
        value: content.success ? 'Success' : 'Failed',
        icon: content.success ? <InfoCircleOutlined /> : <ExclamationCircleOutlined />
      })
      if (content.num_turns)
        metadata.push({ label: 'Turns', value: content.num_turns.toString(), icon: <ClockCircleOutlined /> })
      if (content.duration_ms)
        metadata.push({
          label: 'Duration',
          value: `${(content.duration_ms / 1000).toFixed(1)}s`,
          icon: <ClockCircleOutlined />
        })
      if (content.total_cost_usd)
        metadata.push({ label: 'Cost', value: `$${content.total_cost_usd.toFixed(4)}`, icon: <InfoCircleOutlined /> })
      break
    case 'agent_error':
      if (content.error_message)
        metadata.push({ label: 'Error', value: content.error_message, icon: <ExclamationCircleOutlined /> })
      if (content.error_type)
        metadata.push({ label: 'Type', value: content.error_type, icon: <ExclamationCircleOutlined /> })
      break
  }

  return metadata
}

// Helper function to format message content for display
const formatMessageContent = (log: SessionLogEntity): string => {
  if (typeof log.content === 'string') {
    return log.content
  }

  if (log.content && typeof log.content === 'object') {
    // Handle structured log types
    switch (log.type) {
      case 'user_prompt':
        return log.content.prompt || 'User message'

      case 'agent_response':
        return log.content.content || 'Agent response'

      case 'raw_stdout':
      case 'raw_stderr':
        // Skip raw output in UI
        return ''
    }

    // Legacy handling for other formats
    if ('text' in log.content && log.content.text) {
      return log.content.text
    }
    if ('message' in log.content && log.content.message) {
      return log.content.message
    }
    if ('data' in log.content && log.content.data) {
      return typeof log.content.data === 'string' ? log.content.data : JSON.stringify(log.content.data, null, 2)
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

// Get system message title
const getSystemMessageTitle = (log: SessionLogEntity): string => {
  switch (log.type) {
    case 'agent_session_init':
      return 'Session Initialized'
    case 'agent_session_started':
      return 'Claude Session Started'
    case 'agent_session_result':
      return 'Session Completed'
    case 'agent_error':
      return 'Error Occurred'
    default:
      return 'System Message'
  }
}

// Get system message status
const getSystemMessageStatus = (log: SessionLogEntity): 'info' | 'success' | 'warning' | 'error' => {
  switch (log.type) {
    case 'agent_session_init':
    case 'agent_session_started':
      return 'info'
    case 'agent_session_result':
      return (log.content as any)?.success ? 'success' : 'error'
    case 'agent_error':
      return 'error'
    default:
      return 'info'
  }
}

// Helper function to check if a log should be displayed
const shouldDisplayLog = (log: SessionLogEntity): boolean => {
  // Hide raw stdout/stderr logs
  if (log.type === 'raw_stdout' || log.type === 'raw_stderr') {
    return false
  }

  // Hide routine system messages - only show errors and warnings
  if (log.role === 'system') {
    // Only show system messages that are errors or have important information
    if (log.type === 'agent_error') {
      return true // Always show errors
    }
    if (log.type === 'agent_session_result') {
      // Only show failed session results, hide successful ones
      const content = log.content as any
      return content && !content.success
    }
    // Hide all other system messages (session_init, session_started, etc.)
    return false
  }

  // Hide empty content
  const content = formatMessageContent(log)
  if (!content || content.trim() === '') {
    return false
  }

  return true
}

// Helper function to get session metrics from logs
const getSessionMetrics = (logs: SessionLogEntity[]) => {
  const metrics = {
    duration: null as string | null,
    cost: null as string | null,
    turns: null as number | null,
    hasError: false
  }

  logs.forEach((log) => {
    if (log.type === 'agent_session_result' && log.content) {
      const content = log.content as any
      if (content.duration_ms) {
        metrics.duration = `${(content.duration_ms / 1000).toFixed(1)}s`
      }
      if (content.total_cost_usd) {
        metrics.cost = `$${content.total_cost_usd.toFixed(4)}`
      }
      if (content.num_turns) {
        metrics.turns = content.num_turns
      }
    }
    if (log.type === 'agent_error') {
      metrics.hasError = true
    }
  })

  return metrics
}

const CherryAgentPage: React.FC = () => {
  const { isLeftNavbar } = useNavbarPosition()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [agents, setAgents] = useState<AgentEntity[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentEntity | null>(null)
  const [sessions, setSessions] = useState<SessionEntity[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionEntity | null>(null)
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntity[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', model: 'claude-3-5-sonnet-20241022' })
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionModalMode, setSessionModalMode] = useState<'create' | 'edit'>('create')
  const [sessionForm, setSessionForm] = useState<{
    user_goal: string
    max_turns: number
    permission_mode: PermissionMode
    accessible_paths: string[]
  }>({
    user_goal: '',
    max_turns: 10,
    permission_mode: 'default',
    accessible_paths: []
  })
  const [inputMessage, setInputMessage] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [collapsedSystemMessages, setCollapsedSystemMessages] = useState<Set<number>>(new Set())
  const [showAddPathModal, setShowAddPathModal] = useState(false)
  const [newPathInput, setNewPathInput] = useState('')

  // Toggle system message collapse
  const toggleSystemMessage = useCallback((logId: number) => {
    setCollapsedSystemMessages((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }, [])

  // Initialize collapsed state for system messages
  useEffect(() => {
    const systemMessages = sessionLogs.filter((log) => log.role === 'system')
    setCollapsedSystemMessages(new Set(systemMessages.map((log) => log.id)))
  }, [sessionLogs])

  // Define callback functions first
  const loadAgents = useCallback(async () => {
    try {
      const result = await window.api.agent.list()
      if (result.success) {
        setAgents(result.data.items)
      }
    } catch (error) {
      logger.error('Failed to load agents:', { error })
    }
  }, [])

  const loadSessions = useCallback(async () => {
    if (!selectedAgent) return
    try {
      const result = await window.api.session.list()
      if (result.success) {
        // Filter sessions for selected agent
        const agentSessions = result.data.items.filter((session) => session.agent_ids.includes(selectedAgent.id))
        setSessions(agentSessions)
      }
    } catch (error) {
      logger.error('Failed to load sessions:', { error })
    }
  }, [selectedAgent])

  const loadSessionLogs = useCallback(async () => {
    if (!selectedSession) return

    try {
      const result = await window.api.session.getLogs({ session_id: selectedSession.id })
      if (result.success) {
        setSessionLogs(result.data.items)
      }
    } catch (error) {
      logger.error('Failed to load session logs:', { error })
    }
  }, [selectedSession])

  // Load agents on mount
  useEffect(() => {
    loadAgents()
  }, [loadAgents])

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
  }, [selectedSession?.id, loadSessionLogs])

  // Load sessions when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      loadSessions()
    } else {
      setSessions([])
      setSelectedSession(null)
    }
  }, [selectedAgent, loadSessions])

  // Load session logs when session is selected
  useEffect(() => {
    if (selectedSession) {
      loadSessionLogs()
    } else {
      setSessionLogs([])
    }
  }, [selectedSession, loadSessionLogs])

  const handleCreateSession = () => {
    if (!selectedAgent) return

    // Reset form and open modal
    setSessionForm({
      user_goal: '',
      max_turns: 10,
      permission_mode: 'default',
      accessible_paths: []
    })
    setSessionModalMode('create')
    setShowSessionModal(true)
  }

  const handleEditSession = (session: SessionEntity) => {
    // Populate form with existing session data
    setSessionForm({
      user_goal: session.user_goal || '',
      max_turns: session.max_turns || 10,
      permission_mode: session.permission_mode || 'default',
      accessible_paths: session.accessible_paths || []
    })
    setSessionModalMode('edit')
    setShowSessionModal(true)
  }

  const handleSessionSubmit = async () => {
    if (!selectedAgent) return

    try {
      if (sessionModalMode === 'create') {
        const input: CreateSessionInput = {
          agent_ids: [selectedAgent.id],
          user_goal: sessionForm.user_goal || 'New conversation',
          status: 'idle',
          max_turns: sessionForm.max_turns,
          permission_mode: sessionForm.permission_mode,
          accessible_paths: sessionForm.accessible_paths.length > 0 ? sessionForm.accessible_paths : undefined
        }
        const result = await window.api.session.create(input)
        if (result.success) {
          message.success('Session created successfully')
          setShowSessionModal(false)
          loadSessions()
        } else {
          message.error(result.error || 'Failed to create session')
        }
      } else {
        // Edit mode
        if (!selectedSession) return
        const input: UpdateSessionInput = {
          id: selectedSession.id,
          user_goal: sessionForm.user_goal || undefined,
          max_turns: sessionForm.max_turns,
          permission_mode: sessionForm.permission_mode,
          accessible_paths: sessionForm.accessible_paths.length > 0 ? sessionForm.accessible_paths : undefined
        }
        const result = await window.api.session.update(input)
        if (result.success) {
          message.success('Session updated successfully')
          setShowSessionModal(false)
          loadSessions()
          loadSessionLogs() // Refresh to show updated session
        } else {
          message.error(result.error || 'Failed to update session')
        }
      }
    } catch (error) {
      message.error(`Failed to ${sessionModalMode} session`)
      logger.error(`Failed to ${sessionModalMode} session:`, { error })
    }
  }

  const handleDeleteSession = async (session: SessionEntity) => {
    Modal.confirm({
      title: 'Delete Session',
      content: `Are you sure you want to delete this session? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await window.api.session.delete({ id: session.id })
          if (result.success) {
            message.success('Session deleted successfully')
            if (selectedSession?.id === session.id) {
              setSelectedSession(null)
              setSessionLogs([])
            }
            loadSessions()
          } else {
            message.error(result.error || 'Failed to delete session')
          }
        } catch (error) {
          message.error('Failed to delete session')
          logger.error('Failed to delete session:', { error })
        }
      }
    })
  }

  const handleAddPath = async () => {
    try {
      // Use the same pattern as knowledge base
      const selectedPath = await window.api.file.selectFolder()
      logger.info('Selected directory:', selectedPath)

      if (selectedPath) {
        if (!sessionForm.accessible_paths.includes(selectedPath)) {
          setSessionForm((prev) => ({
            ...prev,
            accessible_paths: [...prev.accessible_paths, selectedPath]
          }))
          message.success(`Added path: ${selectedPath}`)
        } else {
          message.warning('This path is already added')
        }
      }
    } catch (error) {
      logger.error('Failed to open directory dialog:', { error })
      // Fallback to manual input if folder selection fails
      handleAddPathManually()
    }
  }

  const handleAddPathManually = () => {
    setNewPathInput('')
    setShowAddPathModal(true)
  }

  const handleConfirmAddPath = () => {
    const trimmedPath = newPathInput.trim()
    if (trimmedPath && !sessionForm.accessible_paths.includes(trimmedPath)) {
      setSessionForm((prev) => ({
        ...prev,
        accessible_paths: [...prev.accessible_paths, trimmedPath]
      }))
      setShowAddPathModal(false)
      setNewPathInput('')
      message.success(`Added path: ${trimmedPath}`)
    } else if (sessionForm.accessible_paths.includes(trimmedPath)) {
      message.warning('This path is already added')
    } else {
      message.error('Please enter a valid path')
    }
  }

  const handleRemovePath = (pathToRemove: string) => {
    setSessionForm((prev) => ({
      ...prev,
      accessible_paths: prev.accessible_paths.filter((path) => path !== pathToRemove)
    }))
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
                <CollapseButton
                  type="text"
                  icon={<MenuFoldOutlined />}
                  size="small"
                  onClick={() => setSidebarCollapsed(true)}
                />
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
                  <SessionItem key={session.id} $selected={selectedSession?.id === session.id}>
                    <SessionContent onClick={() => setSelectedSession(session)}>
                      <SessionTitle>
                        {session.user_goal && session.user_goal !== 'New conversation'
                          ? session.user_goal
                          : 'New conversation'}
                      </SessionTitle>
                      <SessionStatus $status={session.status}>{session.status}</SessionStatus>
                      <SessionDate>{new Date(session.created_at).toLocaleDateString()}</SessionDate>
                    </SessionContent>
                    <SessionActions className="session-actions">
                      <Tooltip title="Edit session">
                        <ActionButton
                          type="text"
                          icon={<SettingOutlined />}
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditSession(session)
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="Delete session">
                        <ActionButton
                          type="text"
                          icon={<ExclamationCircleOutlined />}
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSession(session)
                          }}
                          style={{ color: 'var(--color-error)' }}
                        />
                      </Tooltip>
                    </SessionActions>
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

        {/* Collapsed sidebar expand button */}
        {sidebarCollapsed && (
          <ExpandButton
            type="text"
            icon={<MenuFoldOutlined style={{ transform: 'rotate(180deg)' }} />}
            size="small"
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
          />
        )}

        {/* Main Content Area */}
        <MainContent>
          {selectedSession ? (
            <>
              <ConversationArea>
                <ConversationHeader>
                  <ConversationTitle>
                    <h3>
                      {selectedAgent?.name} -{' '}
                      {selectedSession.user_goal && selectedSession.user_goal !== 'New conversation'
                        ? selectedSession.user_goal
                        : 'Conversation'}
                    </h3>
                  </ConversationTitle>
                  <ConversationMeta>
                    {(() => {
                      const metrics = getSessionMetrics(sessionLogs)
                      return (
                        <>
                          <SessionStatusBadge $status={selectedSession.status}>
                            {selectedSession.status}
                          </SessionStatusBadge>
                          {metrics.turns && <MetricBadge title="Number of turns">{metrics.turns} turns</MetricBadge>}
                          {metrics.duration && <MetricBadge title="Session duration">{metrics.duration}</MetricBadge>}
                          {metrics.cost && <MetricBadge title="Total cost">{metrics.cost}</MetricBadge>}
                          {metrics.hasError && (
                            <ErrorBadge title="Session has errors">
                              <ExclamationCircleOutlined />
                            </ErrorBadge>
                          )}
                        </>
                      )
                    })()}
                  </ConversationMeta>
                </ConversationHeader>
                <MessagesContainer>
                  {sessionLogs.filter(shouldDisplayLog).map((log) => {
                    const content = formatMessageContent(log)
                    if (!content) return null

                    // Render system messages differently
                    if (log.role === 'system') {
                      const isCollapsed = collapsedSystemMessages.has(log.id)
                      const metadata = extractSystemMetadata(log)
                      const title = getSystemMessageTitle(log)
                      const status = getSystemMessageStatus(log)

                      return (
                        <SystemMessageCard key={log.id} $status={status}>
                          <SystemMessageHeader
                            onClick={() => toggleSystemMessage(log.id)}
                            $clickable={metadata.length > 0}>
                            <SystemMessageTitle>
                              <SystemMessageIcon $status={status}>
                                {status === 'error' ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}
                              </SystemMessageIcon>
                              <span>{title}</span>
                            </SystemMessageTitle>
                            <SystemMessageHeaderRight>
                              <SystemMessageTime>{new Date(log.created_at).toLocaleTimeString()}</SystemMessageTime>
                              {metadata.length > 0 && (
                                <CollapseIcon $collapsed={isCollapsed}>
                                  {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                                </CollapseIcon>
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

                    // Render user and agent messages
                    const isUser = log.role === 'user'

                    return (
                      <MessageWrapper key={log.id} $align={isUser ? 'right' : 'left'}>
                        {isUser ? (
                          <UserMessage>
                            <UserMessageContent>{content}</UserMessageContent>
                            <MessageTimestamp>{new Date(log.created_at).toLocaleTimeString()}</MessageTimestamp>
                          </UserMessage>
                        ) : (
                          <AgentMessage>
                            <AgentAvatar>🤖</AgentAvatar>
                            <AgentMessageContent>
                              <AgentMessageText dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }} />
                              <MessageTimestamp>{new Date(log.created_at).toLocaleTimeString()}</MessageTimestamp>
                            </AgentMessageContent>
                          </AgentMessage>
                        )}
                      </MessageWrapper>
                    )
                  })}
                  {sessionLogs.filter(shouldDisplayLog).length === 0 && (
                    <EmptyConversation>
                      <EmptyConversationIcon>💬</EmptyConversationIcon>
                      <EmptyConversationTitle>No messages yet</EmptyConversationTitle>
                      <EmptyConversationSubtitle>Start the conversation below!</EmptyConversationSubtitle>
                    </EmptyConversation>
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

      {/* Session Configuration Modal */}
      <Modal
        title={sessionModalMode === 'create' ? 'Create New Session' : 'Edit Session'}
        open={showSessionModal}
        onOk={handleSessionSubmit}
        onCancel={() => setShowSessionModal(false)}
        width={600}
        okText={sessionModalMode === 'create' ? 'Create Session' : 'Update Session'}>
        <SessionModalContent>
          <FormSection>
            <FormLabel>Session Goal</FormLabel>
            <Input.TextArea
              value={sessionForm.user_goal}
              onChange={(e) => setSessionForm((prev) => ({ ...prev, user_goal: e.target.value }))}
              placeholder="Describe what you want to accomplish in this session..."
              rows={3}
            />
            <FormHint>This helps the agent understand your objectives and provide better assistance.</FormHint>
          </FormSection>

          <FormSection>
            <FormLabel>Maximum Turns</FormLabel>
            <Input
              type="number"
              min={1}
              max={100}
              value={sessionForm.max_turns}
              onChange={(e) => setSessionForm((prev) => ({ ...prev, max_turns: parseInt(e.target.value) || 10 }))}
              placeholder="10"
            />
            <FormHint>Maximum number of conversation turns allowed in this session.</FormHint>
          </FormSection>

          <FormSection>
            <FormLabel>Permission Mode</FormLabel>
            <Select
              value={sessionForm.permission_mode}
              onChange={(value) => setSessionForm((prev) => ({ ...prev, permission_mode: value }))}
              style={{ width: '100%' }}>
              <Select.Option value="default">Default - Ask for permissions</Select.Option>
              <Select.Option value="acceptEdits">Accept Edits - Auto-approve file changes</Select.Option>
              <Select.Option value="bypassPermissions">Bypass All - Full access</Select.Option>
            </Select>
            <FormHint>Controls how the agent handles file operations and system commands.</FormHint>
          </FormSection>

          <FormSection>
            <FormLabel>
              Accessible Paths
              <div style={{ marginLeft: 8, display: 'flex', gap: 4 }}>
                <Button
                  type="link"
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={handleAddPath}
                  style={{ padding: '0 4px' }}>
                  Browse
                </Button>
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleAddPathManually}
                  style={{ padding: '0 4px' }}>
                  Manual
                </Button>
              </div>
            </FormLabel>
            {sessionForm.accessible_paths.length === 0 ? (
              <EmptyPathsMessage>No paths configured. Agent will use default working directory.</EmptyPathsMessage>
            ) : (
              <PathsList>
                {sessionForm.accessible_paths.map((path, index) => (
                  <PathItem key={index}>
                    <PathText>{path}</PathText>
                    <Button
                      type="text"
                      size="small"
                      icon={<ExclamationCircleOutlined />}
                      onClick={() => handleRemovePath(path)}
                      style={{ color: 'var(--color-error)', padding: 0 }}
                    />
                  </PathItem>
                ))}
              </PathsList>
            )}
            <FormHint>Directories the agent can access for file operations. Leave empty for default access.</FormHint>
          </FormSection>
        </SessionModalContent>
      </Modal>

      {/* Add Path Modal */}
      <Modal
        title="Add Directory Path"
        open={showAddPathModal}
        onOk={handleConfirmAddPath}
        onCancel={() => {
          setShowAddPathModal(false)
          setNewPathInput('')
        }}
        width={500}
        okText="Add Path">
        <div style={{ padding: '8px 0' }}>
          <FormLabel style={{ marginBottom: '8px' }}>Directory Path</FormLabel>
          <Input
            value={newPathInput}
            onChange={(e) => setNewPathInput(e.target.value)}
            placeholder="Enter the full path to the directory (e.g., /Users/username/Projects)"
            onPressEnter={handleConfirmAddPath}
            autoFocus
          />
          <FormHint style={{ marginTop: '8px' }}>
            Enter the absolute path to a directory that the agent should have access to. This allows the agent to read,
            write, and execute files within this directory.
          </FormHint>
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

const ExpandButton = styled(Button)`
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    color: var(--color-text);
    background-color: var(--color-background-hover);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &:focus {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--color-primary);
  }
`

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0; /* Allow flex shrinking */
  position: relative;
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

const SessionContent = styled.div`
  flex: 1;
  padding: 12px;
  cursor: pointer;
  min-width: 0;
`

const SessionActions = styled.div`
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
  overflow: auto;
  max-height: 88%;
`

const ConversationHeader = styled.div`
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

const ConversationTitle = styled.div`
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

const ConversationMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

const MetricBadge = styled.span`
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background-color: var(--color-background-muted);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  white-space: nowrap;
`

const ErrorBadge = styled.span`
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

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: linear-gradient(to bottom, var(--color-background), var(--color-background-soft));
`

// System Message Styles
const SystemMessageCard = styled.div<{ $status: 'info' | 'success' | 'warning' | 'error' }>`
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

const SystemMessageHeader = styled.div<{ $clickable: boolean }>`
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

const SystemMessageTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
`

const SystemMessageIcon = styled.div<{ $status: 'info' | 'success' | 'warning' | 'error' }>`
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

const SystemMessageHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const SystemMessageTime = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
`

const CollapseIcon = styled.div<{ $collapsed: boolean }>`
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary);
  transition: transform 0.2s ease;
  transform: ${(props) => (props.$collapsed ? 'rotate(0deg)' : 'rotate(0deg)')};
`

const SystemMessageContent = styled.div`
  padding: 16px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-background);
`

const MetadataItem = styled.div`
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

const MetadataLabel = styled.div`
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

const MetadataIcon = styled.div`
  width: 12px;
  height: 12px;
  color: var(--color-text-tertiary);
`

const MetadataValue = styled.div`
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
const MessageWrapper = styled.div<{ $align: 'left' | 'right' }>`
  display: flex;
  justify-content: ${(props) => (props.$align === 'right' ? 'flex-end' : 'flex-start')};
  animation: ${fadeIn} 0.3s ease-out;
`

// User Message Styles
const UserMessage = styled.div`
  max-width: 70%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #1890ff));
  color: white;
  border-radius: 18px 18px 4px 18px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
  position: relative;
`

const UserMessageContent = styled.div`
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  margin-bottom: 4px;
`

// Agent Message Styles
const AgentMessage = styled.div`
  max-width: 85%;
  display: flex;
  gap: 12px;
  align-items: flex-start;
`

const AgentAvatar = styled.div`
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

const AgentMessageContent = styled.div`
  flex: 1;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px 18px 18px 18px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`

const AgentMessageText = styled.div`
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
const MessageTimestamp = styled.div`
  font-size: 11px;
  opacity: 0.7;
  padding: 8px 16px;
  background: var(--color-background-soft);
  border-top: 1px solid var(--color-border-light);
  color: var(--color-text-tertiary);
`

// Empty State
const EmptyConversation = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  flex: 1;
`

const EmptyConversationIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
`

const EmptyConversationTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 8px;
`

const EmptyConversationSubtitle = styled.div`
  font-size: 14px;
  color: var(--color-text-secondary);
`

const InputArea = styled.div`
  padding: 20px 24px;
  flex-shrink: 0;
`

const MessageInput = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
`

const SendButton = styled(Button)`
  height: auto;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.2);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(24, 144, 255, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
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

// Session Modal Styles
const SessionModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 8px 0;
`

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const FormLabel = styled.label`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
  display: flex;
  align-items: center;
`

const FormHint = styled.div`
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-style: italic;
`

const EmptyPathsMessage = styled.div`
  padding: 16px;
  background: var(--color-background-muted);
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
`

const PathsList = styled.div`
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

const PathItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  gap: 8px;
`

const PathText = styled.div`
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export default CherryAgentPage
