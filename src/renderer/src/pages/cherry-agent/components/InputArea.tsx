import { Input } from 'antd'
import React from 'react'

import { InputAreaComponent, MessageInput, SendButton } from '../styles'

interface InputAreaProps {
  inputMessage: string
  setInputMessage: (message: string) => void
  isRunning: boolean
  onSendMessage: () => void
}

export const InputArea: React.FC<InputAreaProps> = ({ inputMessage, setInputMessage, isRunning, onSendMessage }) => {
  return (
    <InputAreaComponent>
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
            onSendMessage()
          }}
        />
        <SendButton
          type="primary"
          onClick={onSendMessage}
          disabled={!inputMessage.trim() || isRunning}
          loading={isRunning}>
          Send
        </SendButton>
      </MessageInput>
    </InputAreaComponent>
  )
}
