import { preferenceService } from '@data/PreferenceService'
import { loggerService } from '@logger'
import type { PreferenceDefaultScopeType, PreferenceKeyType } from '@shared/data/types'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

const logger = loggerService.withContext('usePreference')

/**
 * React hook for managing a single preference value with automatic synchronization
 * Uses useSyncExternalStore for optimal React 18 integration and real-time updates
 *
 * @param key - The preference key to manage (must be a valid PreferenceKeyType)
 * @returns A tuple [value, setValue] where:
 *   - value: Current preference value or undefined if not loaded/cached
 *   - setValue: Async function to update the preference value
 *
 * @example
 * ```typescript
 * // Basic usage - managing theme preference
 * const [theme, setTheme] = usePreference('app.theme.mode')
 *
 * // Conditional rendering based on preference value
 * if (theme === undefined) {
 *   return <LoadingSpinner />
 * }
 *
 * // Updating preference value
 * const handleThemeChange = async (newTheme: string) => {
 *   try {
 *     await setTheme(newTheme)
 *   } catch (error) {
 *     console.error('Failed to update theme:', error)
 *   }
 * }
 *
 * return (
 *   <select value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
 *     <option value="ThemeMode.light">Light</option>
 *     <option value="ThemeMode.dark">Dark</option>
 *     <option value="ThemeMode.system">System</option>
 *   </select>
 * )
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage with form handling for message font size
 * const [fontSize, setFontSize] = usePreference('chat.message.font_size')
 *
 * const handleFontSizeChange = useCallback(async (size: number) => {
 *   if (size < 8 || size > 72) {
 *     throw new Error('Font size must be between 8 and 72')
 *   }
 *   await setFontSize(size)
 * }, [setFontSize])
 *
 * return (
 *   <input
 *     type="number"
 *     value={fontSize ?? 14}
 *     onChange={(e) => handleFontSizeChange(Number(e.target.value))}
 *     min={8}
 *     max={72}
 *   />
 * )
 * ```
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
 * React hook for managing multiple preference values with efficient batch operations
 * Automatically synchronizes all specified preferences and provides type-safe access
 *
 * @param keys - Object mapping local names to preference keys. Keys are your custom names,
 *               values must be valid PreferenceKeyType identifiers
 * @returns A tuple [values, updateValues] where:
 *   - values: Object with your local keys mapped to current preference values (undefined if not loaded)
 *   - updateValues: Async function to batch update multiple preferences at once
 *
 * @example
 * ```typescript
 * // Basic usage - managing related UI preferences
 * const [uiSettings, setUISettings] = useMultiplePreferences({
 *   theme: 'app.theme.mode',
 *   fontSize: 'chat.message.font_size',
 *   showLineNumbers: 'chat.code.show_line_numbers'
 * })
 *
 * // Accessing individual values with type safety
 * const currentTheme = uiSettings.theme // string | undefined
 * const currentFontSize = uiSettings.fontSize // number | undefined
 * const showLines = uiSettings.showLineNumbers // boolean | undefined
 *
 * // Batch updating multiple preferences
 * const resetToDefaults = async () => {
 *   await setUISettings({
 *     theme: 'ThemeMode.light',
 *     fontSize: 14,
 *     showLineNumbers: true
 *   })
 * }
 *
 * // Partial updates (only specified keys will be updated)
 * const toggleTheme = async () => {
 *   await setUISettings({
 *     theme: currentTheme === 'ThemeMode.light' ? 'ThemeMode.dark' : 'ThemeMode.light'
 *   })
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage - backup settings form with validation
 * const [settings, updateSettings] = useMultiplePreferences({
 *   autoSync: 'data.backup.local.auto_sync',
 *   backupDir: 'data.backup.local.dir',
 *   maxBackups: 'data.backup.local.max_backups',
 *   syncInterval: 'data.backup.local.sync_interval'
 * })
 *
 * // Form submission with error handling
 * const handleSubmit = async (formData: Partial<typeof settings>) => {
 *   try {
 *     // Validate before saving
 *     if (formData.maxBackups && formData.maxBackups < 0) {
 *       throw new Error('Max backups must be non-negative')
 *     }
 *
 *     await updateSettings(formData)
 *     showSuccessMessage('Backup settings saved successfully')
 *   } catch (error) {
 *     showErrorMessage(`Failed to save settings: ${error.message}`)
 *   }
 * }
 *
 * // Conditional rendering based on loading state
 * if (Object.values(settings).every(val => val === undefined)) {
 *   return <SettingsSkeletonLoader />
 * }
 *
 * return (
 *   <form onSubmit={(e) => {
 *     e.preventDefault()
 *     handleSubmit({
 *       maxBackups: parseInt(e.target.maxBackups.value),
 *       syncInterval: parseInt(e.target.syncInterval.value)
 *     })
 *   }}>
 *     <input
 *       name="maxBackups"
 *       type="number"
 *       defaultValue={settings.maxBackups ?? 10}
 *       min="0"
 *     />
 *     <input
 *       name="syncInterval"
 *       type="number"
 *       defaultValue={settings.syncInterval ?? 3600}
 *       min="60"
 *     />
 *     <button type="submit">Save Backup Settings</button>
 *   </form>
 * )
 * ```
 *
 * @example
 * ```typescript
 * // Performance optimization - grouping related chat code preferences
 * const [codePrefs] = useMultiplePreferences({
 *   showLineNumbers: 'chat.code.show_line_numbers',
 *   wrappable: 'chat.code.wrappable',
 *   collapsible: 'chat.code.collapsible',
 *   autocompletion: 'chat.code.editor.autocompletion',
 *   foldGutter: 'chat.code.editor.fold_gutter'
 * })
 *
 * // Single subscription handles all code preferences
 * // More efficient than 5 separate usePreference calls
 * const codeConfig = useMemo(() => ({
 *   showLineNumbers: codePrefs.showLineNumbers ?? false,
 *   wrappable: codePrefs.wrappable ?? false,
 *   collapsible: codePrefs.collapsible ?? false,
 *   autocompletion: codePrefs.autocompletion ?? true,
 *   foldGutter: codePrefs.foldGutter ?? false
 * }), [codePrefs])
 *
 * return <CodeBlock config={codeConfig} />
 * ```
 */
export function useMultiplePreferences<T extends Record<string, PreferenceKeyType>>(
  keys: T
): [
  { [P in keyof T]: PreferenceDefaultScopeType[T[P]] | undefined },
  (updates: Partial<{ [P in keyof T]: PreferenceDefaultScopeType[T[P]] }>) => Promise<void>
] {
  // Create stable key dependencies
  const keyList = useMemo(() => Object.values(keys), [keys])

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
      [keyList]
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
    }, [keys]),

    () => ({}) // No SSR snapshot
  )

  // Load initial values asynchronously if not cached
  useEffect(() => {
    const uncachedKeys = keyList.filter((key) => !preferenceService.isCached(key))

    if (uncachedKeys.length > 0) {
      preferenceService.getMultiple(uncachedKeys).catch((error) => {
        logger.error('Failed to load initial preferences:', error as Error)
      })
    }
  }, [keyList])

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
    [keys]
  )

  // Type-cast the values to the expected shape
  const typedValues = allValues as { [P in keyof T]: PreferenceDefaultScopeType[T[P]] | undefined }

  return [typedValues, updateValues]
}
