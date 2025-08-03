import {
  DeleteOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useAgentManagement } from '@renderer/hooks/useAgentManagement'
import { useCommandHistory } from '@renderer/hooks/useCommandHistory'
import { usePocCommand } from '@renderer/hooks/usePocCommand'
import { usePocMessages } from '@renderer/hooks/usePocMessages'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import type { AgentResponse, SessionResponse } from '@types'
import { Button, Dropdown, Menu, Modal, Tooltip } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

import AgentManagementModal from './components/AgentManagementModal'
import CherryAgentSettingsModal from './components/CherryAgentSettingsModal'
import EnhancedCommandInput from './components/EnhancedCommandInput'
import PocMessageList from './components/PocMessageList'
import SessionManagementModal from './components/SessionManagementModal'

// Utility function to generate consistent colors for agent avatars
const getAvatarGradient = (name: string) => {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #ff8a80 0%, #ea6e6e 100%)',
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'
  ]

  // Simple hash function to get consistent color based on name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return gradients[Math.abs(hash) % gradients.length]
}

const CherryAgentPage: React.FC = () => {
  const { isLeftNavbar } = useNavbarPosition()

  // Initialize hooks
  const agentManagement = useAgentManagement()
  const messagesHook = usePocMessages(agentManagement.currentSession?.id)
  const commandHook = usePocCommand()
  const historyHook = useCommandHistory()

  // Local state for command count tracking
  const [commandCount, setCommandCount] = useState(0)
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState<string>('/Users/weliu')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentResponse | null>(null)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [editingSession, setEditingSession] = useState<SessionResponse | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Handle command execution
  const handleExecuteCommand = useCallback(
    async (command: string) => {
      // Add to history
      historyHook.addToHistory(command)

      // Get working directory from current session
      const workingDirectory = agentManagement.currentSession?.accessible_paths?.[0] || currentWorkingDirectory

      // Execute command
      const commandId = await commandHook.executeCommand(command, workingDirectory)
      if (commandId) {
        // Add user command message (now async)
        await messagesHook.addUserCommand(command, commandId, agentManagement.currentSession?.id)
        setCommandCount((prev) => prev + 1)
      }
    },
    [commandHook, messagesHook, historyHook, agentManagement.currentSession, currentWorkingDirectory]
  )

  // Set up output callback to connect command hook with messages hook
  useEffect(() => {
    commandHook.setOutputCallback(async (commandId: string, output: string, isBuffered: boolean) => {
      // When we receive buffered output, append it to messages
      // Note: The type determination (stdout vs stderr) is handled in usePocMessages
      // based on the command output type from AgentCommandService
      if (isBuffered && output) {
        await messagesHook.appendOutput(commandId, output, 'output', false, agentManagement.currentSession?.id)
      }
    })
  }, [commandHook, messagesHook, agentManagement.currentSession?.id])

  // Determine current status for status bar
  const getCommandStatus = useCallback(() => {
    if (commandHook.isExecuting) {
      return 'running' as const
    }
    return 'idle' as const
  }, [commandHook.isExecuting])

  // Get current running command for display
  const getCurrentCommand = useCallback(() => {
    if (commandHook.currentCommandId) {
      const command = commandHook.getCommandInfo(commandHook.currentCommandId)
      return command?.command
    }
    return undefined
  }, [commandHook])

  // Handle settings modal
  const handleOpenSettings = useCallback(() => {
    setShowSettingsModal(true)
  }, [])

  const handleCloseSettings = useCallback(() => {
    setShowSettingsModal(false)
  }, [])

  const handleSaveSettings = useCallback((workingDirectory: string) => {
    setCurrentWorkingDirectory(workingDirectory)
  }, [])

  // Handle agent modal
  const handleCreateAgent = useCallback(() => {
    setEditingAgent(null)
    setShowAgentModal(true)
  }, [])

  const handleEditAgent = useCallback((agent: AgentResponse) => {
    setEditingAgent(agent)
    setShowAgentModal(true)
  }, [])

  const handleCloseAgentModal = useCallback(() => {
    setShowAgentModal(false)
    setEditingAgent(null)
  }, [])

  const handleSaveAgent = useCallback(
    async (agentData: AgentResponse) => {
      if (editingAgent) {
        // Update existing agent
        await agentManagement.updateAgent({
          id: editingAgent.id,
          name: agentData.name,
          description: agentData.description,
          avatar: agentData.avatar,
          instructions: agentData.instructions,
          model: agentData.model,
          tools: agentData.tools,
          knowledges: agentData.knowledges,
          configuration: agentData.configuration
        })
      } else {
        // Create new agent
        await agentManagement.createAgent({
          name: agentData.name,
          description: agentData.description,
          avatar: agentData.avatar,
          instructions: agentData.instructions,
          model: agentData.model,
          tools: agentData.tools,
          knowledges: agentData.knowledges,
          configuration: agentData.configuration
        })
      }
      handleCloseAgentModal()
    },
    [editingAgent, agentManagement, handleCloseAgentModal]
  )

  // Handle session modal
  const handleCreateSession = useCallback(() => {
    setEditingSession(null)
    setShowSessionModal(true)
  }, [])

  const handleEditSession = useCallback((session: SessionResponse) => {
    setEditingSession(session)
    setShowSessionModal(true)
  }, [])

  const handleCloseSessionModal = useCallback(() => {
    setShowSessionModal(false)
    setEditingSession(null)
  }, [])

  const handleSaveSession = useCallback(
    async (sessionData: SessionResponse) => {
      if (editingSession) {
        // Update existing session
        await agentManagement.updateSession({
          id: editingSession.id,
          user_prompt: sessionData.user_prompt,
          agent_ids: sessionData.agent_ids,
          status: sessionData.status,
          accessible_paths: sessionData.accessible_paths
        })
      } else {
        // Create new session
        const newSession = await agentManagement.createSession({
          user_prompt: sessionData.user_prompt,
          agent_ids: sessionData.agent_ids,
          status: sessionData.status || 'idle',
          accessible_paths: sessionData.accessible_paths
        })
        // Set the new session as current
        if (newSession) {
          agentManagement.setCurrentSession(newSession)
        }
      }
      handleCloseSessionModal()
    },
    [editingSession, agentManagement, handleCloseSessionModal]
  )

  const handleDeleteAgent = useCallback(
    async (agent: AgentResponse) => {
      Modal.confirm({
        title: 'Delete Agent',
        content: `Are you sure you want to delete the agent "${agent.name}"?`,
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          await agentManagement.deleteAgent(agent.id)
          // If we deleted the current agent, switch to another one
          if (agentManagement.currentAgent?.id === agent.id && agentManagement.agents.length > 1) {
            const remainingAgents = agentManagement.agents.filter((a) => a.id !== agent.id)
            if (remainingAgents.length > 0) {
              agentManagement.setCurrentAgent(remainingAgents[0])
            }
          }
        }
      })
    },
    [agentManagement]
  )

  const handleDeleteSession = useCallback(
    async (session: SessionResponse) => {
      Modal.confirm({
        title: 'Delete Session',
        content: `Are you sure you want to delete the session "${session.user_prompt || session.id.slice(0, 8)}"?`,
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          await agentManagement.deleteSession(session.id)
        }
      })
    },
    [agentManagement]
  )

  // Handle command cancellation
  const handleCancelCommand = useCallback(async () => {
    if (commandHook.currentCommandId) {
      const success = await commandHook.interruptCommand(commandHook.currentCommandId)
      if (success) {
        await messagesHook.appendOutput(
          commandHook.currentCommandId,
          '\n[Command cancelled by user]',
          'error',
          true,
          agentManagement.currentSession?.id
        )
      }
    }
  }, [commandHook, messagesHook, agentManagement.currentSession?.id])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev)
  }, [])

  // Handle session selection
  const handleSessionSelect = useCallback(
    async (session: any) => {
      agentManagement.setCurrentSession(session)
      // Load session logs from database when switching sessions
      if (session?.id) {
        await messagesHook.loadSessionLogs(session.id)
      }
    },
    [agentManagement, messagesHook]
  )

  // Handle agent name change
  const handleAgentNameChange = useCallback(
    async (newName: string) => {
      if (agentManagement.currentAgent && newName !== agentManagement.currentAgent.name) {
        await agentManagement.updateAgent({
          id: agentManagement.currentAgent.id,
          name: newName
        })
      }
    },
    [agentManagement]
  )

  // Filter sessions for the current agent
  const filteredSessions = agentManagement.sessions.filter(
    (session) => agentManagement.currentAgent && session.agent_ids.includes(agentManagement.currentAgent.id)
  )

  // Set the first agent as current if none is selected
  useEffect(() => {
    if (!agentManagement.currentAgent && agentManagement.agents.length > 0) {
      agentManagement.setCurrentAgent(agentManagement.agents[0])
    }
  }, [agentManagement])

  // Create a default session for the current agent if none exists
  useEffect(() => {
    if (agentManagement.currentAgent && !agentManagement.currentSession && !agentManagement.loadingSessions) {
      if (agentManagement.sessions.length === 0) {
        agentManagement.createSession({
          agent_ids: [agentManagement.currentAgent.id],
          user_prompt: 'New session',
          status: 'idle',
          accessible_paths: [currentWorkingDirectory]
        })
      } else {
        // Set the first session as current
        agentManagement.setCurrentSession(agentManagement.sessions[0])
      }
    }
  }, [agentManagement, currentWorkingDirectory])

  // Load session logs when current session changes
  useEffect(() => {
    if (agentManagement.currentSession?.id) {
      messagesHook.loadSessionLogs(agentManagement.currentSession.id)
    }
  }, [agentManagement.currentSession?.id, messagesHook])

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
                {agentManagement.agents.length === 0 ? (
                  <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleCreateAgent}>
                    Create Agent
                  </Button>
                ) : (
                  <ActionButton
                    type="text"
                    icon={<PlusOutlined />}
                    size="small"
                    title="Create New Agent"
                    onClick={handleCreateAgent}
                  />
                )}
                <CollapseButton type="text" icon={<MenuFoldOutlined />} onClick={toggleSidebar} size="small" />
              </HeaderActions>
            </SidebarHeader>
            <SidebarContent>
              {/* Agents Section */}
              <AgentsList>
                {agentManagement.agents.map((agent) => (
                  <Dropdown
                    key={agent.id}
                    overlay={
                      <Menu>
                        <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => handleEditAgent(agent)}>
                          Edit Agent
                        </Menu.Item>
                        <Menu.Item
                          key="delete"
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteAgent(agent)}
                          danger>
                          Delete Agent
                        </Menu.Item>
                      </Menu>
                    }
                    trigger={['contextMenu']}>
                    <AgentItem
                      active={agentManagement.currentAgent?.id === agent.id}
                      onClick={() => agentManagement.setCurrentAgent(agent)}>
                      <AgentAvatar style={{ background: getAvatarGradient(agent.name) }}>
                        {agent.name.charAt(0).toUpperCase()}
                      </AgentAvatar>
                      <AgentInfo>
                        <AgentName>{agent.name}</AgentName>
                        <AgentDescription>{agent.description || 'No description'}</AgentDescription>
                      </AgentInfo>
                    </AgentItem>
                  </Dropdown>
                ))}
                {agentManagement.agents.length === 0 && !agentManagement.loadingAgents && (
                  <EmptyState>No agents available</EmptyState>
                )}
              </AgentsList>

              {/* Sessions Section */}
              <SectionHeader style={{ marginTop: '32px' }}>
                <SessionsLabel>sessions</SessionsLabel>
                <Tooltip title="Create new session">
                  <ActionButton type="text" icon={<PlusOutlined />} onClick={handleCreateSession} size="small" />
                </Tooltip>
              </SectionHeader>
              <SessionsList>
                {filteredSessions.map((session) => (
                  <Dropdown
                    key={session.id}
                    overlay={
                      <Menu>
                        <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => handleEditSession(session)}>
                          Edit Session
                        </Menu.Item>
                        <Menu.Item
                          key="delete"
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteSession(session)}
                          danger>
                          Delete Session
                        </Menu.Item>
                      </Menu>
                    }
                    trigger={['contextMenu']}>
                    <SessionItem
                      active={agentManagement.currentSession?.id === session.id}
                      onClick={() => handleSessionSelect(session)}>
                      <SessionInfo>
                        <SessionTitle>{session.user_prompt || `Session ${session.id.slice(0, 8)}`}</SessionTitle>
                        <SessionMeta>
                          {session.agent_ids.length} agent{session.agent_ids.length !== 1 ? 's' : ''} • {session.status}
                        </SessionMeta>
                      </SessionInfo>
                    </SessionItem>
                  </Dropdown>
                ))}
                {filteredSessions.length === 0 && !agentManagement.loadingSessions && (
                  <EmptyState>
                    {agentManagement.currentAgent
                      ? `No sessions for ${agentManagement.currentAgent.name}`
                      : 'No sessions available'}
                  </EmptyState>
                )}
              </SessionsList>
            </SidebarContent>
            <SidebarFooter>
              <FooterLabel>footer</FooterLabel>
              <ActionButton
                type="text"
                icon={<SettingOutlined />}
                onClick={handleOpenSettings}
                title="Settings"
                size="small"
              />
            </SidebarFooter>
          </Sidebar>
        )}

        {/* Main Content Area */}
        <MainContent>
          {agentManagement.currentAgent ? (
            <>
              {/* Agent Info Header */}
              <AgentHeader>
                {sidebarCollapsed && (
                  <ToggleButton type="text" icon={<MenuUnfoldOutlined />} onClick={toggleSidebar} size="small" />
                )}
                <CurrentAgentAvatar style={{ background: getAvatarGradient(agentManagement.currentAgent.name) }}>
                  {agentManagement.currentAgent.name.charAt(0).toUpperCase()}
                </CurrentAgentAvatar>
                <AgentTitleSection>
                  <AgentNameInput
                    value={agentManagement.currentAgent.name}
                    onChange={(e) => handleAgentNameChange(e.target.value)}
                    onBlur={(e) => handleAgentNameChange(e.target.value)}
                    placeholder="Agent Name"
                  />
                  <AgentSubtitle>{agentManagement.currentAgent.description || 'No description provided'}</AgentSubtitle>
                </AgentTitleSection>
              </AgentHeader>

              <MessageArea>
                <PocMessageList
                  messages={
                    agentManagement.currentSession
                      ? messagesHook.getMessagesForSession(agentManagement.currentSession.id)
                      : []
                  }
                />
              </MessageArea>

              <InputArea>
                <EnhancedCommandInput
                  status={getCommandStatus()}
                  activeCommand={getCurrentCommand()}
                  commandCount={commandCount}
                  onSendCommand={handleExecuteCommand}
                  onCancelCommand={commandHook.isExecuting ? handleCancelCommand : undefined}
                  onOpenSettings={handleOpenSettings}
                  disabled={commandHook.isExecuting}
                />
              </InputArea>
            </>
          ) : (
            <EmptyAgentState>
              {sidebarCollapsed && (
                <ToggleButton
                  type="text"
                  icon={<MenuUnfoldOutlined />}
                  onClick={toggleSidebar}
                  size="small"
                  style={{ position: 'absolute', top: '20px', left: '20px' }}
                />
              )}
              <EmptyStateContent>
                <EmptyStateTitle>No Agent Selected</EmptyStateTitle>
                <EmptyStateDescription>
                  Create an agent to get started with Cherry Agent. You can create different agents with specific roles
                  and capabilities.
                </EmptyStateDescription>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateAgent} size="large">
                  Create Your First Agent
                </Button>
              </EmptyStateContent>
            </EmptyAgentState>
          )}
        </MainContent>
      </ContentContainer>
      <CherryAgentSettingsModal
        visible={showSettingsModal}
        onClose={handleCloseSettings}
        onSave={handleSaveSettings}
        currentWorkingDirectory={currentWorkingDirectory}
      />
      <AgentManagementModal
        visible={showAgentModal}
        onClose={handleCloseAgentModal}
        onSave={handleSaveAgent}
        agent={editingAgent}
        loading={agentManagement.loadingAgents}
      />
      <SessionManagementModal
        visible={showSessionModal}
        onClose={handleCloseSessionModal}
        onSave={handleSaveSession}
        session={editingSession}
        agents={agentManagement.agents}
        loading={agentManagement.loadingSessions}
        currentWorkingDirectory={currentWorkingDirectory}
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  [navbar-position='left'] & {
    max-width: calc(100vw - var(--sidebar-width));
  }
  [navbar-position='top'] & {
    max-width: 100vw;
  }
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;
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
`

const AgentHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 80px;
  background: linear-gradient(135deg, var(--color-background) 0%, var(--color-background-soft) 100%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
`

const ToggleButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  width: 36px;
  height: 36px;
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

const MessageArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px;
  background-color: var(--color-background);
`

const InputArea = styled.div`
  padding: 16px 24px 20px 24px;
  border-top: 1px solid var(--color-border);
  background: linear-gradient(180deg, var(--color-background-soft) 0%, var(--color-background) 100%);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
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

const SessionItem = styled.div<{ active: boolean }>`
  flex: 1;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: ${(props) => (props.active ? 'var(--color-primary)' : 'var(--color-background-soft)')};
  color: ${(props) => (props.active ? 'white' : 'var(--color-text)')};
  cursor: pointer;
  transition: all 0.2s ease;
  border: ${(props) => (props.active ? 'none' : '1px solid transparent')};
  box-shadow: ${(props) => (props.active ? '0 2px 8px rgba(24, 144, 255, 0.2)' : 'none')};
  user-select: none;

  &:hover {
    background-color: ${(props) => (props.active ? 'var(--color-primary)' : 'var(--color-background-hover)')};
    border-color: ${(props) => (props.active ? 'transparent' : 'var(--color-border)')};
    transform: translateY(-1px);
    box-shadow: ${(props) => (props.active ? '0 4px 12px rgba(24, 144, 255, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)')};
  }

  &:active {
    transform: translateY(0);
  }
`

const SessionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const SessionTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
`

const SessionMeta = styled.div`
  font-size: 11px;
  opacity: 0.8;
  line-height: 1;
`

const EmptyState = styled.div`
  padding: 20px;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 14px;
  font-style: italic;
`

const EmptyAgentState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, var(--color-background) 0%, var(--color-background-soft) 100%);
`

const EmptyStateContent = styled.div`
  text-align: center;
  max-width: 400px;
  padding: 40px;
`

const EmptyStateTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px 0;
`

const EmptyStateDescription = styled.p`
  font-size: 16px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 32px 0;
`

const AgentTitleSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const AgentNameInput = styled.input`
  border: 2px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 18px;
  font-weight: 600;
  background-color: transparent;
  color: var(--color-text);
  outline: none;
  transition: all 0.2s ease;
  width: 100%;

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1);
  }

  &:hover {
    border-color: var(--color-primary-hover);
  }

  &::placeholder {
    color: var(--color-text-tertiary);
    font-weight: 400;
  }
`

const AgentSubtitle = styled.div`
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 400;
`

const CurrentAgentAvatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 18px;
  flex-shrink: 0;
`

const AgentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
  overflow: auto;
`

const AgentItem = styled.div<{ active: boolean }>`
  flex: 1;
  width: 100%;
  padding: 6px;
  border-radius: 4px;
  background-color: ${(props) => (props.active ? 'var(--color-primary)' : 'var(--color-background-soft)')};
  color: ${(props) => (props.active ? 'white' : 'var(--color-text)')};
  cursor: pointer;
  transition: all 0.2s ease;
  border: ${(props) => (props.active ? 'none' : '1px solid transparent')};
  box-shadow: ${(props) => (props.active ? '0 2px 8px rgba(24, 144, 255, 0.2)' : 'none')};
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background-color: ${(props) => (props.active ? 'var(--color-primary)' : 'var(--color-background-hover)')};
    border-color: ${(props) => (props.active ? 'transparent' : 'var(--color-border)')};
    transform: translateY(-1px);
    box-shadow: ${(props) => (props.active ? '0 4px 12px rgba(24, 144, 255, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)')};
  }

  &:active {
    transform: translateY(0);
  }
`

const AgentAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
`

const AgentInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const AgentName = styled.div`
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const AgentDescription = styled.div`
  font-size: 12px;
  opacity: 0.8;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export default CherryAgentPage
