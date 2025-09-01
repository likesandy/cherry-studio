/**
 * AI SDK 参数转换模块
 * 统一管理从各个 apiClient 提取的参数处理和转换功能
 */

import { loggerService } from '@logger'
import {
  isClaudeReasoningModel,
  isGenerateImageModel,
  isNotSupportTemperatureAndTopP,
  isOpenRouterBuiltInWebSearchModel,
  isReasoningModel,
  isSupportedDisableGenerationModel,
  isSupportedFlexServiceTier,
  isSupportedReasoningEffortModel,
  isSupportedThinkingTokenModel,
  isVisionModel,
  isWebSearchModel
} from '@renderer/config/models'
import { getAssistantSettings, getDefaultModel, getProviderByModel } from '@renderer/services/AssistantService'
import type { Assistant, FileMetadata, MCPTool, Message, Model, Provider } from '@renderer/types'
import { FileTypes } from '@renderer/types'
import type { StreamTextParams } from '@renderer/types/aiCoreTypes'
import { FileMessageBlock, ImageMessageBlock, ThinkingMessageBlock } from '@renderer/types/newMessage'
// import { getWebSearchTools } from './utils/websearch'
import {
  findFileBlocks,
  findImageBlocks,
  findThinkingBlocks,
  getMainTextContent
} from '@renderer/utils/messageUtils/find'
import { defaultTimeout } from '@shared/config/constant'
import type { AssistantModelMessage, FilePart, ImagePart, ModelMessage, TextPart, UserModelMessage } from 'ai'
import { stepCountIs } from 'ai'

import { getAiSdkProviderId } from './provider/factory'
// import { webSearchTool } from './tools/WebSearchTool'
// import { jsonSchemaToZod } from 'json-schema-to-zod'
import { setupToolsConfig } from './utils/mcp'
import { buildProviderOptions } from './utils/options'

const logger = loggerService.withContext('transformParameters')

/**
 * 获取温度参数
 */
function getTemperature(assistant: Assistant, model: Model): number | undefined {
  if (assistant.settings?.reasoning_effort && isClaudeReasoningModel(model)) {
    return undefined
  }
  if (isNotSupportTemperatureAndTopP(model)) {
    return undefined
  }
  const assistantSettings = getAssistantSettings(assistant)
  return assistantSettings?.enableTemperature ? assistantSettings?.temperature : undefined
}

/**
 * 获取 TopP 参数
 */
function getTopP(assistant: Assistant, model: Model): number | undefined {
  if (assistant.settings?.reasoning_effort && isClaudeReasoningModel(model)) {
    return undefined
  }
  if (isNotSupportTemperatureAndTopP(model)) {
    return undefined
  }
  const assistantSettings = getAssistantSettings(assistant)
  return assistantSettings?.enableTopP ? assistantSettings?.topP : undefined
}

/**
 * 获取超时设置
 */
export function getTimeout(model: Model): number {
  if (isSupportedFlexServiceTier(model)) {
    return 15 * 1000 * 60
  }
  return defaultTimeout
}

/**
 * 提取文件内容
 */
export async function extractFileContent(message: Message): Promise<string> {
  const fileBlocks = findFileBlocks(message)
  if (fileBlocks.length > 0) {
    const textFileBlocks = fileBlocks.filter(
      (fb) => fb.file && [FileTypes.TEXT, FileTypes.DOCUMENT].includes(fb.file.type)
    )

    if (textFileBlocks.length > 0) {
      let text = ''
      const divider = '\n\n---\n\n'

      for (const fileBlock of textFileBlocks) {
        const file = fileBlock.file
        const fileContent = (await window.api.file.read(file.id + file.ext)).trim()
        const fileNameRow = 'file: ' + file.origin_name + '\n\n'
        text = text + fileNameRow + fileContent + divider
      }

      return text
    }
  }

  return ''
}

/**
 * 转换消息为 AI SDK 参数格式
 * 基于 OpenAI 格式的通用转换，支持文本、图片和文件
 */
export async function convertMessageToSdkParam(
  message: Message,
  isVisionModel = false,
  model?: Model
): Promise<ModelMessage> {
  const content = getMainTextContent(message)
  const fileBlocks = findFileBlocks(message)
  const imageBlocks = findImageBlocks(message)
  const reasoningBlocks = findThinkingBlocks(message)
  if (message.role === 'user' || message.role === 'system') {
    return convertMessageToUserModelMessage(content, fileBlocks, imageBlocks, isVisionModel, model)
  } else {
    return convertMessageToAssistantModelMessage(content, fileBlocks, reasoningBlocks, model)
  }
}

async function convertMessageToUserModelMessage(
  content: string,
  fileBlocks: FileMessageBlock[],
  imageBlocks: ImageMessageBlock[],
  isVisionModel = false,
  model?: Model
): Promise<UserModelMessage> {
  const parts: Array<TextPart | FilePart | ImagePart> = []
  if (content) {
    parts.push({ type: 'text', text: content })
  }

  // 处理图片（仅在支持视觉的模型中）
  if (isVisionModel) {
    for (const imageBlock of imageBlocks) {
      if (imageBlock.file) {
        try {
          const image = await window.api.file.base64Image(imageBlock.file.id + imageBlock.file.ext)
          parts.push({
            type: 'image',
            image: image.base64,
            mediaType: image.mime
          })
        } catch (error) {
          logger.warn('Failed to load image:', error as Error)
        }
      } else if (imageBlock.url) {
        parts.push({
          type: 'image',
          image: imageBlock.url
        })
      }
    }
  }
  // 处理文件
  for (const fileBlock of fileBlocks) {
    const file = fileBlock.file
    let processed = false

    // 优先尝试原生文件支持（PDF、图片等）
    if (model) {
      const filePart = await convertFileBlockToFilePart(fileBlock, model)
      if (filePart) {
        parts.push(filePart)
        logger.debug(`File ${file.origin_name} processed as native file format`)
        processed = true
      }
    }

    // 如果原生处理失败，回退到文本提取
    if (!processed) {
      const textPart = await convertFileBlockToTextPart(fileBlock)
      if (textPart) {
        parts.push(textPart)
        logger.debug(`File ${file.origin_name} processed as text content`)
      } else {
        logger.warn(`File ${file.origin_name} could not be processed in any format`)
      }
    }
  }

  return {
    role: 'user',
    content: parts
  }
}

async function convertMessageToAssistantModelMessage(
  content: string,
  fileBlocks: FileMessageBlock[],
  thinkingBlocks: ThinkingMessageBlock[],
  model?: Model
): Promise<AssistantModelMessage> {
  const parts: Array<TextPart | FilePart> = []
  if (content) {
    parts.push({ type: 'text', text: content })
  }

  for (const thinkingBlock of thinkingBlocks) {
    parts.push({ type: 'text', text: thinkingBlock.content })
  }

  for (const fileBlock of fileBlocks) {
    // 优先尝试原生文件支持（PDF等）
    if (model) {
      const filePart = await convertFileBlockToFilePart(fileBlock, model)
      if (filePart) {
        parts.push(filePart)
        continue
      }
    }

    // 回退到文本处理
    const textPart = await convertFileBlockToTextPart(fileBlock)
    if (textPart) {
      parts.push(textPart)
    }
  }

  return {
    role: 'assistant',
    content: parts
  }
}

async function convertFileBlockToTextPart(fileBlock: FileMessageBlock): Promise<TextPart | null> {
  const file = fileBlock.file

  // 处理文本文件
  if (file.type === FileTypes.TEXT) {
    try {
      const fileContent = await window.api.file.read(file.id + file.ext)
      return {
        type: 'text',
        text: `${file.origin_name}\n${fileContent.trim()}`
      }
    } catch (error) {
      logger.warn('Failed to read text file:', error as Error)
    }
  }

  // 处理文档文件（PDF、Word、Excel等）- 提取为文本内容
  if (file.type === FileTypes.DOCUMENT) {
    try {
      const fileContent = await window.api.file.read(file.id + file.ext, true) // true表示强制文本提取
      return {
        type: 'text',
        text: `${file.origin_name}\n${fileContent.trim()}`
      }
    } catch (error) {
      logger.warn(`Failed to extract text from document ${file.origin_name}:`, error as Error)
    }
  }

  return null
}

/**
 * 检查模型是否支持原生PDF输入
 */
function supportsPdfInput(model: Model): boolean {
  // 基于AI SDK文档，这些提供商支持PDF输入
  const supportedProviders = [
    'openai',
    'azure-openai',
    'anthropic',
    'google',
    'google-generative-ai',
    'google-vertex',
    'bedrock',
    'amazon-bedrock'
  ]

  const provider = getProviderByModel(model)
  const aiSdkId = getAiSdkProviderId(provider)

  return supportedProviders.some((provider) => aiSdkId === provider)
}

/**
 * 检查模型是否支持原生图片输入
 */
function supportsImageInput(model: Model): boolean {
  return isVisionModel(model)
}

/**
 * 检查提供商是否支持大文件上传（如Gemini File API）
 */
function supportsLargeFileUpload(model: Model): boolean {
  const provider = getProviderByModel(model)
  const aiSdkId = getAiSdkProviderId(provider)

  // 目前主要是Gemini系列支持大文件上传
  return ['google', 'google-generative-ai', 'google-vertex'].includes(aiSdkId)
}

/**
 * 获取提供商特定的文件大小限制
 */
function getFileSizeLimit(model: Model, fileType: FileTypes): number {
  const provider = getProviderByModel(model)
  const aiSdkId = getAiSdkProviderId(provider)

  // Anthropic PDF限制32MB
  if (aiSdkId === 'anthropic' && fileType === FileTypes.DOCUMENT) {
    return 32 * 1024 * 1024 // 32MB
  }

  // Gemini小文件限制20MB（超过此限制会使用File API上传）
  if (['google', 'google-generative-ai', 'google-vertex'].includes(aiSdkId)) {
    return 20 * 1024 * 1024 // 20MB
  }

  // 其他提供商没有明确限制，使用较大的默认值
  // 这与Legacy架构中的实现一致，让提供商自行处理文件大小
  return 100 * 1024 * 1024 // 100MB
}

/**
 * 处理Gemini大文件上传
 */
async function handleGeminiFileUpload(file: FileMetadata, model: Model): Promise<FilePart | null> {
  try {
    const provider = getProviderByModel(model)

    // 检查文件是否已经上传过
    const fileMetadata = await window.api.fileService.retrieve(provider, file.id)

    if (fileMetadata.status === 'success' && fileMetadata.originalFile?.file) {
      const remoteFile = fileMetadata.originalFile.file as any // 临时类型断言，因为File类型定义可能不完整
      // 注意：AI SDK的FilePart格式和Gemini原生格式不同，这里需要适配
      // 暂时返回null让它回退到文本处理，或者需要扩展FilePart支持uri
      logger.info(`File ${file.origin_name} already uploaded to Gemini with URI: ${remoteFile.uri || 'unknown'}`)
      return null
    }

    // 如果文件未上传，执行上传
    const uploadResult = await window.api.fileService.upload(provider, file)
    if (uploadResult.originalFile?.file) {
      const remoteFile = uploadResult.originalFile.file as any // 临时类型断言
      logger.info(`File ${file.origin_name} uploaded to Gemini with URI: ${remoteFile.uri || 'unknown'}`)
      // 同样，这里需要处理URI格式的文件引用
      return null
    }
  } catch (error) {
    logger.error(`Failed to upload file ${file.origin_name} to Gemini:`, error as Error)
  }

  return null
}

/**
 * 将文件块转换为FilePart（用于原生文件支持）
 */
async function convertFileBlockToFilePart(fileBlock: FileMessageBlock, model: Model): Promise<FilePart | null> {
  const file = fileBlock.file
  const fileSizeLimit = getFileSizeLimit(model, file.type)

  try {
    // 处理PDF文档
    if (file.type === FileTypes.DOCUMENT && file.ext === '.pdf' && supportsPdfInput(model)) {
      // 检查文件大小限制
      if (file.size > fileSizeLimit) {
        // 如果支持大文件上传（如Gemini File API），尝试上传
        if (supportsLargeFileUpload(model)) {
          logger.info(`Large PDF file ${file.origin_name} (${file.size} bytes) attempting File API upload`)
          const uploadResult = await handleGeminiFileUpload(file, model)
          if (uploadResult) {
            return uploadResult
          }
          // 如果上传失败，回退到文本处理
          logger.warn(`Failed to upload large PDF ${file.origin_name}, falling back to text extraction`)
          return null
        } else {
          logger.warn(`PDF file ${file.origin_name} exceeds size limit (${file.size} > ${fileSizeLimit})`)
          return null // 文件过大，回退到文本处理
        }
      }

      const base64Data = await window.api.file.base64File(file.id + file.ext)
      return {
        type: 'file',
        data: base64Data.data,
        mediaType: base64Data.mime,
        filename: file.origin_name
      }
    }

    // 处理图片文件
    if (file.type === FileTypes.IMAGE && supportsImageInput(model)) {
      // 检查文件大小
      if (file.size > fileSizeLimit) {
        logger.warn(`Image file ${file.origin_name} exceeds size limit (${file.size} > ${fileSizeLimit})`)
        return null
      }

      const base64Data = await window.api.file.base64Image(file.id + file.ext)

      // 处理MIME类型，特别是jpg->jpeg的转换（Anthropic要求）
      let mediaType = base64Data.mime
      const provider = getProviderByModel(model)
      const aiSdkId = getAiSdkProviderId(provider)

      if (aiSdkId === 'anthropic' && mediaType === 'image/jpg') {
        mediaType = 'image/jpeg'
      }

      return {
        type: 'file',
        data: base64Data.base64,
        mediaType: mediaType,
        filename: file.origin_name
      }
    }

    // 处理其他文档类型（Word、Excel等）
    if (file.type === FileTypes.DOCUMENT && file.ext !== '.pdf') {
      // 目前大多数提供商不支持Word等格式的原生处理
      // 返回null会触发上层调用convertFileBlockToTextPart进行文本提取
      // 这与Legacy架构中的处理方式一致
      logger.debug(`Document file ${file.origin_name} with extension ${file.ext} will use text extraction fallback`)
      return null
    }
  } catch (error) {
    logger.warn(`Failed to process file ${file.origin_name}:`, error as Error)
  }

  return null
}

/**
 * 转换 Cherry Studio 消息数组为 AI SDK 消息数组
 */
export async function convertMessagesToSdkMessages(
  messages: Message[],
  model: Model
): Promise<StreamTextParams['messages']> {
  const sdkMessages: StreamTextParams['messages'] = []
  const isVision = isVisionModel(model)

  for (const message of messages) {
    const sdkMessage = await convertMessageToSdkParam(message, isVision, model)
    sdkMessages.push(sdkMessage)
  }

  return sdkMessages
}

/**
 * 构建 AI SDK 流式参数
 * 这是主要的参数构建函数，整合所有转换逻辑
 */
export async function buildStreamTextParams(
  sdkMessages: StreamTextParams['messages'],
  assistant: Assistant,
  provider: Provider,
  options: {
    mcpTools?: MCPTool[]
    webSearchProviderId?: string
    requestOptions?: {
      signal?: AbortSignal
      timeout?: number
      headers?: Record<string, string>
    }
  } = {}
): Promise<{
  params: StreamTextParams
  modelId: string
  capabilities: {
    enableReasoning: boolean
    enableWebSearch: boolean
    enableGenerateImage: boolean
    enableUrlContext: boolean
  }
}> {
  const { mcpTools } = options

  const model = assistant.model || getDefaultModel()

  const { maxTokens } = getAssistantSettings(assistant)

  // 这三个变量透传出来，交给下面动态启用插件/中间件
  // 也可以在外部构建好再传入buildStreamTextParams
  // FIXME: qwen3即使关闭思考仍然会导致enableReasoning的结果为true
  const enableReasoning =
    ((isSupportedThinkingTokenModel(model) || isSupportedReasoningEffortModel(model)) &&
      assistant.settings?.reasoning_effort !== undefined) ||
    (isReasoningModel(model) && (!isSupportedThinkingTokenModel(model) || !isSupportedReasoningEffortModel(model)))

  const enableWebSearch =
    (assistant.enableWebSearch && isWebSearchModel(model)) ||
    isOpenRouterBuiltInWebSearchModel(model) ||
    model.id.includes('sonar') ||
    false

  const enableUrlContext = assistant.enableUrlContext || false

  const enableGenerateImage =
    isGenerateImageModel(model) &&
    (isSupportedDisableGenerationModel(model) ? assistant.enableGenerateImage || false : true)

  const tools = setupToolsConfig(mcpTools)

  // if (webSearchProviderId) {
  //   tools['builtin_web_search'] = webSearchTool(webSearchProviderId)
  // }

  // 构建真正的 providerOptions
  const providerOptions = buildProviderOptions(assistant, model, provider, {
    enableReasoning,
    enableWebSearch,
    enableGenerateImage
  })

  // 构建基础参数
  const params: StreamTextParams = {
    messages: sdkMessages,
    maxOutputTokens: maxTokens,
    temperature: getTemperature(assistant, model),
    topP: getTopP(assistant, model),
    abortSignal: options.requestOptions?.signal,
    headers: options.requestOptions?.headers,
    providerOptions,
    tools,
    stopWhen: stepCountIs(10)
  }
  if (assistant.prompt) {
    params.system = assistant.prompt
  }
  logger.debug('params', params)
  return {
    params,
    modelId: model.id,
    capabilities: { enableReasoning, enableWebSearch, enableGenerateImage, enableUrlContext }
  }
}

/**
 * 构建非流式的 generateText 参数
 */
export async function buildGenerateTextParams(
  messages: ModelMessage[],
  assistant: Assistant,
  provider: Provider,
  options: {
    mcpTools?: MCPTool[]
    enableTools?: boolean
  } = {}
): Promise<any> {
  // 复用流式参数的构建逻辑
  return await buildStreamTextParams(messages, assistant, provider, options)
}
