import { CodeOutlined, FileTextOutlined, GlobalOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons'
import { SessionLogEntity } from '@renderer/types/agent'
import React from 'react'

// Simple hash function to convert string to number for consistency with existing ID usage
declare global {
  interface String {
    hashCode(): number
  }
}

String.prototype.hashCode = function () {
  let hash = 0
  if (this.length === 0) return hash
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Simple markdown-like formatter
export const formatMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n/g, '<br/>')
}

// Helper function to format message content for display
export const formatMessageContent = (log: SessionLogEntity): string => {
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

// Helper function to format tool call content
export const formatToolCall = (log: SessionLogEntity): { toolName: string; toolInput: any; toolId: string } => {
  const content = log.content as any
  return {
    toolName: content.tool_name || 'Unknown Tool',
    toolInput: content.tool_input || {},
    toolId: content.tool_id || ''
  }
}

// Helper function to format tool result content
export const formatToolResult = (log: SessionLogEntity): { content: string; isError: boolean; toolUseId?: string } => {
  const content = log.content as any
  return {
    content: content.content || 'No result',
    isError: content.is_error || false,
    toolUseId: content.tool_use_id
  }
}

// Helper function to get tool icon
export const getToolIcon = (toolName: string): React.ReactNode => {
  switch (toolName) {
    case 'WebSearch':
      return <SearchOutlined />
    case 'WebFetch':
      return <GlobalOutlined />
    case 'Write':
    case 'Edit':
      return <FileTextOutlined />
    case 'Read':
      return <FileTextOutlined />
    case 'Bash':
      return <CodeOutlined />
    case 'Grep':
    case 'Glob':
      return <SearchOutlined />
    default:
      return <ToolOutlined />
  }
}

// Get system message title
export const getSystemMessageTitle = (log: SessionLogEntity): string => {
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
export const getSystemMessageStatus = (log: SessionLogEntity): 'info' | 'success' | 'warning' | 'error' => {
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
