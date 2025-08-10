import '@ant-design/v5-patch-for-react-19'
import '@renderer/assets/styles/index.scss'

import { createRoot } from 'react-dom/client'

import MigrateApp from './MigrateApp'

const root = createRoot(document.getElementById('root') as HTMLElement)

root.render(<MigrateApp />)
