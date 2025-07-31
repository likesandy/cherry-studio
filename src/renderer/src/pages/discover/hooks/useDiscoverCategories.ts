import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ROUTERS, ROUTERS_ENTRIES } from '../routers'

export function useDiscoverCategories() {
  const [activeTab, setActiveTab] = useState<string>('')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all')

  const navigate = useNavigate()
  const location = useLocation()

  // 使用 useRef 来跟踪是否是用户手动导航，避免重复渲染
  const isUserNavigationRef = useRef(false)

  // URL 同步逻辑 - 适配新的 URL 格式 /discover/xxx?category=xxx
  useEffect(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean)
    const currentCategoryPath = pathSegments.length >= 2 && pathSegments[0] === 'discover' ? pathSegments[1] : undefined
    const searchParams = new URLSearchParams(location.search)
    const categoryFromQuery = searchParams.get('category')
    const subcategoryFromQuery = searchParams.get('subcategory') || 'all'

    // 处理基础路径重定向
    if (location.pathname === '/discover' || location.pathname === '/discover/') {
      if (ROUTERS.length > 0) {
        const firstCategory = ROUTERS[0]
        navigate(`/discover/${firstCategory.path}?category=${firstCategory.id}&subcategory=all`, { replace: true })
      }
      return
    }

    // 根据URL格式，优先使用 category 查询参数
    let targetCategoryId: string | null = categoryFromQuery

    // 如果没有 category 参数，尝试从路径推断
    if (!targetCategoryId && currentCategoryPath) {
      const categoryFromPath = ROUTERS_ENTRIES[currentCategoryPath]
      targetCategoryId = categoryFromPath?.id || null
    }

    // 处理无效分类重定向
    if (!targetCategoryId || !ROUTERS_ENTRIES[targetCategoryId]) {
      if (ROUTERS.length > 0) {
        const firstCategory = ROUTERS[0]
        navigate(`/discover/${firstCategory.path}?category=${firstCategory.id}&subcategory=all`, { replace: true })
      }
      return
    }

    // 只有当状态确实需要更新时才更新
    if (activeTab !== targetCategoryId) {
      setActiveTab(targetCategoryId)
    }

    if (selectedSubcategory !== subcategoryFromQuery) {
      setSelectedSubcategory(subcategoryFromQuery)
    }

    // 重置用户导航标记
    isUserNavigationRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, navigate]) // 故意不包含 activeTab 和 selectedSubcategory 以避免重复渲染

  const currentCategory = useMemo(() => {
    return ROUTERS_ENTRIES[activeTab]
  }, [activeTab])

  // 优化的 Tab 选择处理，使用 useCallback 避免重复渲染
  // 更新为新的 URL 格式 /discover/xxx?category=xxx&subcategory=xxx
  const handleSelectTab = useCallback(
    (tabId: string) => {
      if (activeTab === tabId) return // 如果已经是当前 tab，直接返回

      const categoryToSelect = ROUTERS_ENTRIES[tabId]
      if (categoryToSelect?.path) {
        isUserNavigationRef.current = true
        navigate(`/discover/${categoryToSelect.path}?category=${tabId}&subcategory=all`)
      }
    },
    [activeTab, navigate]
  )

  // 优化的子分类选择处理
  const handleSelectSubcategory = useCallback(
    (subcategoryId: string) => {
      if (selectedSubcategory === subcategoryId) return // 如果已经是当前子分类，直接返回

      const currentCatDetails = ROUTERS_ENTRIES[activeTab]
      if (currentCatDetails?.path) {
        isUserNavigationRef.current = true
        navigate(`/discover/${currentCatDetails.path}?category=${activeTab}&subcategory=${subcategoryId}`)
      }
    },
    [selectedSubcategory, activeTab, navigate]
  )

  return {
    activeTab,
    selectedSubcategory,
    currentCategory,
    handleSelectTab,
    handleSelectSubcategory,
    setActiveTab
  }
}
