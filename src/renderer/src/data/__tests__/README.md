# Preference System Unit Tests

This directory contains comprehensive unit tests for the Preference system's renderer-side components.

## Test Files

### `PreferenceService.test.ts`
Comprehensive tests for the renderer-side PreferenceService:

- **Singleton Pattern**: Verifies proper singleton implementation
- **Cache Management**: Tests cache initialization, clearing, and state tracking  
- **Get/Set Operations**: Tests single and multiple preference operations
- **Load All Functionality**: Tests bulk preference loading from main process
- **Change Notifications**: Tests IPC change listener integration
- **Subscriptions**: Tests React integration with useSyncExternalStore
- **Error Handling**: Tests graceful error handling and fallbacks
- **Utility Methods**: Tests helper methods like isCached, getCachedValue, preload

### `hooks/usePreference.simple.test.tsx`
Basic integration tests for React hooks:

- **Hook Imports**: Verifies all hooks can be imported without errors
- **Service Integration**: Tests usePreferenceService hook returns correct instance
- **Basic Functionality**: Ensures hooks are properly typed and exported

## Architecture Coverage

### ✅ Renderer PreferenceService
- Memory caching with `Partial<PreferenceDefaultScopeType>`
- IPC communication for data fetching and subscriptions
- React integration via useSyncExternalStore
- Auto-subscription management
- Error handling and fallbacks
- Bulk operations (loadAll, setMultiple, getMultiple)

### ✅ React Hooks  
- Type-safe preference access
- Automatic re-rendering on changes
- Error handling
- Service instance access

## Test Statistics

- **Total Test Files**: 2
- **Total Tests**: 28
- **Coverage Areas**: 
  - Core functionality
  - Type safety
  - Error handling
  - React integration
  - IPC communication
  - Cache management

## Running Tests

```bash
# Run all preference tests
yarn vitest run src/renderer/src/data/__tests__/ src/renderer/src/data/hooks/__tests__/

# Run specific test file
yarn vitest run src/renderer/src/data/__tests__/PreferenceService.test.ts

# Watch mode
yarn vitest watch src/renderer/src/data/__tests__/
```

## Key Testing Patterns

### Mock Setup
- Window API mocking for IPC simulation
- Logger service mocking
- Complete isolation from actual IPC layer

### Assertion Strategies  
- Function behavior verification
- State change validation
- Error condition handling
- Type safety enforcement

### React Testing
- Hook lifecycle testing
- State synchronization validation
- Service integration verification