import { cacheService } from '@data/CacheService'
import { loggerService } from '@logger'
import type {
  RendererPersistCacheKey,
  RendererPersistCacheSchema,
  UseCacheKey,
  UseCacheSchema,
  UseSharedCacheKey,
  UseSharedCacheSchema
} from '@shared/data/cache/cacheSchemas'
import { DefaultUseCache, DefaultUseSharedCache } from '@shared/data/cache/cacheSchemas'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
const logger = loggerService.withContext('useCache')

/**
 * React hook for cross-component memory cache
 *
 * Features:
 * - Synchronous API with useSyncExternalStore
 * - Automatic default value setting
 * - Hook lifecycle management
 * - TTL support with warning when used
 *
 * @param key - Cache key
 * @param initValue - Default value (set automatically if not exists)
 * @returns [value, setValue]
 */
export function useCache<K extends UseCacheKey>(
  key: K,
  initValue?: UseCacheSchema[K]
): [UseCacheSchema[K], (value: UseCacheSchema[K]) => void] {
  // Subscribe to cache changes
  const value = useSyncExternalStore(
    useCallback((callback) => cacheService.subscribe(key, callback), [key]),
    useCallback(() => cacheService.get<UseCacheSchema[K]>(key), [key]),
    useCallback(() => cacheService.get<UseCacheSchema[K]>(key), [key]) // SSR snapshot
  )

  // Set default value if not exists
  useEffect(() => {
    if (cacheService.has(key)) {
      return
    }

    if (initValue === undefined) {
      cacheService.set(key, DefaultUseCache[key])
    } else {
      cacheService.set(key, initValue)
    }
  }, [key, initValue])

  // Register hook lifecycle
  useEffect(() => {
    cacheService.registerHook(key)
    return () => cacheService.unregisterHook(key)
  }, [key])

  // Check for TTL warning
  useEffect(() => {
    if (cacheService.hasTTL(key)) {
      logger.warn(
        `useCache hook for key "${key}" is using a cache with TTL. This may cause unstable behavior as the value can expire between renders.`
      )
    }
  }, [key])

  const setValue = useCallback(
    (newValue: UseCacheSchema[K]) => {
      cacheService.set(key, newValue)
    },
    [key]
  )

  return [value ?? initValue ?? DefaultUseCache[key], setValue]
}

/**
 * React hook for cross-window shared cache
 *
 * Features:
 * - Synchronous API (uses local copy)
 * - Cross-window synchronization via IPC
 * - Automatic default value setting
 * - Hook lifecycle management
 *
 * @param key - Cache key
 * @param initValue - Default value (set automatically if not exists)
 * @returns [value, setValue]
 */
export function useSharedCache<K extends UseSharedCacheKey>(
  key: K,
  initValue?: UseSharedCacheSchema[K]
): [UseSharedCacheSchema[K], (value: UseSharedCacheSchema[K]) => void] {
  // Subscribe to cache changes
  const value = useSyncExternalStore(
    useCallback((callback) => cacheService.subscribe(key, callback), [key]),
    useCallback(() => cacheService.getShared<UseSharedCacheSchema[K]>(key), [key]),
    useCallback(() => cacheService.getShared<UseSharedCacheSchema[K]>(key), [key]) // SSR snapshot
  )

  // Set default value if not exists
  useEffect(() => {
    if (cacheService.hasShared(key)) {
      return
    }

    if (initValue === undefined) {
      cacheService.setShared(key, DefaultUseSharedCache[key])
    } else {
      cacheService.setShared(key, initValue)
    }
  }, [key, initValue])

  // Register hook lifecycle
  useEffect(() => {
    cacheService.registerHook(key)
    return () => cacheService.unregisterHook(key)
  }, [key])

  // Check for TTL warning
  useEffect(() => {
    if (cacheService.hasSharedTTL(key)) {
      logger.warn(
        `useSharedCache hook for key "${key}" is using a cache with TTL. This may cause unstable behavior as the value can expire between renders.`
      )
    }
  }, [key])

  const setValue = useCallback(
    (newValue: UseSharedCacheSchema[K]) => {
      cacheService.setShared(key, newValue)
    },
    [key]
  )

  return [value ?? initValue ?? DefaultUseSharedCache[key], setValue]
}

/**
 * React hook for persistent cache with localStorage
 *
 * Features:
 * - Type-safe with predefined schema
 * - Cross-window synchronization
 * - Automatic default value setting
 * - No TTL support (as discussed)
 *
 * @param key - Predefined persist cache key
 * @returns [value, setValue]
 */
export function usePersistCache<K extends RendererPersistCacheKey>(
  key: K
): [RendererPersistCacheSchema[K], (value: RendererPersistCacheSchema[K]) => void] {
  // Subscribe to cache changes
  const value = useSyncExternalStore(
    useCallback((callback) => cacheService.subscribe(key, callback), [key]),
    useCallback(() => cacheService.getPersist(key), [key]),
    useCallback(() => cacheService.getPersist(key), [key]) // SSR snapshot
  )

  // Register hook lifecycle (using string key for tracking)
  useEffect(() => {
    cacheService.registerHook(key)
    return () => cacheService.unregisterHook(key)
  }, [key])

  const setValue = useCallback(
    (newValue: RendererPersistCacheSchema[K]) => {
      cacheService.setPersist(key, newValue)
    },
    [key]
  )

  return [value, setValue]
}
