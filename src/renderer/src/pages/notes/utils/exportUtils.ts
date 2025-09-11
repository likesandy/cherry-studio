import { loggerService } from '@logger'
import { RichEditorRef } from '@renderer/components/RichEditor/types'
import { RefObject } from 'react'

const logger = loggerService.withContext('exportUtils')

export interface ExportContext {
  editorRef: RefObject<RichEditorRef>
  currentContent: string
  fileName: string
}

export const handleExportPDF = async (context: ExportContext) => {
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
