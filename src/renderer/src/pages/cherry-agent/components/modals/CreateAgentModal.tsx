import { Input, Modal, Select } from 'antd'
import React from 'react'

interface CreateAgentModalProps {
  open: boolean
  onOk: () => void
  onCancel: () => void
  createForm: { name: string; model: string }
  setCreateForm: (form: { name: string; model: string }) => void
}

export const CreateAgentModal: React.FC<CreateAgentModalProps> = ({
  open,
  onOk,
  onCancel,
  createForm,
  setCreateForm
}) => {
  return (
    <Modal title="Create New Agent" open={open} onOk={onOk} onCancel={onCancel} width={400}>
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
  )
}
