import { PreferencesType } from './preferences'

export type PreferenceDefaultScopeType = PreferencesType['default']
export type PreferenceKeyType = keyof PreferenceDefaultScopeType

export type PreferenceUpdateOptions = {
  optimistic: boolean
}

export type PreferenceShortcutType = {
  key: string[]
  editable: boolean
  enabled: boolean
  system: boolean
}

export type SelectionTriggerMode = 'selected' | 'ctrlkey' | 'shortcut'
export type SelectionFilterMode = 'default' | 'whitelist' | 'blacklist'
export type SelectionActionItem = {
  id: string
  name: string
  enabled: boolean
  isBuiltIn: boolean
  icon?: string
  prompt?: string
  assistantId?: string
  selectedText?: string
  searchEngine?: string
}

export enum ThemeMode {
  light = 'light',
  dark = 'dark',
  system = 'system'
}

/** 有限的UI语言 */
export type LanguageVarious = 'zh-CN' | 'zh-TW' | 'el-GR' | 'en-US' | 'es-ES' | 'fr-FR' | 'ja-JP' | 'pt-PT' | 'ru-RU'
