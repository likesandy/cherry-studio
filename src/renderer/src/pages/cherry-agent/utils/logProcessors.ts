import { SessionLogEntity } from '@renderer/types/agent'

import { parseToolCallsFromRawOutput, parseToolResultsFromRawOutput } from './parsers'
import { shouldDisplayLog } from './validators'

// Type for parsed tool information
export type ParsedToolLog = {
  type: 'parsed_tool_call' | 'parsed_tool_result'
  id: string
  created_at: string
  toolInfo: any
}

export type ProcessedLog = SessionLogEntity | ParsedToolLog

// Process raw logs to extract tool information and create virtual log entries
export const processLogsWithToolInfo = (logs: SessionLogEntity[]): ProcessedLog[] => {
  const processedLogs: ProcessedLog[] = []

  let toolCallCounter = 0
  let toolResultCounter = 0

  for (const log of logs) {
    // Add the original log if it should be displayed
    if (shouldDisplayLog(log)) {
      processedLogs.push(log)
    }

    // Process raw stdout logs for tool information
    if (log.type === 'raw_stdout' && log.content && typeof log.content === 'object' && 'data' in log.content) {
      const rawOutput = (log.content as any).data

      // Extract tool calls
      const toolCalls = parseToolCallsFromRawOutput(rawOutput)
      for (const toolCall of toolCalls) {
        processedLogs.push({
          type: 'parsed_tool_call',
          id: `tool_call_${log.id}_${toolCallCounter++}`,
          created_at: log.created_at,
          toolInfo: toolCall
        })
      }

      // Extract tool results
      const toolResults = parseToolResultsFromRawOutput(rawOutput)
      for (const toolResult of toolResults) {
        processedLogs.push({
          type: 'parsed_tool_result',
          id: `tool_result_${log.id}_${toolResultCounter++}`,
          created_at: log.created_at,
          toolInfo: toolResult
        })
      }
    }
  }

  return processedLogs
}
