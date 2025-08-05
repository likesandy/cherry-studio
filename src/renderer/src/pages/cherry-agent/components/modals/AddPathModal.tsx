import { Input, Modal } from 'antd'
import React from 'react'

import { FormHint, FormLabel } from '../../styles'

interface AddPathModalProps {
  open: boolean
  onOk: () => void
  onCancel: () => void
  newPathInput: string
  setNewPathInput: (path: string) => void
}

export const AddPathModal: React.FC<AddPathModalProps> = ({ open, onOk, onCancel, newPathInput, setNewPathInput }) => {
  return (
    <Modal title="Add Directory Path" open={open} onOk={onOk} onCancel={onCancel} width={500} okText="Add Path">
      <div style={{ padding: '8px 0' }}>
        <FormLabel style={{ marginBottom: '8px' }}>Directory Path</FormLabel>
        <Input
          value={newPathInput}
          onChange={(e) => setNewPathInput(e.target.value)}
          placeholder="Enter the full path to the directory (e.g., /Users/username/Projects)"
          onPressEnter={onOk}
          autoFocus
        />
        <FormHint style={{ marginTop: '8px' }}>
          Enter the absolute path to a directory that the agent should have access to. This allows the agent to read,
          write, and execute files within this directory.
        </FormHint>
      </div>
    </Modal>
  )
}
