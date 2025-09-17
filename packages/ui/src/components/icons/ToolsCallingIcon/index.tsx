// Original: src/renderer/src/components/Icons/ToolsCallingIcon.tsx
import { Tooltip } from '@heroui/react'
import { Wrench } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '../../../utils'

interface ToolsCallingIconProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  iconClassName?: string
}

const ToolsCallingIcon = ({ className, iconClassName, ...props }: ToolsCallingIconProps) => {
  const { t } = useTranslation()

  return (
    <div className={cn('flex justify-center items-center', className)} {...props}>
      <Tooltip content={t('models.function_calling')} placement="top">
        <Wrench className={cn('w-4 h-4 mr-1.5 text-[#00b96b]', iconClassName)} />
      </Tooltip>
    </div>
  )
}

export default ToolsCallingIcon
