import React, { Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { ROUTERS } from '../routers'
import { InternalCategory } from '../type'

export interface DiscoverContentProps {
  activeTabId: string
  currentCategory: InternalCategory | undefined
}

const DiscoverContent: React.FC<DiscoverContentProps> = ({ activeTabId, currentCategory }) => {
  const location = useLocation()

  if (!currentCategory || !activeTabId) {
    return <div className="p-4 text-center">Loading: Category or Tab ID missing...</div>
  }

  if (!activeTabId && !location.pathname.startsWith('/discover/')) {
    return <Navigate to="/discover/assistant?subcategory=all" replace />
  }

  return (
    <Suspense fallback={null}>
      <Routes>
        {ROUTERS.map((_Route) => {
          if (!_Route.component) return null
          return <Route key={_Route.path} path={`/${_Route.path}`} element={<_Route.component />} />
        })}

        <Route path="*" element={<div>Discover Feature Not Found at {location.pathname}</div>} />
      </Routes>
    </Suspense>
  )
}

export default DiscoverContent
