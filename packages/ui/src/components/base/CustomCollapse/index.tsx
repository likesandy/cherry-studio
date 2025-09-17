import { Accordion, AccordionItem } from '@heroui/react'
import type { FC } from 'react'
import { memo, useEffect, useState } from 'react'

// 重新导出 HeroUI 的组件，方便直接使用
export { Accordion, AccordionItem } from '@heroui/react'

interface CustomCollapseProps {
  label: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
  destroyInactivePanel?: boolean
  defaultActiveKey?: string[]
  activeKey?: string[]
  collapsible?: 'header' | 'icon' | 'disabled'
  onChange?: (activeKeys: string | string[]) => void
  style?: React.CSSProperties
  classNames?: {
    trigger?: string
    content?: string
  }
  className?: string
  variant?: 'light' | 'shadow' | 'bordered' | 'splitted'
}

const CustomCollapse: FC<CustomCollapseProps> = ({
  label,
  extra,
  children,
  defaultActiveKey = ['1'],
  activeKey,
  collapsible,
  onChange,
  style,
  classNames,
  className = '',
  variant = 'bordered'
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    if (activeKey !== undefined) {
      return new Set(activeKey)
    }
    return new Set(defaultActiveKey)
  })

  useEffect(() => {
    if (activeKey !== undefined) {
      setExpandedKeys(new Set(activeKey))
    }
  }, [activeKey])

  const handleSelectionChange = (keys: 'all' | Set<React.Key>) => {
    if (keys === 'all') return

    const stringKeys = Array.from(keys).map((key) => String(key))
    const newExpandedKeys = new Set(stringKeys)

    if (activeKey === undefined) {
      setExpandedKeys(newExpandedKeys)
    }

    onChange?.(stringKeys.length === 1 ? stringKeys[0] : stringKeys)
  }

  const isDisabled = collapsible === 'disabled'

  return (
    <Accordion
      className={className}
      style={style}
      variant={variant}
      defaultExpandedKeys={activeKey === undefined ? defaultActiveKey : undefined}
      selectedKeys={activeKey !== undefined ? expandedKeys : undefined}
      onSelectionChange={handleSelectionChange}
      isDisabled={isDisabled}
      selectionMode="multiple">
      <AccordionItem
        key="1"
        aria-label={typeof label === 'string' ? label : 'collapse-item'}
        title={label}
        startContent={extra}
        classNames={{
          trigger: classNames?.trigger ?? '',
          content: classNames?.content ?? ''
        }}>
        {children}
      </AccordionItem>
    </Accordion>
  )
}

export default memo(CustomCollapse)
