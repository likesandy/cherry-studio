/**
 * Auto-generated Redux Store to Preferences migration
 * Generated at: 2025-08-09T07:20:05.911Z
 *
 * === AUTO-GENERATED CONTENT START ===
 */

import dbService from '@data/db/DbService'
import { loggerService } from '@logger'

import type { MigrationResult } from './index'
import { TypeConverter } from './utils/typeConverters'

const logger = loggerService.withContext('ReduxMigrator')

// Redux Store键映射表，按category分组
const REDUX_MAPPINGS = [
  {
    category: 'settings',
    items: [
      {
        originalKey: 'autoCheckUpdate',
        targetKey: 'app.dist.auto_update.enabled',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'clickTrayToShowQuickAssistant',
        targetKey: 'feature.quick_assistant.click_tray_to_show',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'disableHardwareAcceleration',
        targetKey: 'app.disable_hardware_acceleration',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'enableDataCollection',
        targetKey: 'app.privacy.data_collection.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'enableDeveloperMode',
        targetKey: 'app.developer_mode.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'enableQuickAssistant',
        targetKey: 'feature.quick_assistant.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'launchToTray',
        targetKey: 'app.tray.on_launch',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'testChannel',
        targetKey: 'app.dist.test_plan.channel',
        type: 'string',
        defaultValue: 'UpgradeChannel.LATEST'
      },
      {
        originalKey: 'testPlan',
        targetKey: 'app.dist.test_plan.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'theme',
        targetKey: 'app.theme.mode',
        type: 'string',
        defaultValue: 'ThemeMode.system'
      },
      {
        originalKey: 'tray',
        targetKey: 'app.tray.enabled',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'trayOnClose',
        targetKey: 'app.tray.on_close',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'sendMessageShortcut',
        targetKey: 'chat.input.send_message_shortcut',
        type: 'string',
        defaultValue: 'Enter'
      },
      {
        originalKey: 'proxyMode',
        targetKey: 'app.proxy.mode',
        type: 'string',
        defaultValue: 'system'
      },
      {
        originalKey: 'proxyUrl',
        targetKey: 'app.proxy.url',
        type: 'string'
      },
      {
        originalKey: 'proxyBypassRules',
        targetKey: 'app.proxy.bypass_rules',
        type: 'string'
      },
      {
        originalKey: 'userName',
        targetKey: 'app.user.name',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'userId',
        targetKey: 'app.user.id',
        type: 'string',
        defaultValue: 'uuid()'
      },
      {
        originalKey: 'showPrompt',
        targetKey: 'chat.message.show_prompt',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'showTokens',
        targetKey: 'chat.message.show_tokens',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'showMessageDivider',
        targetKey: 'chat.message.show_divider',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'messageFont',
        targetKey: 'chat.message.font',
        type: 'string',
        defaultValue: 'system'
      },
      {
        originalKey: 'showInputEstimatedTokens',
        targetKey: 'chat.input.show_estimated_tokens',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'launchOnBoot',
        targetKey: 'app.launch_on_boot',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'userTheme',
        targetKey: 'app.theme.user_defined',
        type: 'object',
        defaultValue: {
          colorPrimary: '#00b96b'
        }
      },
      {
        originalKey: 'windowStyle',
        targetKey: 'app.theme.window_style',
        type: 'string',
        defaultValue: 'opaque'
      },
      {
        originalKey: 'fontSize',
        targetKey: 'chat.message.font_size',
        type: 'number',
        defaultValue: 14
      },
      {
        originalKey: 'topicPosition',
        targetKey: 'topic.position',
        type: 'string',
        defaultValue: 'left'
      },
      {
        originalKey: 'showTopicTime',
        targetKey: 'topic.show_time',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'pinTopicsToTop',
        targetKey: 'topic.pin_to_top',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'assistantIconType',
        targetKey: 'ui.assistant_icon_type',
        type: 'string',
        defaultValue: 'emoji'
      },
      {
        originalKey: 'pasteLongTextAsFile',
        targetKey: 'chat.input.paste_long_text_as_file',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'pasteLongTextThreshold',
        targetKey: 'chat.input.paste_long_text_threshold',
        type: 'number',
        defaultValue: 1500
      },
      {
        originalKey: 'clickAssistantToShowTopic',
        targetKey: 'ui.click_assistant_to_show_topic',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'codeExecution.enabled',
        targetKey: 'chat.code.execution.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'codeExecution.timeoutMinutes',
        targetKey: 'chat.code.execution.timeout_minutes',
        type: 'number',
        defaultValue: 1
      },
      {
        originalKey: 'codeEditor.enabled',
        targetKey: 'chat.code.editor.highlight_active_line',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'codeEditor.themeLight',
        targetKey: 'chat.code.editor.theme_light',
        type: 'string',
        defaultValue: 'auto'
      },
      {
        originalKey: 'codeEditor.themeDark',
        targetKey: 'chat.code.editor.theme_dark',
        type: 'string',
        defaultValue: 'auto'
      },
      {
        originalKey: 'codeEditor.foldGutter',
        targetKey: 'chat.code.editor.fold_gutter',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'codeEditor.autocompletion',
        targetKey: 'chat.code.editor.autocompletion',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'codeEditor.keymap',
        targetKey: 'chat.code.editor.keymap',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'codePreview.themeLight',
        targetKey: 'chat.code.preview.theme_light',
        type: 'string',
        defaultValue: 'auto'
      },
      {
        originalKey: 'codePreview.themeDark',
        targetKey: 'chat.code.preview.theme_dark',
        type: 'string',
        defaultValue: 'auto'
      },
      {
        originalKey: 'codeViewer.themeLight',
        targetKey: 'chat.code.viewer.theme_light',
        type: 'string',
        defaultValue: 'auto'
      },
      {
        originalKey: 'codeViewer.themeDark',
        targetKey: 'chat.code.viewer.theme_dark',
        type: 'string',
        defaultValue: 'auto'
      },
      {
        originalKey: 'codeShowLineNumbers',
        targetKey: 'chat.code.show_line_numbers',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'codeCollapsible',
        targetKey: 'chat.code.collapsible',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'codeWrappable',
        targetKey: 'chat.code.wrappable',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'codeImageTools',
        targetKey: 'chat.code.image_tools',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'mathEngine',
        targetKey: 'chat.message.math_engine',
        type: 'string',
        defaultValue: 'KaTeX'
      },
      {
        originalKey: 'messageStyle',
        targetKey: 'chat.message.style',
        type: 'string',
        defaultValue: 'plain'
      },
      {
        originalKey: 'foldDisplayMode',
        targetKey: 'chat.message.multi_model.fold_display_mode',
        type: 'string',
        defaultValue: 'expanded'
      },
      {
        originalKey: 'gridColumns',
        targetKey: 'chat.message.multi_model.grid_columns',
        type: 'number',
        defaultValue: 2
      },
      {
        originalKey: 'gridPopoverTrigger',
        targetKey: 'chat.message.multi_model.grid_popover_trigger',
        type: 'string',
        defaultValue: 'click'
      },
      {
        originalKey: 'messageNavigation',
        targetKey: 'chat.message.navigation_mode',
        type: 'string',
        defaultValue: 'none'
      },
      {
        originalKey: 'skipBackupFile',
        targetKey: 'data.backup.general.skip_backup_file',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'webdavHost',
        targetKey: 'data.backup.webdav.host',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'webdavUser',
        targetKey: 'data.backup.webdav.user',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'webdavPass',
        targetKey: 'data.backup.webdav.pass',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'webdavPath',
        targetKey: 'data.backup.webdav.path',
        type: 'string',
        defaultValue: '/cherry-studio'
      },
      {
        originalKey: 'webdavAutoSync',
        targetKey: 'data.backup.webdav.auto_sync',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'webdavSyncInterval',
        targetKey: 'data.backup.webdav.sync_interval',
        type: 'number',
        defaultValue: 0
      },
      {
        originalKey: 'webdavMaxBackups',
        targetKey: 'data.backup.webdav.max_backups',
        type: 'number',
        defaultValue: 0
      },
      {
        originalKey: 'webdavSkipBackupFile',
        targetKey: 'data.backup.webdav.skip_backup_file',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'webdavDisableStream',
        targetKey: 'data.backup.webdav.disable_stream',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'autoTranslateWithSpace',
        targetKey: 'chat.input.translate.auto_translate_with_space',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'showTranslateConfirm',
        targetKey: 'chat.input.translate.show_confirm',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'enableTopicNaming',
        targetKey: 'topic.naming.enabled',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'customCss',
        targetKey: 'ui.custom_css',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'topicNamingPrompt',
        targetKey: 'topic.naming.prompt',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'narrowMode',
        targetKey: 'chat.narrow_mode',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'multiModelMessageStyle',
        targetKey: 'chat.message.multi_model.style',
        type: 'string',
        defaultValue: 'horizontal'
      },
      {
        originalKey: 'readClipboardAtStartup',
        targetKey: 'feature.quick_assistant.read_clipboard_at_startup',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'notionDatabaseID',
        targetKey: 'data.integration.notion.database_id',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'notionApiKey',
        targetKey: 'data.integration.notion.api_key',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'notionPageNameKey',
        targetKey: 'data.integration.notion.page_name_key',
        type: 'string',
        defaultValue: 'Name'
      },
      {
        originalKey: 'markdownExportPath',
        targetKey: 'data.export.markdown.path',
        type: 'string',
        defaultValue: null
      },
      {
        originalKey: 'forceDollarMathInMarkdown',
        targetKey: 'data.export.markdown.force_dollar_math',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'useTopicNamingForMessageTitle',
        targetKey: 'data.export.markdown.use_topic_naming_for_message_title',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'showModelNameInMarkdown',
        targetKey: 'data.export.markdown.show_model_name',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'showModelProviderInMarkdown',
        targetKey: 'data.export.markdown.show_model_provider',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'thoughtAutoCollapse',
        targetKey: 'chat.message.thought.auto_collapse',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'notionExportReasoning',
        targetKey: 'data.integration.notion.export_reasoning',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'excludeCitationsInExport',
        targetKey: 'data.export.markdown.exclude_citations',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'standardizeCitationsInExport',
        targetKey: 'data.export.markdown.standardize_citations',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'yuqueToken',
        targetKey: 'data.integration.yuque.token',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'yuqueUrl',
        targetKey: 'data.integration.yuque.url',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'yuqueRepoId',
        targetKey: 'data.integration.yuque.repo_id',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'joplinToken',
        targetKey: 'data.integration.joplin.token',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'joplinUrl',
        targetKey: 'data.integration.joplin.url',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'joplinExportReasoning',
        targetKey: 'data.integration.joplin.export_reasoning',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'defaultObsidianVault',
        targetKey: 'data.integration.obsidian.default_vault',
        type: 'string',
        defaultValue: null
      },
      {
        originalKey: 'siyuanApiUrl',
        targetKey: 'data.integration.siyuan.api_url',
        type: 'string',
        defaultValue: null
      },
      {
        originalKey: 'siyuanToken',
        targetKey: 'data.integration.siyuan.token',
        type: 'string',
        defaultValue: null
      },
      {
        originalKey: 'siyuanBoxId',
        targetKey: 'data.integration.siyuan.box_id',
        type: 'string',
        defaultValue: null
      },
      {
        originalKey: 'siyuanRootPath',
        targetKey: 'data.integration.siyuan.root_path',
        type: 'string',
        defaultValue: null
      },
      {
        originalKey: 'maxKeepAliveMinapps',
        targetKey: 'feature.minapp.max_keep_alive',
        type: 'number',
        defaultValue: 3
      },
      {
        originalKey: 'showOpenedMinappsInSidebar',
        targetKey: 'feature.minapp.show_opened_in_sidebar',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'minappsOpenLinkExternal',
        targetKey: 'feature.minapp.open_link_external',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'enableSpellCheck',
        targetKey: 'app.spell_check.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'spellCheckLanguages',
        targetKey: 'app.spell_check.languages',
        type: 'array',
        defaultValue: []
      },
      {
        originalKey: 'enableQuickPanelTriggers',
        targetKey: 'chat.input.quick_panel.triggers_enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'enableBackspaceDeleteModel',
        targetKey: 'chat.input.backspace_delete_model',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.image',
        targetKey: 'data.export.menus.image',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.markdown',
        targetKey: 'data.export.menus.markdown',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.markdown_reason',
        targetKey: 'data.export.menus.markdown_reason',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.notion',
        targetKey: 'data.export.menus.notion',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.yuque',
        targetKey: 'data.export.menus.yuque',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.joplin',
        targetKey: 'data.export.menus.joplin',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.obsidian',
        targetKey: 'data.export.menus.obsidian',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.siyuan',
        targetKey: 'data.export.menus.siyuan',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.docx',
        targetKey: 'data.export.menus.docx',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'exportMenuOptions.plain_text',
        targetKey: 'data.export.menus.plain_text',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'notification.assistant',
        targetKey: 'app.notification.assistant.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'notification.backup',
        targetKey: 'app.notification.backup.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'notification.knowledge',
        targetKey: 'app.notification.knowledge.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'localBackupDir',
        targetKey: 'data.backup.local.dir',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 'localBackupAutoSync',
        targetKey: 'data.backup.local.auto_sync',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'localBackupSyncInterval',
        targetKey: 'data.backup.local.sync_interval',
        type: 'number',
        defaultValue: 0
      },
      {
        originalKey: 'localBackupMaxBackups',
        targetKey: 'data.backup.local.max_backups',
        type: 'number',
        defaultValue: 0
      },
      {
        originalKey: 'localBackupSkipBackupFile',
        targetKey: 'data.backup.local.skip_backup_file',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 's3.endpoint',
        targetKey: 'data.backup.s3.endpoint',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 's3.region',
        targetKey: 'data.backup.s3.region',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 's3.bucket',
        targetKey: 'data.backup.s3.bucket',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 's3.accessKeyId',
        targetKey: 'data.backup.s3.access_key_id',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 's3.secretAccessKey',
        targetKey: 'data.backup.s3.secret_access_key',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 's3.root',
        targetKey: 'data.backup.s3.root',
        type: 'string',
        defaultValue: ''
      },
      {
        originalKey: 's3.autoSync',
        targetKey: 'data.backup.s3.auto_sync',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 's3.syncInterval',
        targetKey: 'data.backup.s3.sync_interval',
        type: 'number',
        defaultValue: 0
      },
      {
        originalKey: 's3.maxBackups',
        targetKey: 'data.backup.s3.max_backups',
        type: 'number',
        defaultValue: 0
      },
      {
        originalKey: 's3.skipBackupFile',
        targetKey: 'data.backup.s3.skip_backup_file',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'navbarPosition',
        targetKey: 'ui.navbar.position',
        type: 'string',
        defaultValue: 'top'
      },
      {
        originalKey: 'apiServer.enabled',
        targetKey: 'feature.csaas.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'apiServer.host',
        targetKey: 'feature.csaas.host',
        type: 'string',
        defaultValue: 'localhost'
      },
      {
        originalKey: 'apiServer.port',
        targetKey: 'feature.csaas.port',
        type: 'number',
        defaultValue: 23333
      },
      {
        originalKey: 'apiServer.apiKey',
        targetKey: 'feature.csaas.api_key',
        type: 'string',
        defaultValue: '`cs-sk-${uuid()}`'
      }
    ]
  },
  {
    category: 'selectionStore',
    items: [
      {
        originalKey: 'selectionEnabled',
        targetKey: 'feature.selection.enabled',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'filterList',
        targetKey: 'feature.selection.filter_list',
        type: 'array',
        defaultValue: []
      },
      {
        originalKey: 'filterMode',
        targetKey: 'feature.selection.filter_mode',
        type: 'string',
        defaultValue: 'default'
      },
      {
        originalKey: 'triggerMode',
        targetKey: 'feature.selection.trigger_mode',
        type: 'string',
        defaultValue: 'selected'
      },
      {
        originalKey: 'isCompact',
        targetKey: 'feature.selection.is_compact',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'isAutoClose',
        targetKey: 'feature.selection.is_auto_close',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'isAutoPin',
        targetKey: 'feature.selection.is_auto_pin',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'isFollowToolbar',
        targetKey: 'feature.selection.is_follow_toolbar',
        type: 'boolean',
        defaultValue: true
      },
      {
        originalKey: 'isRemeberWinSize',
        targetKey: 'feature.selection.is_remeber_win_size',
        type: 'boolean',
        defaultValue: false
      },
      {
        originalKey: 'actionWindowOpacity',
        targetKey: 'feature.selection.action_window_opacity',
        type: 'number',
        defaultValue: 100
      },
      {
        originalKey: 'actionItems',
        targetKey: 'feature.selection.action_items',
        type: 'array',
        defaultValue: []
      }
    ]
  },
  {
    category: 'nutstore',
    items: [
      {
        originalKey: 'nutstoreToken',
        targetKey: 'data.backup.nutstore.token',
        type: 'string',
        defaultValue: null
      },
      {
        originalKey: 'nutstorePath',
        targetKey: 'data.backup.nutstore.path',
        type: 'string',
        defaultValue: null
      },
      {
        originalKey: 'nutstoreAutoSync',
        targetKey: 'data.backup.nutstore.auto_sync',
        type: 'boolean',
        defaultValue: null
      },
      {
        originalKey: 'nutstoreSyncInterval',
        targetKey: 'data.backup.nutstore.sync_interval',
        type: 'number',
        defaultValue: null
      },
      {
        originalKey: 'nutstoreSyncState',
        targetKey: 'data.backup.nutstore.sync_state',
        type: 'object',
        defaultValue: null
      },
      {
        originalKey: 'nutstoreSkipBackupFile',
        targetKey: 'data.backup.nutstore.skip_backup_file',
        type: 'boolean',
        defaultValue: null
      }
    ]
  }
] as const

export class ReduxMigrator {
  private typeConverter: TypeConverter

  constructor() {
    this.typeConverter = new TypeConverter()
  }

  /**
   * 执行Redux Store到preferences的迁移
   */
  async migrate(): Promise<MigrationResult> {
    const totalItems = REDUX_MAPPINGS.reduce((sum, group) => sum + group.items.length, 0)
    logger.info('开始Redux Store迁移', { totalItems })

    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      errors: [],
      source: 'redux'
    }

    // 读取Redux持久化数据
    const persistedData = await this.loadPersistedReduxData()

    if (!persistedData) {
      logger.warn('未找到Redis持久化数据，跳过迁移')
      return result
    }

    for (const categoryGroup of REDUX_MAPPINGS) {
      const { category, items } = categoryGroup

      for (const mapping of items) {
        try {
          await this.migrateReduxItem(persistedData, category, mapping)
          result.migratedCount++
        } catch (error) {
          logger.error('迁移Redux项失败', { category, mapping, error })
          result.errors.push({
            key: `${category}.${mapping.originalKey}`,
            error: error instanceof Error ? error.message : String(error)
          })
          result.success = false
        }
      }
    }

    logger.info('Redux Store迁移完成', result)
    return result
  }

  /**
   * 从localStorage读取持久化的Redux数据
   */
  private async loadPersistedReduxData(): Promise<any> {
    try {
      // 注意：这里需要在renderer进程中执行，或者通过IPC获取
      // 暂时返回null，实际实现需要根据项目架构调整
      logger.warn('loadPersistedReduxData需要具体实现')
      return null
    } catch (error) {
      logger.error('读取Redux持久化数据失败', error as Error)
      return null
    }
  }

  /**
   * 迁移单个Redux配置项
   */
  private async migrateReduxItem(
    persistedData: any,
    category: string,
    mapping: (typeof REDUX_MAPPINGS)[0]['items'][0]
  ): Promise<void> {
    const { originalKey, targetKey, type, defaultValue } = mapping

    // 从持久化数据中提取原始值
    const categoryData = persistedData[category]
    if (!categoryData) {
      // 如果分类数据不存在，使用默认值
      if (defaultValue !== null && defaultValue !== undefined) {
        const convertedValue = this.typeConverter.convert(defaultValue, type)
        await dbService.setPreference('default', targetKey, convertedValue)
        logger.debug('Redux分类不存在，使用默认值', { category, originalKey, targetKey, defaultValue })
      }
      return
    }

    const originalValue = categoryData[originalKey]

    if (originalValue === undefined || originalValue === null) {
      // 如果原始值不存在，使用默认值
      if (defaultValue !== null && defaultValue !== undefined) {
        const convertedValue = this.typeConverter.convert(defaultValue, type)
        await dbService.setPreference('default', targetKey, convertedValue)
        logger.debug('Redux值不存在，使用默认值', { category, originalKey, targetKey, defaultValue })
      }
      return
    }

    // 类型转换
    const convertedValue = this.typeConverter.convert(originalValue, type)

    // 写入preferences表
    await dbService.setPreference('default', targetKey, convertedValue)

    logger.debug('成功迁移Redux配置项', {
      category,
      originalKey,
      targetKey,
      originalValue,
      convertedValue
    })
  }
}

// === AUTO-GENERATED CONTENT END ===

/**
 * 迁移统计:
 * - Redux配置项: 154
 * - 涉及的Redux分类: settings, selectionStore, nutstore
 */
