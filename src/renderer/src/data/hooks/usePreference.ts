import { loggerService } from '@logger'
import type { PreferenceDefaultScopeType, PreferenceKeyType } from '@shared/data/types'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

import { preferenceService } from '../PreferenceService'

const logger = loggerService.withContext('usePreference')

/**
 * React hook for managing a single preference value
 * Uses useSyncExternalStore for optimal React 18 integration
 *
 * @param key - The preference key to manage
 * @returns [value, setValue] - Current value and setter function
 */
export function usePreference<K extends PreferenceKeyType>(
  key: K
): [PreferenceDefaultScopeType[K] | undefined, (value: PreferenceDefaultScopeType[K]) => Promise<void>] {
  // Subscribe to changes for this specific preference
  const value = useSyncExternalStore(
    useCallback((callback) => preferenceService.subscribeToKey(key)(callback), [key]),
    useCallback(() => preferenceService.getCachedValue(key), [key]),
    () => undefined // SSR snapshot (not used in Electron context)
  )

  // Load initial value asynchronously if not cached
  useEffect(() => {
    if (value === undefined && !preferenceService.isCached(key)) {
      preferenceService.get(key).catch((error) => {
        logger.error(`Failed to load initial preference ${key}:`, error as Error)
      })
    }
  }, [key, value])

  // Memoized setter function
  const setValue = useCallback(
    async (newValue: PreferenceDefaultScopeType[K]) => {
      try {
        await preferenceService.set(key, newValue)
      } catch (error) {
        logger.error(`Failed to set preference ${key}:`, error as Error)
        throw error
      }
    },
    [key]
  )

  return [value, setValue]
}

/**
 * React hook for managing multiple preference values
 * Efficiently batches operations and provides type-safe interface
 *
 * @param keys - Object mapping local names to preference keys
 * @returns [values, updateValues] - Current values and batch update function
 */
export function usePreferences<T extends Record<string, PreferenceKeyType>>(
  keys: T
): [
  { [P in keyof T]: PreferenceDefaultScopeType[T[P]] | undefined },
  (updates: Partial<{ [P in keyof T]: PreferenceDefaultScopeType[T[P]] }>) => Promise<void>
] {
  // Create stable key dependencies
  const keyList = useMemo(() => Object.values(keys), [keys])
  const keysStringified = useMemo(() => JSON.stringify(keys), [keys])

  // Cache the last snapshot to avoid infinite loops
  const lastSnapshotRef = useRef<Record<string, any>>({})

  const allValues = useSyncExternalStore(
    useCallback(
      (callback: () => void) => {
        // Subscribe to all keys and aggregate the unsubscribe functions
        const unsubscribeFunctions = keyList.map((key) => preferenceService.subscribeToKey(key)(callback))

        return () => {
          unsubscribeFunctions.forEach((unsubscribe) => unsubscribe())
        }
      },
      [keysStringified]
    ),

    useCallback(() => {
      // Check if any values have actually changed
      let hasChanged = Object.keys(lastSnapshotRef.current).length === 0 // First time
      const newSnapshot: Record<string, any> = {}

      for (const [localKey, prefKey] of Object.entries(keys)) {
        const currentValue = preferenceService.getCachedValue(prefKey)
        newSnapshot[localKey] = currentValue

        if (!hasChanged && lastSnapshotRef.current[localKey] !== currentValue) {
          hasChanged = true
        }
      }

      // Only create new object if data actually changed
      if (hasChanged) {
        lastSnapshotRef.current = newSnapshot
      }

      return lastSnapshotRef.current
    }, [keysStringified]),

    () => ({}) // SSR snapshot
  )

  // Load initial values asynchronously if not cached
  useEffect(() => {
    const uncachedKeys = keyList.filter((key) => !preferenceService.isCached(key))

    if (uncachedKeys.length > 0) {
      preferenceService.getMultiple(uncachedKeys).catch((error) => {
        logger.error('Failed to load initial preferences:', error as Error)
      })
    }
  }, [keysStringified])

  // Memoized batch update function
  const updateValues = useCallback(
    async (updates: Partial<{ [P in keyof T]: PreferenceDefaultScopeType[T[P]] }>) => {
      try {
        // Convert local keys back to preference keys
        const prefUpdates: Record<string, any> = {}
        for (const [localKey, value] of Object.entries(updates)) {
          const prefKey = keys[localKey as keyof T]
          if (prefKey) {
            prefUpdates[prefKey] = value
          }
        }

        await preferenceService.setMultiple(prefUpdates)
      } catch (error) {
        logger.error('Failed to update preferences:', error as Error)
        throw error
      }
    },
    [keysStringified]
  )

  // Type-cast the values to the expected shape
  const typedValues = allValues as { [P in keyof T]: PreferenceDefaultScopeType[T[P]] | undefined }

  return [typedValues, updateValues]
}

/**
 * Hook for preloading preferences to improve performance
 * Useful for components that will use many preferences
 *
 * @param keys - Array of preference keys to preload
 */
export function usePreferencePreload(keys: PreferenceKeyType[]): void {
  const keysString = useMemo(() => keys.join(','), [keys])
  useEffect(() => {
    preferenceService.preload(keys).catch((error) => {
      logger.error('Failed to preload preferences:', error as Error)
    })
  }, [keysString])
}

/**
 * Hook for getting the preference service instance
 * Useful for non-reactive operations or advanced usage
 */
export function usePreferenceService() {
  return preferenceService
}
