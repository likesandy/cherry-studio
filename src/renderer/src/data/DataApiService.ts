import { loggerService } from '@logger'
import type { ApiClient, ConcreteApiPaths } from '@shared/data/api/apiSchemas'
import type {
  BatchRequest,
  BatchResponse,
  DataRequest,
  DataResponse,
  HttpMethod,
  SubscriptionCallback,
  SubscriptionEvent,
  SubscriptionOptions,
  TransactionRequest
} from '@shared/data/api/apiTypes'
import { toDataApiError } from '@shared/data/api/errorCodes'

const logger = loggerService.withContext('DataApiService')

/**
 * Retry options interface
 */
interface RetryOptions {
  maxRetries: number
  retryDelay: number
  backoffMultiplier: number
  retryCondition: (error: Error) => boolean
}

/**
 * Strongly-typed HTTP client for Data API
 * Simplified version using SWR for caching and request management
 * Focuses on IPC communication between renderer and main process
 */
export class DataApiService implements ApiClient {
  private static instance: DataApiService
  private requestId = 0
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: DataResponse) => void
      reject: (error: Error) => void
      timeout?: NodeJS.Timeout
      abortController?: AbortController
    }
  >()

  // Subscriptions
  private subscriptions = new Map<
    string,
    {
      callback: SubscriptionCallback
      options: SubscriptionOptions
    }
  >()

  // Default retry options
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 2,
    retryDelay: 1000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      // Retry on network errors or temporary failures
      const message = error.message.toLowerCase()
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('unavailable') ||
        message.includes('500') ||
        message.includes('503')
      )
    }
  }

  private constructor() {
    this.setupResponseHandler()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DataApiService {
    if (!DataApiService.instance) {
      DataApiService.instance = new DataApiService()
    }
    return DataApiService.instance
  }

  /**
   * Setup IPC response handler
   */
  private setupResponseHandler() {
    if (!window.api.dataApi?.onResponse) {
      logger.error('Data API not available in preload context')
      return
    }

    window.api.dataApi.onResponse((response: DataResponse) => {
      const pending = this.pendingRequests.get(response.id)
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(response.id)

        if (response.error) {
          pending.reject(new Error(response.error.message))
        } else {
          pending.resolve(response)
        }
      }
    })
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestId}`
  }

  /**
   * Cancel request by ID
   */
  cancelRequest(requestId: string): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      pending.abortController?.abort()
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(requestId)
      pending.reject(new Error('Request cancelled'))
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    const requestIds = Array.from(this.pendingRequests.keys())
    requestIds.forEach((id) => this.cancelRequest(id))
  }

  /**
   * Configure retry options
   * @param options Partial retry options to override defaults
   */
  configureRetry(options: Partial<RetryOptions>): void {
    this.defaultRetryOptions = {
      ...this.defaultRetryOptions,
      ...options
    }

    logger.debug('Retry options updated', this.defaultRetryOptions)
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryOptions {
    return { ...this.defaultRetryOptions }
  }

  /**
   * Send request via IPC with AbortController support and retry logic
   */
  private async sendRequest<T>(request: DataRequest, retryCount = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!window.api.dataApi.request) {
        reject(new Error('Data API not available'))
        return
      }

      // Create abort controller for cancellation
      const abortController = new AbortController()

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id)
        const timeoutError = new Error(`Request timeout: ${request.path}`)

        // Check if should retry
        if (retryCount < this.defaultRetryOptions.maxRetries && this.defaultRetryOptions.retryCondition(timeoutError)) {
          logger.debug(
            `Request timeout, retrying attempt ${retryCount + 1}/${this.defaultRetryOptions.maxRetries}: ${request.path}`
          )

          // Calculate delay with exponential backoff
          const delay =
            this.defaultRetryOptions.retryDelay * Math.pow(this.defaultRetryOptions.backoffMultiplier, retryCount)

          setTimeout(() => {
            // Create new request with new ID for retry
            const retryRequest = { ...request, id: this.generateRequestId() }
            this.sendRequest<T>(retryRequest, retryCount + 1)
              .then(resolve)
              .catch(reject)
          }, delay)
        } else {
          reject(timeoutError)
        }
      }, 30000) // 30 second timeout

      // Store pending request with abort controller
      this.pendingRequests.set(request.id, {
        resolve: (response: DataResponse) => resolve(response.data),
        reject: (error: Error) => {
          // Check if should retry on error
          if (retryCount < this.defaultRetryOptions.maxRetries && this.defaultRetryOptions.retryCondition(error)) {
            logger.debug(
              `Request failed, retrying attempt ${retryCount + 1}/${this.defaultRetryOptions.maxRetries}: ${request.path}`,
              error
            )

            const delay =
              this.defaultRetryOptions.retryDelay * Math.pow(this.defaultRetryOptions.backoffMultiplier, retryCount)

            setTimeout(() => {
              const retryRequest = { ...request, id: this.generateRequestId() }
              this.sendRequest<T>(retryRequest, retryCount + 1)
                .then(resolve)
                .catch(reject)
            }, delay)
          } else {
            reject(error)
          }
        },
        timeout,
        abortController
      })

      // Handle abort signal
      abortController.signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        this.pendingRequests.delete(request.id)
        reject(new Error('Request cancelled'))
      })

      // Send request
      window.api.dataApi.request(request).catch((error) => {
        clearTimeout(timeout)
        this.pendingRequests.delete(request.id)

        // Check if should retry
        if (retryCount < this.defaultRetryOptions.maxRetries && this.defaultRetryOptions.retryCondition(error)) {
          logger.debug(
            `Request failed, retrying attempt ${retryCount + 1}/${this.defaultRetryOptions.maxRetries}: ${request.path}`,
            error
          )

          const delay =
            this.defaultRetryOptions.retryDelay * Math.pow(this.defaultRetryOptions.backoffMultiplier, retryCount)

          setTimeout(() => {
            const retryRequest = { ...request, id: this.generateRequestId() }
            this.sendRequest<T>(retryRequest, retryCount + 1)
              .then(resolve)
              .catch(reject)
          }, delay)
        } else {
          reject(error)
        }
      })
    })
  }

  /**
   * Make HTTP request with enhanced features
   */
  private async makeRequest<T>(
    method: HttpMethod,
    path: string,
    options: {
      params?: any
      body?: any
      headers?: Record<string, string>
      metadata?: Record<string, any>
      signal?: AbortSignal
    } = {}
  ): Promise<T> {
    const { params, body, headers, metadata, signal } = options

    // Check if already aborted
    if (signal?.aborted) {
      throw new Error('Request cancelled')
    }

    // Create request
    const request: DataRequest = {
      id: this.generateRequestId(),
      method,
      path,
      params,
      body,
      headers,
      metadata: {
        timestamp: Date.now(),
        ...metadata
      }
    }

    logger.debug(`Making ${method} request to ${path}`, { request })

    // Set up external abort signal handling
    const requestPromise = this.sendRequest<T>(request)

    if (signal) {
      // If external signal is aborted during request, cancel our internal request
      const abortListener = () => {
        this.cancelRequest(request.id)
      }
      signal.addEventListener('abort', abortListener)

      // Clean up listener when request completes
      requestPromise.finally(() => {
        signal.removeEventListener('abort', abortListener)
      })
    }

    return requestPromise.catch((error) => {
      logger.error(`Request failed: ${method} ${path}`, error)
      throw toDataApiError(error, `${method} ${path}`)
    })
  }

  /**
   * Type-safe GET request
   */
  async get<TPath extends ConcreteApiPaths>(
    path: TPath,
    options?: {
      query?: any
      headers?: Record<string, string>
      signal?: AbortSignal
    }
  ): Promise<any> {
    return this.makeRequest<any>('GET', path as string, {
      params: options?.query,
      headers: options?.headers,
      signal: options?.signal
    })
  }

  /**
   * Type-safe POST request
   */
  async post<TPath extends ConcreteApiPaths>(
    path: TPath,
    options: {
      body?: any
      query?: Record<string, any>
      headers?: Record<string, string>
      signal?: AbortSignal
    }
  ): Promise<any> {
    return this.makeRequest<any>('POST', path as string, {
      params: options.query,
      body: options.body,
      headers: options.headers,
      signal: options.signal
    })
  }

  /**
   * Type-safe PUT request
   */
  async put<TPath extends ConcreteApiPaths>(
    path: TPath,
    options: {
      body: any
      query?: Record<string, any>
      headers?: Record<string, string>
      signal?: AbortSignal
    }
  ): Promise<any> {
    return this.makeRequest<any>('PUT', path as string, {
      params: options.query,
      body: options.body,
      headers: options.headers,
      signal: options.signal
    })
  }

  /**
   * Type-safe DELETE request
   */
  async delete<TPath extends ConcreteApiPaths>(
    path: TPath,
    options?: {
      query?: Record<string, any>
      headers?: Record<string, string>
      signal?: AbortSignal
    }
  ): Promise<any> {
    return this.makeRequest<any>('DELETE', path as string, {
      params: options?.query,
      headers: options?.headers,
      signal: options?.signal
    })
  }

  /**
   * Type-safe PATCH request
   */
  async patch<TPath extends ConcreteApiPaths>(
    path: TPath,
    options: {
      body?: any
      query?: Record<string, any>
      headers?: Record<string, string>
      signal?: AbortSignal
    }
  ): Promise<any> {
    return this.makeRequest<any>('PATCH', path as string, {
      params: options.query,
      body: options.body,
      headers: options.headers,
      signal: options.signal
    })
  }

  /**
   * Execute multiple requests in batch
   */
  async batch(requests: DataRequest[], options: { parallel?: boolean } = {}): Promise<BatchResponse> {
    const batchRequest: BatchRequest = {
      requests,
      parallel: options.parallel ?? true
    }

    return this.makeRequest<BatchResponse>('POST', '/batch', { body: batchRequest })
  }

  /**
   * Execute requests in a transaction
   */
  async transaction(operations: DataRequest[], options?: TransactionRequest['options']): Promise<DataResponse[]> {
    const transactionRequest: TransactionRequest = {
      operations,
      options
    }

    return this.makeRequest<DataResponse[]>('POST', '/transaction', { body: transactionRequest })
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe<T>(options: SubscriptionOptions, callback: SubscriptionCallback<T>): () => void {
    if (!window.api.dataApi?.subscribe) {
      throw new Error('Real-time subscriptions not supported')
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random()}`

    this.subscriptions.set(subscriptionId, {
      callback: callback as SubscriptionCallback,
      options
    })

    const unsubscribe = window.api.dataApi.subscribe(options.path, (data, event) => {
      // Convert string event to SubscriptionEvent enum
      const subscriptionEvent = event as SubscriptionEvent
      callback(data, subscriptionEvent)
    })

    logger.debug(`Subscribed to ${options.path}`, { subscriptionId })

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subscriptionId)
      unsubscribe()
      logger.debug(`Unsubscribed from ${options.path}`, { subscriptionId })
    }
  }

  /**
   * Create an AbortController for request cancellation
   * @returns Object with AbortController and convenience methods
   *
   * @example
   * ```typescript
   * const { signal, cancel } = requestService.createAbortController()
   *
   * // Use signal in requests
   * const dataPromise = requestService.get('/topics', { signal })
   *
   * // Cancel if needed
   * setTimeout(() => cancel(), 5000) // Cancel after 5 seconds
   * ```
   */
  createAbortController() {
    const controller = new AbortController()

    return {
      signal: controller.signal,
      cancel: () => controller.abort(),
      aborted: () => controller.signal.aborted
    }
  }

  /**
   * Get comprehensive request statistics
   */
  getRequestStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      activeSubscriptions: this.subscriptions.size
    }
  }
}

// Export singleton instance
export const dataApiService = DataApiService.getInstance()

// Clean up on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    dataApiService.cancelAllRequests()
  })
}
