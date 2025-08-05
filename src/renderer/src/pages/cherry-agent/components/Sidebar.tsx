import { DeleteOutlined, MenuFoldOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import InstallNpxUv from '@renderer/pages/settings/MCPSettings/InstallNpxUv'
import { AgentEntity, SessionEntity } from '@renderer/types/agent'
import { Button, Tooltip } from 'antd'
import React from 'react'

import {
  ActionButton,
  AgentActions,
  AgentItem,
  AgentModel,
  AgentName,
  AgentsList,
  CollapseButton,
  EmptyMessage,
  FooterLabel,
  HeaderActions,
  HeaderLabel,
  SectionHeader,
  SessionActions,
  SessionContent,
  SessionDate,
  SessionItem,
  SessionsLabel,
  SessionsList,
  SessionStatus,
  SessionTitle,
  SidebarComponent,
  SidebarContent,
  SidebarFooter,
  SidebarHeader
} from '../styles'

interface SidebarProps {
  agents: AgentEntity[]
  selectedAgent: AgentEntity | null
  setSelectedAgent: (agent: AgentEntity) => void
  sessions: SessionEntity[]
  selectedSession: SessionEntity | null
  setSelectedSession: (session: SessionEntity) => void
  onCreateAgent: () => void
  onEditAgent: (agent: AgentEntity) => void
  onCreateSession: () => void
  onEditSession: (session: SessionEntity) => void
  onDeleteSession: (session: SessionEntity) => void
  onCollapse: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  agents,
  selectedAgent,
  setSelectedAgent,
  sessions,
  selectedSession,
  setSelectedSession,
  onCreateAgent,
  onEditAgent,
  onCreateSession,
  onEditSession,
  onDeleteSession,
  onCollapse
}) => {
  return (
    <SidebarComponent>
      <SidebarHeader>
        <InstallNpxUv />
        <HeaderLabel>agents</HeaderLabel>
        <HeaderActions>
          {agents.length === 0 ? (
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={onCreateAgent}>
              Create Agent
            </Button>
          ) : (
            <ActionButton
              type="text"
              icon={<PlusOutlined />}
              size="small"
              title="Create New Agent"
              onClick={onCreateAgent}
            />
          )}
          <CollapseButton type="text" icon={<MenuFoldOutlined />} size="small" onClick={onCollapse} />
        </HeaderActions>
      </SidebarHeader>
      <SidebarContent>
        {/* Agents Section */}
        <AgentsList>
          {agents.map((agent) => (
            <AgentItem key={agent.id} $selected={selectedAgent?.id === agent.id}>
              <SessionContent onClick={() => setSelectedAgent(agent)}>
                <AgentName>{agent.name}</AgentName>
                <AgentModel>{agent.model}</AgentModel>
              </SessionContent>
              <AgentActions className="agent-actions">
                <Tooltip title="Edit agent">
                  <ActionButton
                    type="text"
                    icon={<SettingOutlined />}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditAgent(agent)
                    }}
                  />
                </Tooltip>
              </AgentActions>
            </AgentItem>
          ))}
          {agents.length === 0 && <EmptyMessage>No agents yet. Create one to get started!</EmptyMessage>}
        </AgentsList>

        {/* Sessions Section */}
        <SectionHeader style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <SessionsLabel>sessions {selectedAgent ? `(${selectedAgent.name})` : ''}</SessionsLabel>
          {selectedAgent && (
            <Tooltip title="Create new session">
              <ActionButton type="text" icon={<PlusOutlined />} size="small" onClick={onCreateSession} />
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
                      onEditSession(session)
                    }}
                  />
                </Tooltip>
                <Tooltip title="Delete session">
                  <ActionButton
                    type="text"
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(session)
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
    </SidebarComponent>
  )
}
