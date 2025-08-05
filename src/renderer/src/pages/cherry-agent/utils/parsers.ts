// Utility functions to parse tool information from raw stdout
export const parseToolCallsFromRawOutput = (
  rawOutput: string
): Array<{
  toolId: string
  toolName: string
  toolInput: any
  rawText: string
}> => {
  const toolCalls: Array<{
    toolId: string
    toolName: string
    toolInput: any
    rawText: string
  }> = []

  const lines = rawOutput.split('\n')

  for (const line of lines) {
    // Parse tool calls: "Tool: ToolUseBlock(id='...', name='...', input={...})"
    // Use a more flexible regex to capture the input object with balanced braces
    const toolCallMatch = line.match(/Tool: ToolUseBlock\(id='([^']+)', name='([^']+)', input=(\{.*\})\)/)
    if (toolCallMatch) {
      const [, toolId, toolName, inputStr] = toolCallMatch
      try {
        // More robust JSON parsing - handle Python dict format with single quotes
        const jsonStr = inputStr
          .replace(/'/g, '"')
          .replace(/False/g, 'false')
          .replace(/True/g, 'true')
          .replace(/None/g, 'null')
        const input = JSON.parse(jsonStr)
        toolCalls.push({
          toolId,
          toolName,
          toolInput: input,
          rawText: line
        })
      } catch (error) {
        // If JSON parsing fails, try to extract basic key-value pairs
        try {
          // Simple fallback parsing for basic cases
          const simpleMatch = inputStr.match(/\{([^}]+)\}/)
          if (simpleMatch) {
            const keyValuePairs = simpleMatch[1].split(',').map((pair) => {
              const [key, value] = pair.split(':').map((s) => s.trim())
              return [key.replace(/['"]/g, ''), value.replace(/['"]/g, '')]
            })
            const input = Object.fromEntries(keyValuePairs)
            toolCalls.push({
              toolId,
              toolName,
              toolInput: input,
              rawText: line
            })
          } else {
            // Final fallback - show raw input
            toolCalls.push({
              toolId,
              toolName,
              toolInput: { raw: inputStr },
              rawText: line
            })
          }
        } catch {
          // Final fallback - show raw input
          toolCalls.push({
            toolId,
            toolName,
            toolInput: { raw: inputStr },
            rawText: line
          })
        }
      }
    }
  }

  return toolCalls
}

export const parseToolResultsFromRawOutput = (
  rawOutput: string
): Array<{
  toolUseId?: string
  content: string
  isError: boolean
  rawText: string
}> => {
  const toolResults: Array<{
    toolUseId?: string
    content: string
    isError: boolean
    rawText: string
  }> = []

  const lines = rawOutput.split('\n')

  for (const line of lines) {
    // Parse structured tool results: "Tool Result: ToolResultBlock(...)"
    const toolResultMatch = line.match(
      /Tool Result: ToolResultBlock\(tool_use_id='([^']+)', content='([^']*)', is_error=(true|false)\)/
    )
    if (toolResultMatch) {
      const [, toolUseId, content, isError] = toolResultMatch
      toolResults.push({
        toolUseId,
        content,
        isError: isError === 'true',
        rawText: line
      })
      continue
    }

    // Parse simple tool results: "Tool Result: ..."
    const simpleToolResultMatch = line.match(/Tool Result: (.+)/)
    if (simpleToolResultMatch) {
      const [, content] = simpleToolResultMatch
      toolResults.push({
        content: content.trim(),
        isError: false,
        rawText: line
      })
    }
  }

  return toolResults
}
