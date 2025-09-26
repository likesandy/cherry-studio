import { loggerService } from '@logger'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { RichEditorRef } from '@renderer/components/RichEditor/types'
import { useActiveNode, useFileContent, useFileContentSync } from '@renderer/hooks/useNotesQuery'
import { useNotesSettings } from '@renderer/hooks/useNotesSettings'
import { useShowWorkspace } from '@renderer/hooks/useShowWorkspace'
import {
  addDir,
  addNote,
  delNode,
  loadTree,
  renameNode as renameEntry,
  sortTree,
  uploadNotes
} from '@renderer/services/NotesService'
import { findNode, findNodeByPath, findParent } from '@renderer/services/NotesTreeService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectActiveFilePath, selectSortType, setActiveFilePath, setSortType } from '@renderer/store/note'
import { NotesSortType, NotesTreeNode } from '@renderer/types/note'
import { FileChangeEvent } from '@shared/config/types'
import { debounce } from 'lodash'
import { AnimatePresence, motion } from 'motion/react'
import { Dispatch, FC, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import HeaderNavbar from './HeaderNavbar'
import NotesEditor from './NotesEditor'
import NotesSidebar from './NotesSidebar'

const STAR_STORAGE_KEY = 'notes:starred'
const EXPAND_STORAGE_KEY = 'notes:expanded'

const logger = loggerService.withContext('NotesPage')

function normalizePathValue(path: string): string {
  return path.replace(/\\/g, '/')
}

function readStoredPaths(key: string): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizePathValue(String(item)))
    }
  } catch (error) {
    logger.warn('Failed to read stored paths from localStorage', error as Error)
  }
  return []
}

function writeStoredPaths(key: string, paths: string[]): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(paths))
  } catch (error) {
    logger.warn('Failed to write stored paths to localStorage', error as Error)
  }
}

function addUniquePath(list: string[], path: string): string[] {
  const normalized = normalizePathValue(path)
  return list.includes(normalized) ? list : [...list, normalized]
}

function removePathEntries(list: string[], path: string, deep: boolean): string[] {
  const normalized = normalizePathValue(path)
  const prefix = `${normalized}/`
  return list.filter((item) => {
    if (item === normalized) {
      return false
    }
    if (deep && item.startsWith(prefix)) {
      return false
    }
    return true
  })
}

function replacePathEntries(list: string[], oldPath: string, newPath: string, deep: boolean): string[] {
  const oldNormalized = normalizePathValue(oldPath)
  const newNormalized = normalizePathValue(newPath)
  const prefix = `${oldNormalized}/`
  return list.map((item) => {
    if (item === oldNormalized) {
      return newNormalized
    }
    if (deep && item.startsWith(prefix)) {
      return `${newNormalized}${item.slice(oldNormalized.length)}`
    }
    return item
  })
}

function updateStoredPaths(
  setter: Dispatch<SetStateAction<string[]>>,
  key: string,
  updater: (list: string[]) => string[]
) {
  setter((prev) => {
    const next = updater(prev)
    writeStoredPaths(key, next)
    return next
  })
}

function updateTreeNode(
  nodes: NotesTreeNode[],
  nodeId: string,
  updater: (node: NotesTreeNode) => NotesTreeNode
): NotesTreeNode[] {
  let changed = false

  const nextNodes = nodes.map((node) => {
    if (node.id === nodeId) {
      changed = true
      const updated = updater(node)
      if (updated.type === 'folder' && !updated.children) {
        return { ...updated, children: [] }
      }
      return updated
    }

    if (node.children && node.children.length > 0) {
      const updatedChildren = updateTreeNode(node.children, nodeId, updater)
      if (updatedChildren !== node.children) {
        changed = true
        return { ...node, children: updatedChildren }
      }
    }

    return node
  })

  return changed ? nextNodes : nodes
}

function reorderTreeNodes(
  nodes: NotesTreeNode[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after'
): NotesTreeNode[] {
  const [updatedNodes, moved] = reorderSiblings(nodes, sourceId, targetId, position)
  if (moved) {
    return updatedNodes
  }

  let changed = false
  const nextNodes = nodes.map((node) => {
    if (!node.children || node.children.length === 0) {
      return node
    }

    const reorderedChildren = reorderTreeNodes(node.children, sourceId, targetId, position)
    if (reorderedChildren !== node.children) {
      changed = true
      return { ...node, children: reorderedChildren }
    }

    return node
  })

  return changed ? nextNodes : nodes
}

function reorderSiblings(
  nodes: NotesTreeNode[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after'
): [NotesTreeNode[], boolean] {
  const sourceIndex = nodes.findIndex((node) => node.id === sourceId)
  const targetIndex = nodes.findIndex((node) => node.id === targetId)

  if (sourceIndex === -1 || targetIndex === -1) {
    return [nodes, false]
  }

  const updated = [...nodes]
  const [sourceNode] = updated.splice(sourceIndex, 1)

  let insertIndex = targetIndex
  if (sourceIndex < targetIndex) {
    insertIndex -= 1
  }
  if (position === 'after') {
    insertIndex += 1
  }

  if (insertIndex < 0) {
    insertIndex = 0
  }
  if (insertIndex > updated.length) {
    insertIndex = updated.length
  }

  updated.splice(insertIndex, 0, sourceNode)
  return [updated, true]
}

const NotesPage: FC = () => {
  const editorRef = useRef<RichEditorRef>(null)
  const { t } = useTranslation()
  const { showWorkspace } = useShowWorkspace()
  const dispatch = useAppDispatch()
  const activeFilePath = useAppSelector(selectActiveFilePath)
  const sortType = useAppSelector(selectSortType)
  const { settings, notesPath, updateNotesPath } = useNotesSettings()

  // 混合策略：useLiveQuery用于笔记树，React Query用于文件内容
  const [notesTree, setNotesTree] = useState<NotesTreeNode[]>([])
  const [starredPaths, setStarredPaths] = useState<string[]>(() => readStoredPaths('notes:starred'))
  const [expandedPaths, setExpandedPaths] = useState<string[]>(() => readStoredPaths('notes:expanded'))
  const starredSet = useMemo(() => new Set(starredPaths), [starredPaths])
  const expandedSet = useMemo(() => new Set(expandedPaths), [expandedPaths])
  const { activeNode } = useActiveNode(notesTree)
  const { invalidateFileContent } = useFileContentSync()
  const { data: currentContent = '', isLoading: isContentLoading } = useFileContent(activeFilePath)

  const [tokenCount, setTokenCount] = useState(0)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const watcherRef = useRef<(() => void) | null>(null)
  const lastContentRef = useRef<string>('')
  const lastFilePathRef = useRef<string | undefined>(undefined)
  const isRenamingRef = useRef(false)
  const isCreatingNoteRef = useRef(false)

  const mergeTreeState = useCallback(
    (nodes: NotesTreeNode[]): NotesTreeNode[] => {
      return nodes.map((node) => {
        const normalizedPath = normalizePathValue(node.externalPath)
        const merged: NotesTreeNode = {
          ...node,
          externalPath: normalizedPath,
          isStarred: starredSet.has(normalizedPath)
        }

        if (node.type === 'folder') {
          merged.expanded = expandedSet.has(normalizedPath)
          merged.children = node.children ? mergeTreeState(node.children) : []
        }

        return merged
      })
    },
    [starredSet, expandedSet]
  )

  const refreshTree = useCallback(async () => {
    if (!notesPath) {
      setNotesTree([])
      return
    }

    try {
      const rawTree = await loadTree(notesPath)
      const sortedTree = sortTree(rawTree, sortType)
      setNotesTree(mergeTreeState(sortedTree))
    } catch (error) {
      logger.error('Failed to refresh notes tree:', error as Error)
    }
  }, [mergeTreeState, notesPath, sortType])

  useEffect(() => {
    const updateCharCount = () => {
      const textContent = editorRef.current?.getContent() || currentContent
      const plainText = textContent.replace(/<[^>]*>/g, '')
      setTokenCount(plainText.length)
    }
    updateCharCount()
  }, [currentContent])

  useEffect(() => {
    refreshTree()
  }, [refreshTree])

  // 保存当前笔记内容
  const saveCurrentNote = useCallback(
    async (content: string, filePath?: string) => {
      const targetPath = filePath || activeFilePath
      if (!targetPath || content.trim() === currentContent.trim()) return

      try {
        await window.api.file.write(targetPath, content)
        // 保存后立即刷新缓存，确保下次读取时获取最新内容
        invalidateFileContent(targetPath)
      } catch (error) {
        logger.error('Failed to save note:', error as Error)
      }
    },
    [activeFilePath, currentContent, invalidateFileContent]
  )

  // 防抖保存函数，在停止输入后才保存，避免输入过程中的文件写入
  const debouncedSave = useMemo(
    () =>
      debounce((content: string, filePath: string | undefined) => {
        saveCurrentNote(content, filePath)
      }, 800), // 800ms防抖延迟
    [saveCurrentNote]
  )

  const handleMarkdownChange = useCallback(
    (newMarkdown: string) => {
      // 记录最新内容和文件路径，用于兜底保存
      lastContentRef.current = newMarkdown
      lastFilePathRef.current = activeFilePath
      // 捕获当前文件路径，避免在防抖执行时文件路径已改变的竞态条件
      debouncedSave(newMarkdown, activeFilePath)
    },
    [debouncedSave, activeFilePath]
  )

  useEffect(() => {
    async function initialize() {
      if (!notesPath) {
        // 首次启动，获取默认路径
        const info = await window.api.getAppInfo()
        const defaultPath = info.notesPath
        updateNotesPath(defaultPath)
        return
      }
    }

    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesPath])

  // 处理树同步时的状态管理
  useEffect(() => {
    if (notesTree.length === 0) return
    // 如果有activeFilePath但找不到对应节点，清空选择
    // 但要排除正在同步树结构、重命名或创建笔记的情况，避免在这些操作中误清空
    const shouldClearPath = activeFilePath && !activeNode && !isRenamingRef.current && !isCreatingNoteRef.current

    if (shouldClearPath) {
      logger.warn('Clearing activeFilePath - node not found in tree', {
        activeFilePath,
        reason: 'Node not found in current tree'
      })
      dispatch(setActiveFilePath(undefined))
    }
  }, [notesTree, activeFilePath, activeNode, dispatch])

  useEffect(() => {
    if (!notesPath) return

    async function startFileWatcher() {
      // 清理之前的监控
      if (watcherRef.current) {
        watcherRef.current()
        watcherRef.current = null
      }

      // 定义文件变化处理函数
      const handleFileChange = async (data: FileChangeEvent) => {
        try {
          if (!notesPath) return
          const { eventType, filePath } = data
          const normalizedEventPath = normalizePathValue(filePath)

          switch (eventType) {
            case 'change': {
              // 处理文件内容变化 - 只有内容真正改变时才触发更新
              if (activeFilePath && normalizePathValue(activeFilePath) === normalizedEventPath) {
                invalidateFileContent(normalizedEventPath)
              }
              break
            }

            case 'add':
            case 'addDir':
            case 'unlink':
            case 'unlinkDir': {
              // 如果删除的是当前活动文件，清空选择
              if (
                (eventType === 'unlink' || eventType === 'unlinkDir') &&
                activeFilePath &&
                normalizePathValue(activeFilePath) === normalizedEventPath
              ) {
                dispatch(setActiveFilePath(undefined))
                editorRef.current?.clear()
              }

              await refreshTree()
              break
            }

            default:
              logger.debug('Unhandled file event type:', { eventType })
          }
        } catch (error) {
          logger.error('Failed to handle file change:', error as Error)
        }
      }

      try {
        await window.api.file.startFileWatcher(notesPath)
        watcherRef.current = window.api.file.onFileChange(handleFileChange)
      } catch (error) {
        logger.error('Failed to start file watcher:', error as Error)
      }
    }

    startFileWatcher()

    return () => {
      if (watcherRef.current) {
        watcherRef.current()
        watcherRef.current = null
      }
      window.api.file.stopFileWatcher().catch((error) => {
        logger.error('Failed to stop file watcher:', error)
      })

      // 如果有未保存的内容，立即保存
      if (lastContentRef.current && lastContentRef.current !== currentContent && lastFilePathRef.current) {
        saveCurrentNote(lastContentRef.current, lastFilePathRef.current).catch((error) => {
          logger.error('Emergency save failed:', error as Error)
        })
      }

      // 清理防抖函数
      debouncedSave.cancel()
    }
  }, [
    notesPath,
    activeFilePath,
    invalidateFileContent,
    dispatch,
    currentContent,
    debouncedSave,
    saveCurrentNote,
    refreshTree
  ])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !currentContent) return
    // 获取编辑器当前内容
    const editorMarkdown = editor.getMarkdown()

    // 只有当编辑器内容与期望内容不一致时才更新
    // 这样既能处理初始化，也能处理后续的内容同步，还能避免光标跳动
    if (editorMarkdown !== currentContent) {
      editor.setMarkdown(currentContent)
    }
  }, [currentContent, activeFilePath])

  // 切换文件时的清理工作
  useEffect(() => {
    return () => {
      // 保存之前文件的内容
      if (lastContentRef.current && lastFilePathRef.current) {
        saveCurrentNote(lastContentRef.current, lastFilePathRef.current).catch((error) => {
          logger.error('Emergency save before file switch failed:', error as Error)
        })
      }

      // 取消防抖保存并清理状态
      debouncedSave.cancel()
      lastContentRef.current = ''
      lastFilePathRef.current = undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath])

  // 获取目标文件夹路径（选中文件夹或根目录）
  const getTargetFolderPath = useCallback(() => {
    if (selectedFolderId) {
      const selectedNode = findNode(notesTree, selectedFolderId)
      if (selectedNode && selectedNode.type === 'folder') {
        return selectedNode.externalPath
      }
    }
    return notesPath // 默认返回根目录
  }, [selectedFolderId, notesTree, notesPath])

  // 创建文件夹
  const handleCreateFolder = useCallback(
    async (name: string) => {
      try {
        const targetPath = getTargetFolderPath()
        if (!targetPath) {
          throw new Error('No folder path selected')
        }
        await addDir(name, targetPath)
        updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) =>
          addUniquePath(prev, normalizePathValue(targetPath))
        )
        await refreshTree()
      } catch (error) {
        logger.error('Failed to create folder:', error as Error)
      }
    },
    [getTargetFolderPath, refreshTree]
  )

  // 创建笔记
  const handleCreateNote = useCallback(
    async (name: string) => {
      try {
        isCreatingNoteRef.current = true

        const targetPath = getTargetFolderPath()
        if (!targetPath) {
          throw new Error('No folder path selected')
        }
        const { path: notePath } = await addNote(name, '', targetPath)
        const normalizedParent = normalizePathValue(targetPath)
        updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) => addUniquePath(prev, normalizedParent))
        dispatch(setActiveFilePath(notePath))
        setSelectedFolderId(null)

        await refreshTree()
      } catch (error) {
        logger.error('Failed to create note:', error as Error)
      } finally {
        // 延迟重置标志，给数据库同步一些时间
        setTimeout(() => {
          isCreatingNoteRef.current = false
        }, 500)
      }
    },
    [dispatch, getTargetFolderPath, refreshTree]
  )

  const handleToggleExpanded = useCallback(
    (nodeId: string) => {
      const targetNode = findNode(notesTree, nodeId)
      if (!targetNode || targetNode.type !== 'folder') {
        return
      }

      const nextExpanded = !targetNode.expanded
      setNotesTree((prev) => updateTreeNode(prev, nodeId, (node) => ({ ...node, expanded: nextExpanded })))
      updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) =>
        nextExpanded
          ? addUniquePath(prev, targetNode.externalPath)
          : removePathEntries(prev, targetNode.externalPath, false)
      )
    },
    [notesTree]
  )

  const handleToggleStar = useCallback(
    (nodeId: string) => {
      const node = findNode(notesTree, nodeId)
      if (!node) {
        return
      }

      const nextStarred = !node.isStarred
      setNotesTree((prev) => updateTreeNode(prev, nodeId, (current) => ({ ...current, isStarred: nextStarred })))
      updateStoredPaths(setStarredPaths, STAR_STORAGE_KEY, (prev) =>
        nextStarred ? addUniquePath(prev, node.externalPath) : removePathEntries(prev, node.externalPath, false)
      )
    },
    [notesTree]
  )

  // 选择节点
  const handleSelectNode = useCallback(
    async (node: NotesTreeNode) => {
      if (node.type === 'file') {
        try {
          dispatch(setActiveFilePath(node.externalPath))
          invalidateFileContent(node.externalPath)
          // 清除文件夹选择状态
          setSelectedFolderId(null)
        } catch (error) {
          logger.error('Failed to load note:', error as Error)
        }
      } else if (node.type === 'folder') {
        setSelectedFolderId(node.id)
        handleToggleExpanded(node.id)
      }
    },
    [dispatch, handleToggleExpanded, invalidateFileContent]
  )

  // 删除节点
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      try {
        const nodeToDelete = findNode(notesTree, nodeId)
        if (!nodeToDelete) return

        await delNode(nodeToDelete)

        updateStoredPaths(setStarredPaths, STAR_STORAGE_KEY, (prev) =>
          removePathEntries(prev, nodeToDelete.externalPath, nodeToDelete.type === 'folder')
        )
        updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) =>
          removePathEntries(prev, nodeToDelete.externalPath, nodeToDelete.type === 'folder')
        )

        const normalizedActivePath = activeFilePath ? normalizePathValue(activeFilePath) : undefined
        const normalizedDeletePath = normalizePathValue(nodeToDelete.externalPath)
        const isActiveNode = normalizedActivePath === normalizedDeletePath
        const isActiveDescendant =
          nodeToDelete.type === 'folder' &&
          normalizedActivePath &&
          normalizedActivePath.startsWith(`${normalizedDeletePath}/`)

        if (isActiveNode || isActiveDescendant) {
          dispatch(setActiveFilePath(undefined))
          editorRef.current?.clear()
        }

        await refreshTree()
      } catch (error) {
        logger.error('Failed to delete node:', error as Error)
      }
    },
    [notesTree, activeFilePath, dispatch, refreshTree]
  )

  // 重命名节点
  const handleRenameNode = useCallback(
    async (nodeId: string, newName: string) => {
      try {
        isRenamingRef.current = true

        const node = findNode(notesTree, nodeId)
        if (!node || node.name === newName) {
          return
        }

        const oldPath = node.externalPath
        const renamed = await renameEntry(node, newName)

        if (node.type === 'file' && activeFilePath === oldPath) {
          dispatch(setActiveFilePath(renamed.path))
        } else if (node.type === 'folder' && activeFilePath && activeFilePath.startsWith(`${oldPath}/`)) {
          const suffix = activeFilePath.slice(oldPath.length)
          dispatch(setActiveFilePath(`${renamed.path}${suffix}`))
        }

        updateStoredPaths(setStarredPaths, STAR_STORAGE_KEY, (prev) =>
          replacePathEntries(prev, oldPath, renamed.path, node.type === 'folder')
        )
        updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) =>
          replacePathEntries(prev, oldPath, renamed.path, node.type === 'folder')
        )

        await refreshTree()
      } catch (error) {
        logger.error('Failed to rename node:', error as Error)
      } finally {
        setTimeout(() => {
          isRenamingRef.current = false
        }, 500)
      }
    },
    [activeFilePath, dispatch, notesTree, refreshTree]
  )

  // 处理文件上传
  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      try {
        if (!files || files.length === 0) {
          window.toast.warning(t('notes.no_file_selected'))
          return
        }

        const targetFolderPath = getTargetFolderPath()
        if (!targetFolderPath) {
          throw new Error('No folder path selected')
        }

        const result = await uploadNotes(files, targetFolderPath)

        // 检查上传结果
        if (result.fileCount === 0) {
          window.toast.warning(t('notes.no_valid_files'))
          return
        }

        // 排序并显示成功信息
        updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) =>
          addUniquePath(prev, normalizePathValue(targetFolderPath))
        )
        await refreshTree()

        const successMessage = t('notes.upload_success')

        window.toast.success(successMessage)
      } catch (error) {
        logger.error('Failed to handle file upload:', error as Error)
        window.toast.error(t('notes.upload_failed'))
      }
    },
    [getTargetFolderPath, refreshTree, t]
  )

  // 处理节点移动
  const handleMoveNode = useCallback(
    async (sourceNodeId: string, targetNodeId: string, position: 'before' | 'after' | 'inside') => {
      if (!notesPath) {
        return
      }

      try {
        const sourceNode = findNode(notesTree, sourceNodeId)
        const targetNode = findNode(notesTree, targetNodeId)

        if (!sourceNode || !targetNode) {
          return
        }

        if (position === 'inside' && targetNode.type !== 'folder') {
          return
        }

        const rootPath = normalizePathValue(notesPath)
        const sourceParentNode = findParent(notesTree, sourceNodeId)
        const targetParentNode = position === 'inside' ? targetNode : findParent(notesTree, targetNodeId)

        const sourceParentPath = sourceParentNode ? sourceParentNode.externalPath : rootPath
        const targetParentPath =
          position === 'inside' ? targetNode.externalPath : targetParentNode ? targetParentNode.externalPath : rootPath

        const normalizedSourceParent = normalizePathValue(sourceParentPath)
        const normalizedTargetParent = normalizePathValue(targetParentPath)

        const isManualReorder = position !== 'inside' && normalizedSourceParent === normalizedTargetParent

        if (isManualReorder) {
          setNotesTree((prev) =>
            reorderTreeNodes(prev, sourceNodeId, targetNodeId, position === 'before' ? 'before' : 'after')
          )
          return
        }

        const { safeName } = await window.api.file.checkFileName(
          normalizedTargetParent,
          sourceNode.name,
          sourceNode.type === 'file'
        )

        const destinationPath =
          sourceNode.type === 'file'
            ? `${normalizedTargetParent}/${safeName}.md`
            : `${normalizedTargetParent}/${safeName}`

        if (destinationPath === sourceNode.externalPath) {
          return
        }

        if (sourceNode.type === 'file') {
          await window.api.file.move(sourceNode.externalPath, destinationPath)
        } else {
          await window.api.file.moveDir(sourceNode.externalPath, destinationPath)
        }

        updateStoredPaths(setStarredPaths, STAR_STORAGE_KEY, (prev) =>
          replacePathEntries(prev, sourceNode.externalPath, destinationPath, sourceNode.type === 'folder')
        )
        updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) =>
          replacePathEntries(prev, sourceNode.externalPath, destinationPath, sourceNode.type === 'folder')
        )
        updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) => addUniquePath(prev, normalizedTargetParent))

        const normalizedActivePath = activeFilePath ? normalizePathValue(activeFilePath) : undefined
        if (normalizedActivePath) {
          if (normalizedActivePath === sourceNode.externalPath) {
            dispatch(setActiveFilePath(destinationPath))
          } else if (sourceNode.type === 'folder' && normalizedActivePath.startsWith(`${sourceNode.externalPath}/`)) {
            const suffix = normalizedActivePath.slice(sourceNode.externalPath.length)
            dispatch(setActiveFilePath(`${destinationPath}${suffix}`))
          }
        }

        await refreshTree()
      } catch (error) {
        logger.error('Failed to move nodes:', error as Error)
      }
    },
    [activeFilePath, dispatch, notesPath, notesTree, refreshTree]
  )

  // 处理节点排序
  const handleSortNodes = useCallback(
    async (newSortType: NotesSortType) => {
      dispatch(setSortType(newSortType))
      setNotesTree((prev) => mergeTreeState(sortTree(prev, newSortType)))
    },
    [dispatch, mergeTreeState]
  )

  const handleExpandPath = useCallback(
    (treePath: string) => {
      if (!treePath) {
        return
      }

      const segments = treePath.split('/').filter(Boolean)
      if (segments.length === 0) {
        return
      }

      let nextTree = notesTree
      const pathsToAdd: string[] = []

      segments.forEach((_, index) => {
        const currentPath = '/' + segments.slice(0, index + 1).join('/')
        const node = findNodeByPath(nextTree, currentPath)
        if (node && node.type === 'folder' && !node.expanded) {
          pathsToAdd.push(node.externalPath)
          nextTree = updateTreeNode(nextTree, node.id, (current) => ({ ...current, expanded: true }))
        }
      })

      if (pathsToAdd.length > 0) {
        setNotesTree(nextTree)
        updateStoredPaths(setExpandedPaths, EXPAND_STORAGE_KEY, (prev) => {
          let updated = prev
          pathsToAdd.forEach((path) => {
            updated = addUniquePath(updated, path)
          })
          return updated
        })
      }
    },
    [notesTree]
  )

  const getCurrentNoteContent = useCallback(() => {
    if (settings.defaultEditMode === 'source') {
      return currentContent
    } else {
      return editorRef.current?.getMarkdown() || currentContent
    }
  }, [currentContent, settings.defaultEditMode])

  return (
    <Container id="notes-page">
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('notes.title')}</NavbarCenter>
      </Navbar>
      <ContentContainer id="content-container">
        <AnimatePresence initial={false}>
          {showWorkspace && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 250, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}>
              <NotesSidebar
                notesTree={notesTree}
                selectedFolderId={selectedFolderId}
                onSelectNode={handleSelectNode}
                onCreateFolder={handleCreateFolder}
                onCreateNote={handleCreateNote}
                onDeleteNode={handleDeleteNode}
                onRenameNode={handleRenameNode}
                onToggleExpanded={handleToggleExpanded}
                onToggleStar={handleToggleStar}
                onMoveNode={handleMoveNode}
                onSortNodes={handleSortNodes}
                onUploadFiles={handleUploadFiles}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <EditorWrapper>
          <HeaderNavbar
            notesTree={notesTree}
            getCurrentNoteContent={getCurrentNoteContent}
            onToggleStar={handleToggleStar}
            onExpandPath={handleExpandPath}
          />
          <NotesEditor
            activeNodeId={activeNode?.id}
            currentContent={currentContent}
            tokenCount={tokenCount}
            isLoading={isContentLoading}
            onMarkdownChange={handleMarkdownChange}
            editorRef={editorRef}
          />
        </EditorWrapper>
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  min-height: 0;
`

const EditorWrapper = styled.div`
  display: flex;
  position: relative;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  flex: 1;
  max-width: 100%;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
`

export default NotesPage
