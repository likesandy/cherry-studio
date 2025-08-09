/**
 * Auto-generated ElectronStore to Preferences migration
 * Generated at: 2025-08-09T07:20:05.910Z
 *
 * === AUTO-GENERATED CONTENT START ===
 */

import dbService from '@data/db/DbService'
import { loggerService } from '@logger'
import { configManager } from '@main/services/ConfigManager'

import type { MigrationResult } from './index'
import { TypeConverter } from './utils/typeConverters'

const logger = loggerService.withContext('ElectronStoreMigrator')

// 键映射表
const KEY_MAPPINGS = [
  {
    originalKey: 'Language',
    targetKey: 'app.language',
    sourceCategory: 'Language',
    type: 'unknown',
    defaultValue: null
  },
  {
    originalKey: 'SelectionAssistantFollowToolbar',
    targetKey: 'feature.selection.follow_toolbar',
    sourceCategory: 'SelectionAssistantFollowToolbar',
    type: 'unknown',
    defaultValue: null
  },
  {
    originalKey: 'SelectionAssistantRemeberWinSize',
    targetKey: 'feature.selection.remember_win_size',
    sourceCategory: 'SelectionAssistantRemeberWinSize',
    type: 'unknown',
    defaultValue: null
  },
  {
    originalKey: 'ZoomFactor',
    targetKey: 'app.zoom_factor',
    sourceCategory: 'ZoomFactor',
    type: 'unknown',
    defaultValue: null
  }
] as const

export class ElectronStoreMigrator {
  private typeConverter: TypeConverter

  constructor() {
    this.typeConverter = new TypeConverter()
  }

  /**
   * 执行ElectronStore到preferences的迁移
   */
  async migrate(): Promise<MigrationResult> {
    logger.info('开始ElectronStore迁移', { totalItems: KEY_MAPPINGS.length })

    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      errors: [],
      source: 'electronStore'
    }

    for (const mapping of KEY_MAPPINGS) {
      try {
        await this.migrateItem(mapping)
        result.migratedCount++
      } catch (error) {
        logger.error('迁移单项失败', { mapping, error })
        result.errors.push({
          key: mapping.originalKey,
          error: error instanceof Error ? error.message : String(error)
        })
        result.success = false
      }
    }

    logger.info('ElectronStore迁移完成', result)
    return result
  }

  /**
   * 迁移单个配置项
   */
  private async migrateItem(mapping: (typeof KEY_MAPPINGS)[0]): Promise<void> {
    const { originalKey, targetKey, type, defaultValue } = mapping

    // 从ElectronStore读取原始值
    const originalValue = configManager.get(originalKey)

    if (originalValue === undefined || originalValue === null) {
      // 如果原始值不存在，使用默认值
      if (defaultValue !== null && defaultValue !== undefined) {
        const convertedValue = this.typeConverter.convert(defaultValue, type)
        await dbService.setPreference('default', targetKey, convertedValue)
        logger.debug('使用默认值迁移', { originalKey, targetKey, defaultValue: convertedValue })
      }
      return
    }

    // 类型转换
    const convertedValue = this.typeConverter.convert(originalValue, type)

    // 写入preferences表
    await dbService.setPreference('default', targetKey, convertedValue)

    logger.debug('成功迁移配置项', {
      originalKey,
      targetKey,
      originalValue,
      convertedValue
    })
  }

  /**
   * 验证迁移结果
   */
  async validateMigration(): Promise<boolean> {
    logger.info('开始验证ElectronStore迁移结果')

    for (const mapping of KEY_MAPPINGS) {
      const { targetKey } = mapping

      try {
        const value = await dbService.getPreference('default', targetKey)
        if (value === null) {
          logger.error('验证失败：配置项不存在', { targetKey })
          return false
        }
      } catch (error) {
        logger.error('验证失败：读取配置项错误', { targetKey, error })
        return false
      }
    }

    logger.info('ElectronStore迁移验证成功')
    return true
  }
}

// === AUTO-GENERATED CONTENT END ===

/**
 * 迁移统计:
 * - ElectronStore配置项: 4
 * - 包含的原始键: Language, SelectionAssistantFollowToolbar, SelectionAssistantRemeberWinSize, ZoomFactor
 */
