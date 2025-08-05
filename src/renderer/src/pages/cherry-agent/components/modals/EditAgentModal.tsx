import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { loggerService } from '@renderer/services/LoggerService'
import { AgentEntity, UpdateAgentInput } from '@renderer/types/agent'
import { Avatar, Button, Divider, Input, Modal, Select, Tooltip, Upload } from 'antd'
import React, { useEffect, useState } from 'react'

const logger = loggerService.withContext('EditAgentModal')

interface EditAgentModalProps {
  open: boolean
  onOk: () => void
  onCancel: () => void
  agent: AgentEntity | null
  editForm: UpdateAgentInput
  setEditForm: (form: UpdateAgentInput) => void
}

export const EditAgentModal: React.FC<EditAgentModalProps> = ({
  open,
  onOk,
  onCancel,
  agent,
  editForm,
  setEditForm
}) => {
  const [availableTools] = useState<string[]>([
    'bash',
    'file-operations',
    'web-search',
    'image-generation',
    'code-analysis'
  ])
  const [availableKnowledges] = useState<string[]>([
    'general-knowledge',
    'coding-docs',
    'company-docs',
    'technical-specs'
  ])

  // Update form when agent changes
  useEffect(() => {
    if (agent && open) {
      setEditForm({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        avatar: agent.avatar,
        instructions: agent.instructions,
        model: agent.model,
        tools: agent.tools,
        knowledges: agent.knowledges,
        configuration: agent.configuration
      })
    }
  }, [agent, open, setEditForm])

  const handleAvatarUpload = async (file: File) => {
    try {
      // Convert to base64 for storage
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        setEditForm({ ...editForm, avatar: base64 })
      }
      reader.readAsDataURL(file)
      return false // Prevent default upload
    } catch (error) {
      logger.error('Failed to upload avatar:', { error })
      return false
    }
  }

  if (!agent) return null

  return (
    <Modal
      title={`Edit Agent: ${agent.name}`}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      width={600}
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}>
      {/* Basic Information */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold' }}>Agent Name *</label>
        <Input
          value={editForm.name || ''}
          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          placeholder="Enter agent name"
          style={{ marginTop: 4 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold' }}>Description</label>
        <Input.TextArea
          value={editForm.description || ''}
          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          placeholder="Brief description of what this agent does"
          rows={2}
          style={{ marginTop: 4 }}
        />
      </div>

      {/* Avatar Section */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold' }}>Avatar</label>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={48} src={editForm.avatar} icon={!editForm.avatar && <PlusOutlined />} />
          <Upload accept="image/*" showUploadList={false} beforeUpload={handleAvatarUpload}>
            <Button icon={<UploadOutlined />} size="small">
              Upload Image
            </Button>
          </Upload>
          {editForm.avatar && (
            <Button size="small" danger onClick={() => setEditForm({ ...editForm, avatar: undefined })}>
              Remove
            </Button>
          )}
        </div>
      </div>

      <Divider />

      {/* Model Configuration */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold' }}>Model *</label>
        <Select
          value={editForm.model}
          onChange={(value) => setEditForm({ ...editForm, model: value })}
          style={{ width: '100%', marginTop: 4 }}>
          <Select.Option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</Select.Option>
          <Select.Option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</Select.Option>
          <Select.Option value="gpt-4o">GPT-4o</Select.Option>
          <Select.Option value="gpt-4o-mini">GPT-4o Mini</Select.Option>
          <Select.Option value="gemini-pro">Gemini Pro</Select.Option>
        </Select>
      </div>

      {/* System Instructions */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold' }}>System Instructions</label>
        <Input.TextArea
          value={editForm.instructions || ''}
          onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
          placeholder="System prompt that defines the agent's behavior and role"
          rows={4}
          style={{ marginTop: 4 }}
        />
      </div>

      <Divider />

      {/* Tools Selection */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold' }}>Available Tools</label>
        <Select
          mode="multiple"
          value={editForm.tools || []}
          onChange={(value) => setEditForm({ ...editForm, tools: value })}
          placeholder="Select tools this agent can use"
          style={{ width: '100%', marginTop: 4 }}>
          {availableTools.map((tool) => (
            <Select.Option key={tool} value={tool}>
              {tool.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </Select.Option>
          ))}
        </Select>
      </div>

      {/* Knowledge Bases */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold' }}>Knowledge Bases</label>
        <Select
          mode="multiple"
          value={editForm.knowledges || []}
          onChange={(value) => setEditForm({ ...editForm, knowledges: value })}
          placeholder="Select knowledge bases this agent can access"
          style={{ width: '100%', marginTop: 4 }}>
          {availableKnowledges.map((kb) => (
            <Select.Option key={kb} value={kb}>
              {kb.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </Select.Option>
          ))}
        </Select>
      </div>

      <Divider />

      {/* Advanced Configuration */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold' }}>Advanced Settings</label>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: '12px', color: '#666' }}>Temperature</label>
            <Tooltip title="Controls randomness in responses (0.0-1.0)">
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={editForm.configuration?.temperature || 0.7}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    configuration: {
                      ...editForm.configuration,
                      temperature: parseFloat(e.target.value) || 0.7
                    }
                  })
                }
                placeholder="0.7"
              />
            </Tooltip>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#666' }}>Max Tokens</label>
            <Tooltip title="Maximum tokens in response">
              <Input
                type="number"
                min={1}
                max={4096}
                value={editForm.configuration?.max_tokens || 2048}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    configuration: {
                      ...editForm.configuration,
                      max_tokens: parseInt(e.target.value) || 2048
                    }
                  })
                }
                placeholder="2048"
              />
            </Tooltip>
          </div>
        </div>
      </div>
    </Modal>
  )
}
