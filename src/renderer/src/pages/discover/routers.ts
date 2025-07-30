import i18n from '@renderer/i18n'
import { CherryStoreType } from '@renderer/types/cherryStore'
import { lazy } from 'react'

export const discoverRouters = [
  {
    id: CherryStoreType.ASSISTANT,
    title: i18n.t('assistants.title'),
    path: 'assistant',
    component: lazy(() => import('./pages/agents/AgentsPage'))
  },
  {
    id: CherryStoreType.MINI_APP,
    title: i18n.t('minapp.title'),
    path: 'mini-app',
    component: lazy(() => import('./pages/minapps/MinAppsPage'))
  }
  //   {
  //     id: CherryStoreType.TRANSLATE,
  //     title: i18n.t('translate.title'),
  //     path: 'translate',
  //     component: lazy(() => import('../translate/TranslatePage'))
  //   },
  //   {
  //     id: CherryStoreType.FILES,
  //     title: i18n.t('files.title'),
  //     path: 'files',
  //     component: lazy(() => import('../files/FilesPage'))
  //   },
  //   {
  //     id: CherryStoreType.PAINTINGS,
  //     title: i18n.t('paintings.title'),
  //     path: 'paintings/*',
  //     isPrefix: true,
  //     component: lazy(() => import('../paintings/PaintingsRoutePage'))
  //   }
  //   {
  //     id: CherryStoreType.MCP_SERVER,
  //     title: i18n.t('common.mcp'),
  //     path: 'mcp-servers/*',
  //     isPrefix: true,
  //     component: lazy(() => import('../mcp-servers'))
  //   }
]

// 静态注册表 - 避免每次渲染都重新生成
export interface InternalCategory {
  id: string
  title: string
  path: string
  hasSidebar?: boolean
  items: Array<{ id: string; name: string; count?: number }>
}

// 预生成的分类注册表
export const CATEGORY_REGISTRY: InternalCategory[] = discoverRouters.map((router) => ({
  id: router.id,
  title: router.title,
  path: router.path,
  hasSidebar: false, // 目前都没有侧边栏
  items: [{ id: 'all', name: `All ${router.title}` }] // 预设 "All" 子分类
}))
