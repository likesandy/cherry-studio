import { MenuFoldOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { Button, Tooltip } from 'antd'
import React, { useState } from 'react'
import styled from 'styled-components'

const CherryAgentPage: React.FC = () => {
  const { isLeftNavbar } = useNavbarPosition()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
                  <Button type="primary" icon={<PlusOutlined />} size="small">
                    Create Agent
                  </Button>
                ) : (
                  <ActionButton type="text" icon={<PlusOutlined />} size="small" title="Create New Agent" />
                )}
                <CollapseButton type="text" icon={<MenuFoldOutlined />} size="small" />
              </HeaderActions>
            </SidebarHeader>
            <SidebarContent>
              {/* Agents Section */}
              <AgentsList></AgentsList>

              {/* Sessions Section */}
              <SectionHeader style={{ marginTop: '32px' }}>
                <SessionsLabel>sessions</SessionsLabel>
                <Tooltip title="Create new session">
                  <ActionButton type="text" icon={<PlusOutlined />} size="small" />
                </Tooltip>
              </SectionHeader>
              <SessionsList></SessionsList>
            </SidebarContent>
            <SidebarFooter>
              <FooterLabel>footer</FooterLabel>
              <ActionButton type="text" icon={<SettingOutlined />} title="Settings" size="small" />
            </SidebarFooter>
          </Sidebar>
        )}
      </ContentContainer>

      {/* Main Content Area */}
      <MainContent></MainContent>
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
