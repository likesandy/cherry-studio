// Original path: src/renderer/src/components/ProviderAvatar.tsx
import { Avatar } from 'antd'
import React from 'react'
import styled from 'styled-components'

import { generateColorFromChar, getFirstCharacter, getForegroundColor } from './utils'

interface ProviderAvatarProps {
  providerId: string
  providerName: string
  logoSrc?: string
  size?: number
  className?: string
  style?: React.CSSProperties
  renderCustomLogo?: (providerId: string) => React.ReactNode
}

const ProviderLogo = styled(Avatar)`
  width: 100%;
  height: 100%;
  border: 0.5px solid var(--color-border);
`

const ProviderSvgLogo = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.5px solid var(--color-border);
  border-radius: 100%;

  & > svg {
    width: 80%;
    height: 80%;
  }
`

export const ProviderAvatar: React.FC<ProviderAvatarProps> = ({
  providerId,
  providerName,
  logoSrc,
  size,
  className,
  style,
  renderCustomLogo
}) => {
  // Check if custom logo renderer is provided for special providers
  if (renderCustomLogo) {
    const customLogo = renderCustomLogo(providerId)
    if (customLogo) {
      return (
        <ProviderSvgLogo className={className} style={style}>
          {customLogo}
        </ProviderSvgLogo>
      )
    }
  }

  // If logo source is provided, render image avatar
  if (logoSrc) {
    return (
      <ProviderLogo draggable="false" shape="circle" src={logoSrc} className={className} style={style} size={size} />
    )
  }

  // Default: generate avatar with first character and background color
  const backgroundColor = generateColorFromChar(providerName)
  const color = providerName ? getForegroundColor(backgroundColor) : 'white'

  return (
    <ProviderLogo
      size={size}
      shape="circle"
      className={className}
      style={{
        backgroundColor,
        color,
        ...style
      }}>
      {getFirstCharacter(providerName)}
    </ProviderLogo>
  )
}

export default ProviderAvatar
