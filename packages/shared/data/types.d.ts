import { PreferencesType } from './preferences'

export type PreferenceDefaultScopeType = PreferencesType['default']
export type PreferenceKeyType = keyof PreferenceDefaultScopeType

export interface PreferenceUpdateOptions {
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
export interface SelectionActionItem {
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
