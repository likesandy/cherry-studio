import { Provider } from '@renderer/types'
import { describe, expect, it } from 'vitest'

import { cleanupProviders, ConflictResolution } from '../provider'

// Mock system providers for testing
const mockSystemProvider1: Provider = {
  id: 'openai',
  name: 'OpenAI',
  type: 'openai',
  apiKey: '',
  apiHost: 'https://api.openai.com',
  models: [],
  isSystem: true,
  enabled: false
}

const mockSystemProvider2: Provider = {
  id: 'anthropic',
  name: 'Anthropic',
  type: 'anthropic',
  apiKey: '',
  apiHost: 'https://api.anthropic.com',
  models: [],
  isSystem: true,
  enabled: false
}

const mockCustomProvider: Provider = {
  id: 'custom-1',
  name: 'Custom Provider',
  type: 'openai',
  apiKey: 'custom-key',
  apiHost: 'https://api.custom.com',
  models: [],
  isSystem: false,
  enabled: true
}

describe('cleanupProviders', () => {
  it('should return original providers when no duplicates or missing providers', () => {
    const providers = [mockSystemProvider1, mockSystemProvider2]

    const result = cleanupProviders(providers)

    expect(result.cleanedProviders).toHaveLength(2)
    expect(result.cleanedProviders).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'openai' }), expect.objectContaining({ id: 'anthropic' })])
    )
    expect(result.hasChanges).toBe(false)
    expect(result.conflicts).toHaveLength(0)
  })

  it('should show duplicates as conflicts', () => {
    const duplicate = { ...mockSystemProvider1, apiKey: 'test-key' }
    const providers = [mockSystemProvider1, duplicate]

    const result = cleanupProviders(providers)

    // Should have conflict for duplicates
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].id).toBe('openai')
    expect(result.conflicts[0].providers).toHaveLength(2)

    // Missing provider should be added
    expect(result.cleanedProviders).toHaveLength(1) // anthropic (missing)
    const anthropicProvider = result.cleanedProviders.find((p) => p.id === 'anthropic')
    expect(anthropicProvider?.apiKey).toBe('')
    expect(result.hasChanges).toBe(true)
  })

  it('should add missing system providers', () => {
    const providers = [mockSystemProvider1]

    const result = cleanupProviders(providers)

    expect(result.cleanedProviders).toHaveLength(2)
    expect(result.cleanedProviders.find((p) => p.id === 'anthropic')).toBeDefined()
    expect(result.hasChanges).toBe(true)
  })

  it('should preserve custom providers', () => {
    const providers = [mockSystemProvider1, mockCustomProvider]

    const result = cleanupProviders(providers)

    expect(result.cleanedProviders).toHaveLength(3) // openai + custom + anthropic (added)
    expect(result.cleanedProviders.find((p) => p.id === 'custom-1')).toEqual(mockCustomProvider)
    expect(result.hasChanges).toBe(true)
  })

  it('should handle non-system provider duplicates', () => {
    const customDuplicate = { ...mockCustomProvider, name: 'Custom Provider Duplicate' }
    const providers = [mockSystemProvider1, mockCustomProvider, customDuplicate]

    const result = cleanupProviders(providers)

    // Non-system duplicates should keep first occurrence
    expect(result.cleanedProviders).toHaveLength(3) // openai + custom (first) + anthropic (added)
    const customProvider = result.cleanedProviders.find((p) => p.id === 'custom-1')
    expect(customProvider?.name).toBe('Custom Provider')
    expect(result.hasChanges).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })

  it('should return hasChanges false when no changes needed', () => {
    const providers = [mockSystemProvider1, mockSystemProvider2]

    const result = cleanupProviders(providers)

    expect(result.hasChanges).toBe(false)
  })

  it('should show all types of duplicates as conflicts', () => {
    const duplicate1 = { ...mockSystemProvider1, apiKey: 'key1' }
    const duplicate2 = { ...mockSystemProvider1, apiKey: 'key2' }
    const providers = [duplicate1, duplicate2]

    const result = cleanupProviders(providers)

    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].id).toBe('openai')
    expect(result.conflicts[0].providers).toHaveLength(2)
    expect(result.hasChanges).toBe(true)

    // Conflicted providers are replaced by default system providers, plus missing providers are added
    expect(result.cleanedProviders).toHaveLength(1) // anthropic (missing)
    const anthropicProvider = result.cleanedProviders.find((p) => p.id === 'anthropic')
    expect(anthropicProvider?.apiKey).toBe('') // Should be default system provider
  })

  it('should resolve conflict when user provides resolution', () => {
    const duplicate1 = { ...mockSystemProvider1, apiKey: 'key1' }
    const duplicate2 = { ...mockSystemProvider1, apiKey: 'key2' }
    const providers = [duplicate1, duplicate2]

    const resolutions: ConflictResolution[] = [
      {
        conflictId: 'openai',
        selectedProviderId: '1' // Select second provider (index 1)
      }
    ]

    const result = cleanupProviders(providers, resolutions)

    expect(result.conflicts).toHaveLength(0)
    expect(result.cleanedProviders).toHaveLength(2) // selected openai + anthropic (missing)
    const openaiProvider = result.cleanedProviders.find((p) => p.id === 'openai')
    expect(openaiProvider?.apiKey).toBe('key2') // Should be the selected one
  })

  it('should handle no conflicts scenario', () => {
    const providers = [mockSystemProvider1]

    const result = cleanupProviders(providers)

    expect(result.conflicts).toHaveLength(0)
    expect(result.cleanedProviders).toHaveLength(2) // openai + anthropic (missing)
    expect(result.hasChanges).toBe(true)
  })

  it('should return empty conflicts array for single providers', () => {
    const providers = [mockSystemProvider1, mockSystemProvider2]

    const result = cleanupProviders(providers)

    expect(result.conflicts).toHaveLength(0)
  })
})
