import { SessionLogEntity } from '@renderer/types/agent'

import { formatMessageContent } from './formatters'

// Helper function to check if a log should be displayed
export const shouldDisplayLog = (log: SessionLogEntity): boolean => {
  // Show tool calls and results (these are now parsed from raw logs)
  if (log.type === 'tool_call' || log.type === 'tool_result') {
    return true
  }

  // Hide raw stdout/stderr logs (we'll process them for tool info)
  if (log.type === 'raw_stdout' || log.type === 'raw_stderr') {
    return false
  }

  // Hide routine system messages - only show errors and warnings
  if (log.role === 'system') {
    // Only show system messages that are errors or have important information
    if (log.type === 'agent_error') {
      return true // Always show errors
    }
    if (log.type === 'agent_session_result') {
      // Only show failed session results, hide successful ones
      const content = log.content as any
      return content && !content.success
    }
    // Hide all other system messages (session_init, session_started, etc.)
    return false
  }

  // Hide empty content
  const content = formatMessageContent(log)
  if (!content || content.trim() === '') {
    return false
  }

  return true
}
