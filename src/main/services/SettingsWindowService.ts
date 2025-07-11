import { is } from '@electron-toolkit/utils'
import { isLinux, isMac } from '@main/constant'
import { IpcChannel } from '@shared/IpcChannel'
import { BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'

import icon from '../../../build/icon.png?asset'
import { titleBarOverlayDark, titleBarOverlayLight } from '../config'

export class SettingsWindowService {
  private static instance: SettingsWindowService | null = null
  private settingsWindow: BrowserWindow | null = null

  public static getInstance(): SettingsWindowService {
    if (!SettingsWindowService.instance) {
      SettingsWindowService.instance = new SettingsWindowService()
    }
    return SettingsWindowService.instance
  }

  public createSettingsWindow(defaultTab?: string): BrowserWindow {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return this.settingsWindow
    }

    this.settingsWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 900,
      minHeight: 600,
      show: false,
      autoHideMenuBar: true,
      transparent: false,
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      titleBarStyle: 'hidden',
      titleBarOverlay: nativeTheme.shouldUseDarkColors ? titleBarOverlayDark : titleBarOverlayLight,
      backgroundColor: isMac ? undefined : nativeTheme.shouldUseDarkColors ? '#181818' : '#FFFFFF',
      darkTheme: nativeTheme.shouldUseDarkColors,
      trafficLightPosition: { x: 12, y: 12 },
      ...(isLinux ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        webSecurity: false,
        webviewTag: true,
        allowRunningInsecureContent: true,
        backgroundThrottling: false
      }
    })

    this.setupSettingsWindow()
    this.loadSettingsWindowContent(defaultTab)

    return this.settingsWindow
  }

  private setupSettingsWindow() {
    if (!this.settingsWindow) return

    this.settingsWindow.on('ready-to-show', () => {
      this.settingsWindow?.show()
    })

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null
    })

    this.settingsWindow.on('close', () => {
      // Clean up when window is closed
    })

    // Handle theme changes
    nativeTheme.on('updated', () => {
      if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
        this.settingsWindow.setTitleBarOverlay(
          nativeTheme.shouldUseDarkColors ? titleBarOverlayDark : titleBarOverlayLight
        )
      }
    })
  }

  private loadSettingsWindowContent(defaultTab?: string) {
    if (!this.settingsWindow) return

    const queryParam = defaultTab ? `?tab=${defaultTab}` : ''

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.settingsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/settingsWindow.html' + queryParam)
    } else {
      this.settingsWindow.loadFile(join(__dirname, '../renderer/settingsWindow.html'))
      if (defaultTab) {
        this.settingsWindow.webContents.once('did-finish-load', () => {
          this.settingsWindow?.webContents.send(IpcChannel.SettingsWindow_Show, { defaultTab })
        })
      }
    }
  }

  public showSettingsWindow(defaultTab?: string) {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isMinimized()) {
        this.settingsWindow.restore()
      }

      if (!isLinux) {
        this.settingsWindow.setVisibleOnAllWorkspaces(true)
      }

      this.settingsWindow.show()
      this.settingsWindow.focus()

      if (!isLinux) {
        this.settingsWindow.setVisibleOnAllWorkspaces(false)
      }
    } else {
      this.createSettingsWindow(defaultTab)
    }
  }

  public hideSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.hide()
    }
  }

  public closeSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close()
    }
  }

  public getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow
  }

  public static registerIpcHandler() {
    const { ipcMain } = require('electron')
    const service = SettingsWindowService.getInstance()

    ipcMain.handle(IpcChannel.SettingsWindow_Show, (_, options?: { defaultTab?: string }) => {
      service.showSettingsWindow(options?.defaultTab)
    })
  }
}

export const settingsWindowService = SettingsWindowService.getInstance()
