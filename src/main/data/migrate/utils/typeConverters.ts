/**
 * Type conversion utilities for migration
 * Generated at: 2025-08-09T07:20:05.912Z
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('TypeConverter')

export class TypeConverter {
  /**
   * 转换值到指定类型
   */
  convert(value: any, targetType: string): any {
    if (value === null || value === undefined) {
      return null
    }

    try {
      switch (targetType) {
        case 'boolean':
          return this.toBoolean(value)
        
        case 'string':
          return this.toString(value)
        
        case 'number':
          return this.toNumber(value)
        
        case 'array':
        case 'unknown[]':
          return this.toArray(value)
        
        case 'object':
        case 'Record<string, unknown>':
          return this.toObject(value)
        
        default:
          // 未知类型，保持原样
          logger.debug('未知类型，保持原值', { targetType, value })
          return value
      }
    } catch (error) {
      logger.error('类型转换失败', { value, targetType, error })
      return value
    }
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      return lower === 'true' || lower === '1' || lower === 'yes'
    }
    if (typeof value === 'number') {
      return value !== 0
    }
    return Boolean(value)
  }

  private toString(value: any): string {
    if (typeof value === 'string') {
      return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  private toNumber(value: any): number {
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      if (isNaN(parsed)) {
        logger.warn('字符串无法转换为数字', { value })
        return 0
      }
      return parsed
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }
    return 0
  }

  private toArray(value: any): any[] {
    if (Array.isArray(value)) {
      return value
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : [value]
      } catch {
        return [value]
      }
    }
    return [value]
  }

  private toObject(value: any): Record<string, any> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) 
          ? parsed 
          : { value }
      } catch {
        return { value }
      }
    }
    return { value }
  }
}