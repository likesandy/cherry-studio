import { ExclamationCircleOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons'
import { PermissionMode } from '@renderer/types/agent'
import { Button, Input, Modal, Select } from 'antd'
import React from 'react'

import {
  EmptyPathsMessage,
  FormHint,
  FormLabel,
  FormSection,
  PathItem,
  PathsList,
  PathText,
  SessionModalContent
} from '../../styles'

interface SessionModalProps {
  open: boolean
  onOk: () => void
  onCancel: () => void
  mode: 'create' | 'edit'
  sessionForm: {
    user_goal: string
    max_turns: number
    permission_mode: PermissionMode
    accessible_paths: string[]
  }
  setSessionForm: (
    form:
      | {
          user_goal: string
          max_turns: number
          permission_mode: PermissionMode
          accessible_paths: string[]
        }
      | ((prev: any) => any)
  ) => void
  onAddPath: () => void
  onAddPathManually: () => void
  onRemovePath: (path: string) => void
}

export const SessionModal: React.FC<SessionModalProps> = ({
  open,
  onOk,
  onCancel,
  mode,
  sessionForm,
  setSessionForm,
  onAddPath,
  onAddPathManually,
  onRemovePath
}) => {
  return (
    <Modal
      title={mode === 'create' ? 'Create New Session' : 'Edit Session'}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      width={600}
      okText={mode === 'create' ? 'Create Session' : 'Update Session'}>
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
                onClick={onAddPath}
                style={{ padding: '0 4px' }}>
                Browse
              </Button>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={onAddPathManually}
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
                    onClick={() => onRemovePath(path)}
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
  )
}
