import { PreferencesType } from './preferences'

export type PreferenceDefaultScopeType = PreferencesType['default']
export type PreferenceKeyType = keyof PreferenceDefaultScopeType

export type PreferenceShortcutType = {
  key: string[]
  editable: boolean
  enabled: boolean
  system: boolean
}
