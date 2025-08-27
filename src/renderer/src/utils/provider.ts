import { SYSTEM_PROVIDERS_CONFIG } from '@renderer/config/providers'
import { isSystemProvider, Provider, SystemProviderId, SystemProviderIds } from '@renderer/types'

export type ConflictInfo = {
  id: string
  providers: (Provider & { _tempIndex?: number })[]
}

export type ConflictResolution = {
  conflictId: string
  selectedProviderId: string // 临时ID，用于标识用户选择的provider
}

/**
 * Clean up provider data by removing duplicates and adding missing system providers
 *
 * For duplicate system providers, all duplicates are presented to the user for manual selection.
 * No automatic priority rules are applied - the user chooses which provider to keep.
 *
 * @param providers - Array of providers to clean up
 * @param conflictResolutions - Optional user resolutions for conflicts
 * @returns Object containing cleaned providers, whether changes were made, and conflicts that need user attention
 */
export function cleanupProviders(
  providers: Provider[],
  conflictResolutions: ConflictResolution[] = []
): {
  cleanedProviders: Provider[]
  hasChanges: boolean
  conflicts: ConflictInfo[]
} {
  const systemProviderIds = Object.keys(SystemProviderIds) as SystemProviderId[]
  const cleanedProviders: Provider[] = []
  const conflicts: ConflictInfo[] = []
  let hasChanges = false

  // Group providers by ID to detect duplicates
  const providerGroups = new Map<string, Provider[]>()
  providers.forEach((p, index) => {
    if (!providerGroups.has(p.id)) {
      providerGroups.set(p.id, [])
    }
    // Add a temporary index to help identify providers during conflict resolution
    const providerWithIndex = { ...p, _tempIndex: index }
    providerGroups.get(p.id)!.push(providerWithIndex as Provider & { _tempIndex: number })
  })

  // Process each group
  providerGroups.forEach((group, id) => {
    if (group.length === 1) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _tempIndex: _, ...cleanProvider } = group[0] as Provider & { _tempIndex: number }
      cleanedProviders.push(cleanProvider)
      return
    }

    hasChanges = true

    // Handle duplicates
    if (!isSystemProvider(group[0])) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _tempIndex: _, ...cleanProvider } = group[0] as Provider & { _tempIndex: number }
      cleanedProviders.push(cleanProvider)
      return
    }

    const userResolution = conflictResolutions.find((r) => r.conflictId === id)

    if (userResolution) {
      const selectedProvider = group.find((p) => (p as any)._tempIndex.toString() === userResolution.selectedProviderId)
      if (selectedProvider) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _tempIndex: _, ...cleanProvider } = selectedProvider as Provider & { _tempIndex: number }
        cleanedProviders.push(cleanProvider)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _tempIndex: _, ...cleanProvider } = group[0] as Provider & { _tempIndex: number }
        cleanedProviders.push(cleanProvider)
      }
    } else {
      const conflictProviders = group.map((p) => p as Provider & { _tempIndex: number })
      conflicts.push({
        id,
        providers: conflictProviders
      })
      return
    }
  })

  // Add missing system providers
  const existingProviderIds = cleanedProviders.map((p) => p.id)
  const missingSystemProviderIds = systemProviderIds.filter((id) => !existingProviderIds.includes(id))

  missingSystemProviderIds.forEach((id: SystemProviderId) => {
    const systemProvider = SYSTEM_PROVIDERS_CONFIG[id]
    cleanedProviders.push({ ...systemProvider } as Provider)
    hasChanges = true
  })

  return {
    cleanedProviders,
    hasChanges,
    conflicts
  }
}
