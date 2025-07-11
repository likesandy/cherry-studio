import '@renderer/assets/styles/index.scss'
import '@ant-design/v5-patch-for-react-19'

import KeyvStorage from '@kangfenmao/keyv-storage'
import AntdProvider from '@renderer/context/AntdProvider'
import { CodeStyleProvider } from '@renderer/context/CodeStyleProvider'
import { ThemeProvider } from '@renderer/context/ThemeProvider'
import NavigationService from '@renderer/services/NavigationService'
import storeSyncService from '@renderer/services/StoreSyncService'
import store, { persistor } from '@renderer/store'
import { message, Modal } from 'antd'
import { FC } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'

import SettingsWindowApp from './SettingsWindowApp'

/**
 *  This function is required for model API
 *    eg. BaseProviders.ts
 *  Although the coupling is too strong, we have no choice but to load it
 *  In multi-window handling, decoupling is needed
 */
function initKeyv() {
  window.keyv = new KeyvStorage()
  window.keyv.init()
}

initKeyv()

//subscribe to store sync
storeSyncService.subscribe()

// Navigation wrapper component to set up navigation service
const NavigationWrapper: FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()

  // Set up navigation service for the settings window
  NavigationService.setNavigate(navigate)

  return <>{children}</>
}

const App: FC = () => {
  // 设置窗口需要显示各种操作的提示消息（如API连接测试、保存成功等）
  // messageContextHolder 为 Ant Design 的全局消息提示提供上下文容器
  const [messageApi, messageContextHolder] = message.useMessage()
  const [modal, modalContextHolder] = Modal.useModal()

  // Set up global APIs for the settings window
  window.message = messageApi
  window.modal = modal

  return (
    <Provider store={store}>
      <ThemeProvider>
        <AntdProvider>
          <CodeStyleProvider>
            <PersistGate loading={null} persistor={persistor}>
              <MemoryRouter initialEntries={['/settings/provider']}>
                <NavigationWrapper>
                  {/* 消息提示容器，用于显示设置操作的反馈信息 */}
                  {messageContextHolder}
                  {modalContextHolder}
                  <SettingsWindowApp />
                </NavigationWrapper>
              </MemoryRouter>
            </PersistGate>
          </CodeStyleProvider>
        </AntdProvider>
      </ThemeProvider>
    </Provider>
  )
}

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<App />)
