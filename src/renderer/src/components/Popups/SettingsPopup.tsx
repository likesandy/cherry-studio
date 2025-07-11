export interface SettingsPopupShowParams {
  defaultTab?:
    | 'provider'
    | 'model'
    | 'tool'
    | 'general'
    | 'display'
    | 'shortcut'
    | 'quickAssistant'
    | 'selectionAssistant'
    | 'data'
    | 'about'
    | 'quickPhrase'
}

export default class SettingsPopup {
  static hide() {
    // Settings window is now independent, user can close it manually
  }

  static show(props: SettingsPopupShowParams = {}) {
    return window.api.showSettingsWindow({ defaultTab: props.defaultTab })
  }
}
