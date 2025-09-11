import { loggerService } from '@logger'
import { RichEditorRef } from '@renderer/components/RichEditor/types'
import { NotesSettings } from '@renderer/store/note'
import { Copy, Download, MonitorSpeaker, Type } from 'lucide-react'
import { ReactNode, RefObject } from 'react'

const logger = loggerService.withContext('MenuConfig')
export interface MenuContext {
  editorRef: RefObject<RichEditorRef>
  currentContent: string
  fileName: string
}

export interface MenuItem {
  key: string
  type?: 'divider' | 'component'
  labelKey: string
  icon?: React.ComponentType<any>
  action?: (
    settings: NotesSettings,
    updateSettings: (newSettings: Partial<NotesSettings>) => void,
    context?: MenuContext
  ) => void
  children?: MenuItem[]
  isActive?: (settings: NotesSettings) => boolean
  component?: (settings: NotesSettings, updateSettings: (newSettings: Partial<NotesSettings>) => void) => ReactNode
  copyAction?: boolean
  exportPdfAction?: boolean
}

export const handleExportPDF = async (context: MenuContext) => {
  if (!context.editorRef?.current || !context.currentContent?.trim()) {
    return
  }

  try {
    // Use Tiptap's getHTML API to get HTML content
    const htmlContent = context.editorRef.current.getHtml()
    const filename = context.fileName ? `${context.fileName}.pdf` : 'note.pdf'
    const result = await window.api.export.toPDF(htmlContent, filename)

    if (result.success) {
      logger.info('PDF exported successfully to:', result.filePath)
    } else {
      logger.error('PDF export failed:', result.message)
    }
  } catch (error: any) {
    logger.error('PDF export error:', error)
  }
}

export const menuItems: MenuItem[] = [
  {
    key: 'copy-content',
    labelKey: 'notes.copyContent',
    icon: Copy,
    copyAction: true
  },
  {
    key: 'export-pdf',
    labelKey: 'notes.exportPDF',
    icon: Download,
    exportPdfAction: true
  },
  {
    key: 'divider0',
    type: 'divider',
    labelKey: ''
  },
  {
    key: 'fullwidth',
    labelKey: 'notes.settings.display.compress_content',
    icon: MonitorSpeaker,
    action: (settings, updateSettings) => updateSettings({ isFullWidth: !settings.isFullWidth }),
    isActive: (settings) => !settings.isFullWidth
  },
  {
    key: 'table-of-contents',
    labelKey: 'notes.settings.display.show_table_of_contents',
    icon: Type,
    action: (settings, updateSettings) => updateSettings({ showTableOfContents: !settings.showTableOfContents }),
    isActive: (settings) => settings.showTableOfContents
  },
  {
    key: 'divider1',
    type: 'divider',
    labelKey: ''
  },
  {
    key: 'font',
    labelKey: 'notes.settings.display.font_title',
    icon: Type,
    children: [
      {
        key: 'default-font',
        labelKey: 'notes.settings.display.default_font',
        action: (_, updateSettings) => updateSettings({ fontFamily: 'default' }),
        isActive: (settings) => settings.fontFamily === 'default'
      },
      {
        key: 'serif-font',
        labelKey: 'notes.settings.display.serif_font',
        action: (_, updateSettings) => updateSettings({ fontFamily: 'serif' }),
        isActive: (settings) => settings.fontFamily === 'serif'
      },
      {
        key: 'divider2',
        type: 'divider',
        labelKey: ''
      },
      {
        key: 'font-size-small',
        labelKey: 'notes.settings.display.font_size_small',
        action: (_, updateSettings) => updateSettings({ fontSize: 14 }),
        isActive: (settings) => settings.fontSize === 14
      },
      {
        key: 'font-size-medium',
        labelKey: 'notes.settings.display.font_size_medium',
        action: (_, updateSettings) => updateSettings({ fontSize: 16 }),
        isActive: (settings) => settings.fontSize === 16
      },
      {
        key: 'font-size-large',
        labelKey: 'notes.settings.display.font_size_large',
        action: (_, updateSettings) => updateSettings({ fontSize: 20 }),
        isActive: (settings) => settings.fontSize === 20
      }
    ]
  }
]
