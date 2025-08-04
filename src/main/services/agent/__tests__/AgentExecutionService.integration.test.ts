/**
 * Integration test for AgentExecutionService
 * This test requires a real database and can be used for manual testing
 * 
 * To run manually:
 * 1. Ensure agent.py exists in resources/agents/
 * 2. Set up a test database with agent and session data
 * 3. Run: yarn vitest run src/main/services/agent/__tests__/AgentExecutionService.integration.test.ts
 */

import type { CreateAgentInput, CreateSessionInput } from '@types'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'

import { AgentExecutionService } from '../AgentExecutionService'
import { AgentService } from '../AgentService'

describe.skip('AgentExecutionService - Integration Tests', () => {
  let agentService: AgentService
  let executionService: AgentExecutionService
  let testAgentId: string
  let testSessionId: string

  beforeAll(async () => {
    agentService = AgentService.getInstance()
    executionService = AgentExecutionService.getInstance()

    // Create test agent
    const agentInput: CreateAgentInput = {
      name: 'Integration Test Agent',
      description: 'Agent for integration testing',
      instructions: 'You are a helpful assistant for testing purposes.',
      model: 'claude-3-5-sonnet-20241022',
      tools: [],
      knowledges: [],
      configuration: { temperature: 0.7 }
    }

    const agentResult = await agentService.createAgent(agentInput)
    expect(agentResult.success).toBe(true)
    testAgentId = agentResult.data!.id

    // Create test session
    const sessionInput: CreateSessionInput = {
      agent_ids: [testAgentId],
      user_goal: 'Test goal for integration',
      status: 'idle',
      accessible_paths: [process.cwd()],
      max_turns: 5,
      permission_mode: 'default'
    }

    const sessionResult = await agentService.createSession(sessionInput)
    expect(sessionResult.success).toBe(true)
    testSessionId = sessionResult.data!.id
  })

  afterAll(async () => {
    // Clean up test data
    if (testAgentId) {
      await agentService.deleteAgent(testAgentId)
    }
    if (testSessionId) {
      await agentService.deleteSession(testSessionId)
    }
    await agentService.close()
  })

  it('should run agent and handle basic interaction', async () => {
    const result = await executionService.runAgent(testSessionId, 'Hello, this is a test prompt')
    
    expect(result.success).toBe(true)
    
    // Check if process is running
    const processInfo = executionService.getRunningProcessInfo(testSessionId)
    expect(processInfo.isRunning).toBe(true)
    expect(processInfo.pid).toBeDefined()

    // Check if session is in running sessions list
    const runningSessions = executionService.getRunningSessions()
    expect(runningSessions).toContain(testSessionId)

    // Wait a moment for process to potentially start
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Stop the agent
    const stopResult = await executionService.stopAgent(testSessionId)
    expect(stopResult.success).toBe(true)

    // Wait for process to terminate
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check if process is no longer running
    const processInfoAfterStop = executionService.getRunningProcessInfo(testSessionId)
    expect(processInfoAfterStop.isRunning).toBe(false)
  }, 30000) // 30 second timeout for integration test

  it('should handle multiple concurrent sessions', async () => {
    // Create second session
    const sessionInput2: CreateSessionInput = {
      agent_ids: [testAgentId],
      user_goal: 'Second test session',
      status: 'idle',
      accessible_paths: [process.cwd()],
      max_turns: 3,
      permission_mode: 'default'
    }

    const session2Result = await agentService.createSession(sessionInput2)
    expect(session2Result.success).toBe(true)
    const testSessionId2 = session2Result.data!.id

    try {
      // Start both sessions
      const result1 = await executionService.runAgent(testSessionId, 'First session prompt')
      const result2 = await executionService.runAgent(testSessionId2, 'Second session prompt')

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)

      // Check both are running
      const runningSessions = executionService.getRunningSessions()
      expect(runningSessions).toContain(testSessionId)
      expect(runningSessions).toContain(testSessionId2)

      // Stop both
      await executionService.stopAgent(testSessionId)
      await executionService.stopAgent(testSessionId2)

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000))

    } finally {
      // Clean up second session
      await agentService.deleteSession(testSessionId2)
    }
  }, 45000) // 45 second timeout for concurrent test
})