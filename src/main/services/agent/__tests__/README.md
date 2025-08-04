# Agent Service Tests

This directory contains comprehensive tests for the AgentService including:

## Test Files

### `AgentService.test.ts`
Comprehensive test suite covering:
- **Agent CRUD Operations**
  - Create agents with various configurations
  - Retrieve agents by ID
  - Update agent properties
  - List agents with pagination
  - Soft delete agents
  - Validation of required fields

- **Session CRUD Operations** 
  - Create sessions with agent associations
  - Update session status and properties
  - Claude session ID management
  - Get sessions with associated agent data
  - List sessions with filtering and pagination
  - Soft delete sessions

- **Session Log Operations**
  - Add various types of session logs (message, thought, action, observation)
  - Retrieve logs with pagination
  - Support for threaded logs (parent-child relationships)
  - Clear all logs for a session

- **Service Management**
  - Singleton pattern validation
  - Service reload functionality
  - Database connection management

### `AgentService.migration.test.ts`
Database migration and schema evolution tests:
- **Schema Creation**
  - Verify all tables and indexes are created correctly
  - Validate column types and constraints

- **Migration Logic**
  - Test migration from old schema (user_prompt → user_goal)
  - Test migration from old schema (claude_session_id → latest_claude_session_id)
  - Handle missing columns gracefully
  - Preserve existing data during migrations

- **Error Handling**
  - Handle corrupted database files
  - Graceful recovery from migration failures

### `AgentService.basic.test.ts`
Simplified test suite for basic functionality verification.

## Running Tests

```bash
# Run all agent service tests
yarn test:main src/main/services/agent/__tests__/

# Run specific test file
yarn test:main src/main/services/agent/__tests__/AgentService.basic.test.ts

# Run with coverage
yarn test:coverage --dir src/main/services/agent/
```

## Database Schema Validation

The tests verify that the database schema matches the TypeScript types exactly:

### Tables Created:
- `agents` - Store agent configurations
- `sessions` - Track agent execution sessions  
- `session_logs` - Log all session activities

### Key Features Tested:
- ✅ All TypeScript types match database schema
- ✅ Field naming consistency (user_goal, latest_claude_session_id)
- ✅ Proper JSON serialization/deserialization
- ✅ Soft delete functionality
- ✅ Database migrations and schema evolution
- ✅ Transaction support for data consistency
- ✅ Index creation for performance
- ✅ Foreign key relationships

## Test Environment

Tests use:
- **Vitest** as test runner
- **Temporary SQLite databases** for isolation
- **Mocked Electron app** for path resolution
- **Automatic cleanup** of test databases

Each test gets a unique temporary database to ensure complete isolation and prevent test interference.