import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { getFancyProviderName } from '@renderer/utils'
import { ConflictInfo, ConflictResolution } from '@renderer/utils/provider'
import { Button, Card, Modal, Radio, Space, Tag, Typography } from 'antd'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Text, Title } = Typography

interface Props {
  conflicts: ConflictInfo[]
  onResolve: (resolutions: ConflictResolution[]) => void
  onCancel: () => void
  visible: boolean
}

const ConflictResolutionPopup: FC<Props> = ({ conflicts, onResolve, onCancel, visible }) => {
  const { t } = useTranslation()
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})

  const handleProviderSelect = (conflictId: string, providerId: string) => {
    setResolutions((prev) => ({
      ...prev,
      [conflictId]: providerId
    }))
  }

  const toggleApiKeyVisibility = (providerKey: string) => {
    setShowApiKeys((prev) => ({
      ...prev,
      [providerKey]: !prev[providerKey]
    }))
  }

  const handleResolve = () => {
    const conflictResolutions: ConflictResolution[] = Object.entries(resolutions).map(
      ([conflictId, selectedProviderId]) => ({
        conflictId,
        selectedProviderId
      })
    )
    onResolve(conflictResolutions)
  }

  const isAllResolved = conflicts.every((conflict) => resolutions[conflict.id])

  const renderProviderCard = (provider: ConflictInfo['providers'][0], conflictId: string, isSelected: boolean) => {
    const providerName = getFancyProviderName(provider)
    const providerKey = `${conflictId}-${provider._tempIndex}`
    const isApiKeyVisible = showApiKeys[providerKey]

    const renderApiKeyValue = () => {
      if (!provider.apiKey) {
        return <DetailValue>未设置</DetailValue>
      }

      return (
        <ApiKeyContainer>
          <DetailValue>{isApiKeyVisible ? provider.apiKey : '●●●●●●●●'}</DetailValue>
          <ApiKeyToggle
            onClick={(e) => {
              e.stopPropagation() // 防止触发卡片选择
              toggleApiKeyVisibility(providerKey)
            }}>
            {isApiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </ApiKeyToggle>
        </ApiKeyContainer>
      )
    }

    return (
      <ProviderCard
        key={provider._tempIndex}
        size="small"
        $selected={isSelected}
        onClick={() => handleProviderSelect(conflictId, provider._tempIndex!.toString())}>
        <ProviderHeader>
          <Radio checked={isSelected} />
          <ProviderName>{providerName}</ProviderName>
          {provider.enabled && <Tag color="green">ON</Tag>}
        </ProviderHeader>
        <ProviderDetails>
          <DetailRow>
            <DetailLabel>API Key:</DetailLabel>
            {renderApiKeyValue()}
          </DetailRow>
          <DetailRow>
            <DetailLabel>API Host:</DetailLabel>
            <DetailValue>{provider.apiHost || '默认'}</DetailValue>
          </DetailRow>
        </ProviderDetails>
      </ProviderCard>
    )
  }

  return (
    <Modal
      title={t('settings.provider.cleanup.conflict.resolution_title')}
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type="primary" onClick={handleResolve} disabled={!isAllResolved}>
            {t('settings.provider.cleanup.conflict.apply_resolution')}
          </Button>
        </Space>
      }>
      <ConflictContainer>
        <Text type="secondary">{t('settings.provider.cleanup.conflict.resolution_desc')}</Text>

        {conflicts.map((conflict, index) => (
          <ConflictSection key={conflict.id}>
            <Title level={5}>
              {t('settings.provider.cleanup.conflict.provider_conflict', {
                provider: getFancyProviderName({ name: conflict.id, id: conflict.id } as any)
              })}
            </Title>

            <ProvidersGrid>
              {conflict.providers.map((provider) =>
                renderProviderCard(provider, conflict.id, resolutions[conflict.id] === provider._tempIndex!.toString())
              )}
            </ProvidersGrid>

            {index < conflicts.length - 1 && <ConflictDivider />}
          </ConflictSection>
        ))}
      </ConflictContainer>
    </Modal>
  )
}

const ConflictContainer = styled.div`
  max-height: 500px;
  overflow-y: auto;
`

const ConflictSection = styled.div`
  margin-bottom: 24px;
`

const ProvidersGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
`

const ProviderCard = styled(Card)<{ $selected: boolean }>`
  cursor: pointer;
  border: 2px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) => (props.$selected ? 'var(--color-primary-bg)' : 'var(--color-background)')};
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
  }

  .ant-card-body {
    padding: 12px 16px;
  }
`

const ProviderHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`

const ProviderName = styled.span`
  font-weight: 500;
  flex: 1;
`

const ProviderDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const DetailRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const DetailLabel = styled(Text)`
  min-width: 80px;
  color: var(--color-text-3);
  font-size: 12px;
`

const DetailValue = styled(Text)`
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
`

const ApiKeyContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`

const ApiKeyToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  color: var(--color-text-3);
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-fill-tertiary);
    color: var(--color-text-1);
  }

  &:active {
    transform: scale(0.95);
  }
`

const ConflictDivider = styled.div`
  height: 1px;
  background: var(--color-border);
  margin: 24px 0;
`

export default ConflictResolutionPopup
