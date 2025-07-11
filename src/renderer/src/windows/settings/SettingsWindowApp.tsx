import '@renderer/i18n'
import '@renderer/databases'

import StyleSheetManager from '@renderer/context/StyleSheetManager'
import { useSettings } from '@renderer/hooks/useSettings'
import AboutSettings from '@renderer/pages/settings/AboutSettings'
import DataSettings from '@renderer/pages/settings/DataSettings/DataSettings'
import DisplaySettings from '@renderer/pages/settings/DisplaySettings/DisplaySettings'
import GeneralSettings from '@renderer/pages/settings/GeneralSettings'
import ModelSettings from '@renderer/pages/settings/ModelSettings/ModelSettings'
import ProvidersList from '@renderer/pages/settings/ProviderSettings'
import QuickAssistantSettings from '@renderer/pages/settings/QuickAssistantSettings'
import QuickPhraseSettings from '@renderer/pages/settings/QuickPhraseSettings'
import SelectionAssistantSettings from '@renderer/pages/settings/SelectionAssistantSettings/SelectionAssistantSettings'
import ShortcutSettings from '@renderer/pages/settings/ShortcutSettings'
import ToolSettings from '@renderer/pages/settings/ToolSettings'
import { Spin } from 'antd'
import {
  Cloud,
  Command,
  HardDrive,
  Info,
  MonitorCog,
  Package,
  PencilRuler,
  Rocket,
  Settings2,
  TextCursorInput,
  Zap
} from 'lucide-react'
import React, { Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

type SettingsTab =
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

// Inner component that uses hooks after Redux is initialized
function SettingsWindowContent(): React.ReactElement {
  const { t } = useTranslation()
  const { customCss } = useSettings()
  const [activeTab, setActiveTab] = useState<SettingsTab>('provider')

  // Remove spinner after component mounts
  useEffect(() => {
    document.getElementById('spinner')?.remove()
    console.timeEnd('settings-init')
  }, [])

  // Handle custom CSS injection
  useEffect(() => {
    let customCssElement = document.getElementById('user-defined-custom-css') as HTMLStyleElement
    if (customCssElement) {
      customCssElement.remove()
    }

    if (customCss) {
      customCssElement = document.createElement('style')
      customCssElement.id = 'user-defined-custom-css'
      customCssElement.textContent = customCss
      document.head.appendChild(customCssElement)
    }
  }, [customCss])

  useEffect(() => {
    // Parse URL parameters for initial tab
    const urlParams = new URLSearchParams(window.location.search)
    const tab = urlParams.get('tab')
    if (tab && isValidTab(tab)) {
      setActiveTab(tab as SettingsTab)
    }
  }, [])

  const isValidTab = (tab: string): boolean => {
    const validTabs = [
      'provider',
      'model',
      'tool',
      'general',
      'display',
      'shortcut',
      'quickAssistant',
      'selectionAssistant',
      'data',
      'about',
      'quickPhrase'
    ]
    return validTabs.includes(tab)
  }

  const menuItems = [
    { key: 'provider', icon: <Cloud size={18} />, label: t('settings.provider.title') },
    { key: 'model', icon: <Package size={18} />, label: t('settings.model') },
    { key: 'tool', icon: <PencilRuler size={18} />, label: t('settings.tool.title') },
    { key: 'general', icon: <Settings2 size={18} />, label: t('settings.general') },
    { key: 'display', icon: <MonitorCog size={18} />, label: t('settings.display.title') },
    { key: 'shortcut', icon: <Command size={18} />, label: t('settings.shortcuts.title') },
    { key: 'quickAssistant', icon: <Rocket size={18} />, label: t('settings.quickAssistant.title') },
    { key: 'selectionAssistant', icon: <TextCursorInput size={18} />, label: t('selection.name') },
    { key: 'quickPhrase', icon: <Zap size={18} />, label: t('settings.quickPhrase.title') },
    { key: 'data', icon: <HardDrive size={18} />, label: t('settings.data.title') },
    { key: 'about', icon: <Info size={18} />, label: t('settings.about') }
  ] as const

  const renderContent = () => {
    switch (activeTab) {
      case 'provider':
        return (
          <Suspense fallback={<Spin />}>
            <ProvidersList />
          </Suspense>
        )
      case 'model':
        return <ModelSettings />
      case 'tool':
        return <ToolSettings />
      case 'general':
        return <GeneralSettings />
      case 'display':
        return <DisplaySettings />
      case 'shortcut':
        return <ShortcutSettings />
      case 'quickAssistant':
        return <QuickAssistantSettings />
      case 'selectionAssistant':
        return <SelectionAssistantSettings />
      case 'data':
        return <DataSettings />
      case 'about':
        return <AboutSettings />
      case 'quickPhrase':
        return <QuickPhraseSettings />
      default:
        return <ProvidersList />
    }
  }

  return (
    <StyleSheetManager>
      <Container>
        <TitleBar>
          <Title>{t('settings.title')}</Title>
        </TitleBar>
        <ContentContainer>
          <SettingMenus>
            {menuItems.map((item) => (
              <MenuItem
                key={item.key}
                className={activeTab === item.key ? 'active' : ''}
                onClick={() => setActiveTab(item.key as SettingsTab)}>
                {item.icon}
                {item.label}
              </MenuItem>
            ))}
          </SettingMenus>
          <SettingContent>{renderContent()}</SettingContent>
        </ContentContainer>
      </Container>
    </StyleSheetManager>
  )
}

const SettingsWindowApp: React.FC = () => {
  return <SettingsWindowContent />
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--color-background);
`

const TitleBar = styled.div`
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 20px;
  background: var(--color-background);
  border-bottom: 0.5px solid var(--color-border);
  -webkit-app-region: drag;
  user-select: none;
`

const Title = styled.h1`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  height: calc(100vh - 40px);
`

const SettingMenus = styled.div`
  display: flex;
  flex-direction: column;
  min-width: var(--settings-width);
  border-right: 0.5px solid var(--color-border);
  padding: 10px;
  user-select: none;
  background: var(--color-background);
`

const MenuItem = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  width: 100%;
  cursor: pointer;
  border-radius: var(--list-item-border-radius);
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  border: 0.5px solid transparent;
  margin-bottom: 5px;

  .anticon {
    font-size: 16px;
    opacity: 0.8;
  }

  .iconfont {
    font-size: 18px;
    line-height: 18px;
    opacity: 0.7;
    margin-left: -1px;
  }

  &:hover {
    background: var(--color-background-soft);
  }

  &.active {
    background: var(--color-background-soft);
    border: 0.5px solid var(--color-border);
  }
`

const SettingContent = styled.div`
  display: flex;
  height: 100%;
  flex: 1;
  overflow: auto;
`

export default SettingsWindowApp
