import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { Tabs } from '@renderer/ui/vercel-tabs'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import DiscoverMain from './components/DiscoverMain'
import DiscoverSidebar from './components/DiscoverSidebar'
import { useDiscoverCategories } from './hooks/useDiscoverCategories'

export default function DiscoverPage() {
  const { t } = useTranslation()
  const { categories, activeTab, selectedSubcategory, currentCategory, handleSelectTab, handleSelectSubcategory } =
    useDiscoverCategories()

  // 使用 useMemo 优化 tabs 数据，避免每次渲染都创建新数组
  const vercelTabsData = useMemo(() => {
    return categories.map((category) => ({
      id: category.id,
      label: category.title
    }))
  }, [categories])

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full flex-col overflow-hidden">
        <Navbar>
          <NavbarCenter style={{ borderRight: 'none', justifyContent: 'space-between' }}>
            {t('discover.title')}
          </NavbarCenter>
        </Navbar>

        {categories.length > 0 && (
          <div className="px-4 py-2">
            <Tabs tabs={vercelTabsData} onTabChange={handleSelectTab} />
          </div>
        )}

        <div className="flex flex-row overflow-hidden">
          {currentCategory?.hasSidebar && (
            <div className="w-64 flex-shrink-0 border-r">
              <DiscoverSidebar
                activeCategory={currentCategory}
                selectedSubcategory={selectedSubcategory}
                onSelectSubcategory={handleSelectSubcategory}
              />
            </div>
          )}
          {/* {!currentCategory && categories.length > 0 && (
            <div className="w-64 flex-shrink-0 border-r p-4 text-muted-foreground">Select a category...</div>
          )} */}

          <main className="w-full overflow-hidden">
            <DiscoverMain
              activeTabId={activeTab}
              // selectedSubcategoryId={selectedSubcategory}
              currentCategory={currentCategory}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
