import { MenuFoldOutlined } from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { loggerService } from '@renderer/services/LoggerService'
import { message } from 'antd'
import React, { useState } from 'react'

import { ConversationArea, InputArea, Sidebar } from './components'
import { AddPathModal, CreateAgentModal, SessionModal } from './components/modals'
import { useAgentExecution, useAgents, useCollapsibleMessages, useSessionLogs, useSessions } from './hooks'
import { Container, ContentContainer, ExpandButton, MainContent, SelectionPrompt } from './styles'

const logger = loggerService.withContext('CherryAgentPage')

const CherryAgentPage: React.FC = () => {
  const { isLeftNavbar } = useNavbarPosition()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // State for modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', model: 'claude-3-5-sonnet-20241022' })
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionModalMode, setSessionModalMode] = useState<'create' | 'edit'>('create')
  const [sessionForm, setSessionForm] = useState<{
    user_goal: string
    max_turns: number
    permission_mode: 'default' | 'acceptEdits' | 'bypassPermissions'
    accessible_paths: string[]
  }>({
    user_goal: '',
    max_turns: 10,
    permission_mode: 'default',
    accessible_paths: []
  })
  const [showAddPathModal, setShowAddPathModal] = useState(false)
  const [newPathInput, setNewPathInput] = useState('')
  const [inputMessage, setInputMessage] = useState('')

  // Custom hooks
  const { agents, selectedAgent, setSelectedAgent, createAgent } = useAgents()
  const { sessions, selectedSession, setSelectedSession, createSession, updateSession, deleteSession } =
    useSessions(selectedAgent)
  const { sessionLogs, loadSessionLogs } = useSessionLogs(selectedSession)
  const { collapsedSystemMessages, collapsedToolCalls, toggleSystemMessage, toggleToolCall } =
    useCollapsibleMessages(sessionLogs)
  const { isRunning, sendMessage } = useAgentExecution(selectedSession, loadSessionLogs)

  // Modal handlers
  const handleCreateAgent = async () => {
    if (!createForm.name.trim()) {
      message.error('Agent name is required')
      return
    }

    const success = await createAgent({
      name: createForm.name.trim(),
      model: createForm.model
    })

    if (success) {
      setShowCreateModal(false)
      setCreateForm({ name: '', model: 'claude-3-5-sonnet-20241022' })
    }
  }

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

  const handleEditSession = (session: any) => {
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
        const success = await createSession({
          agent_ids: [selectedAgent.id],
          user_goal: sessionForm.user_goal || 'New conversation',
          status: 'idle',
          max_turns: sessionForm.max_turns,
          permission_mode: sessionForm.permission_mode,
          accessible_paths: sessionForm.accessible_paths.length > 0 ? sessionForm.accessible_paths : undefined
        })
        if (success) {
          setShowSessionModal(false)
        }
      } else {
        // Edit mode
        if (!selectedSession) return
        const success = await updateSession({
          id: selectedSession.id,
          user_goal: sessionForm.user_goal || undefined,
          max_turns: sessionForm.max_turns,
          permission_mode: sessionForm.permission_mode,
          accessible_paths: sessionForm.accessible_paths.length > 0 ? sessionForm.accessible_paths : undefined
        })
        if (success) {
          setShowSessionModal(false)
          loadSessionLogs() // Refresh to show updated session
        }
      }
    } catch (error) {
      message.error(`Failed to ${sessionModalMode} session`)
      logger.error(`Failed to ${sessionModalMode} session:`, { error })
    }
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

    const userMessage = inputMessage.trim()
    setInputMessage('')

    const success = await sendMessage(userMessage)
    if (!success) {
      // If sending failed, restore the message
      setInputMessage(userMessage)
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
          <Sidebar
            agents={agents}
            selectedAgent={selectedAgent}
            setSelectedAgent={setSelectedAgent}
            sessions={sessions}
            selectedSession={selectedSession}
            setSelectedSession={setSelectedSession}
            onCreateAgent={() => setShowCreateModal(true)}
            onCreateSession={handleCreateSession}
            onEditSession={handleEditSession}
            onDeleteSession={deleteSession}
            onCollapse={() => setSidebarCollapsed(true)}
          />
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
              <ConversationArea
                selectedAgent={selectedAgent}
                selectedSession={selectedSession}
                sessionLogs={sessionLogs}
                collapsedSystemMessages={collapsedSystemMessages}
                collapsedToolCalls={collapsedToolCalls}
                onToggleSystemMessage={toggleSystemMessage}
                onToggleToolCall={toggleToolCall}
              />
              <InputArea
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                isRunning={isRunning}
                onSendMessage={handleSendMessage}
              />
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

      {/* Modals */}
      <CreateAgentModal
        open={showCreateModal}
        onOk={handleCreateAgent}
        onCancel={() => setShowCreateModal(false)}
        createForm={createForm}
        setCreateForm={setCreateForm}
      />

      <SessionModal
        open={showSessionModal}
        onOk={handleSessionSubmit}
        onCancel={() => setShowSessionModal(false)}
        mode={sessionModalMode}
        sessionForm={sessionForm}
        setSessionForm={setSessionForm}
        onAddPath={handleAddPath}
        onAddPathManually={handleAddPathManually}
        onRemovePath={handleRemovePath}
      />

      <AddPathModal
        open={showAddPathModal}
        onOk={handleConfirmAddPath}
        onCancel={() => {
          setShowAddPathModal(false)
          setNewPathInput('')
        }}
        newPathInput={newPathInput}
        setNewPathInput={setNewPathInput}
      />
    </Container>
  )
}

export default CherryAgentPage
