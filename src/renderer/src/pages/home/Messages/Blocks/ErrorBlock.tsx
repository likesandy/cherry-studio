import CodeViewer from '@renderer/components/CodeViewer'
import { useTimer } from '@renderer/hooks/useTimer'
import { getHttpMessageLabel, getProviderLabel } from '@renderer/i18n/label'
import { getProviderById } from '@renderer/services/ProviderService'
import { useAppDispatch } from '@renderer/store'
import { removeBlocksThunk } from '@renderer/store/thunk/messageThunk'
import type { ErrorMessageBlock, Message } from '@renderer/types/newMessage'
import { Alert as AntdAlert, Button, Modal } from 'antd'
import React, { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

const HTTP_ERROR_CODES = [400, 401, 403, 404, 429, 500, 502, 503, 504]

interface Props {
  block: ErrorMessageBlock
  message: Message
}

const ErrorBlock: React.FC<Props> = ({ block, message }) => {
  return <MessageErrorInfo block={block} message={message} />
}

const ErrorMessage: React.FC<{ block: ErrorMessageBlock }> = ({ block }) => {
  const { t, i18n } = useTranslation()

  const i18nKey = `error.${block.error?.i18nKey}`
  const errorKey = `error.${block.error?.message}`
  const errorStatus = block.error?.status

  if (i18n.exists(i18nKey)) {
    const providerId = block.error?.providerId
    if (providerId) {
      return (
        <Trans
          i18nKey={i18nKey}
          values={{ provider: getProviderLabel(providerId) }}
          components={{
            provider: (
              <Link
                style={{ color: 'var(--color-link)' }}
                to={`/settings/provider`}
                state={{ provider: getProviderById(providerId) }}
              />
            )
          }}
        />
      )
    }
  }

  if (i18n.exists(errorKey)) {
    return t(errorKey)
  }

  if (HTTP_ERROR_CODES.includes(errorStatus)) {
    return (
      <h5>
        {getHttpMessageLabel(errorStatus)} {block.error?.message}
      </h5>
    )
  }

  return block.error?.message || ''
}

const MessageErrorInfo: React.FC<{ block: ErrorMessageBlock; message: Message }> = ({ block, message }) => {
  const dispatch = useAppDispatch()
  const { setTimeoutTimer } = useTimer()
  const [showDetailModal, setShowDetailModal] = useState(false)
  const { t } = useTranslation()

  const onRemoveBlock = () => {
    setTimeoutTimer('onRemoveBlock', () => dispatch(removeBlocksThunk(message.topicId, message.id, [block.id])), 350)
  }

  const showErrorDetail = () => {
    setShowDetailModal(true)
  }

  const getAlertMessage = () => {
    if (block.error && HTTP_ERROR_CODES.includes(block.error?.status)) {
      return block.error.message
    }
    return null
  }

  const getAlertDescription = () => {
    if (block.error && HTTP_ERROR_CODES.includes(block.error?.status)) {
      return getHttpMessageLabel(block.error.status)
    }
    return <ErrorMessage block={block} />
  }

  return (
    <>
      <Alert
        message={getAlertMessage()}
        description={getAlertDescription()}
        type="error"
        closable
        onClose={onRemoveBlock}
        onClick={showErrorDetail}
        style={{ cursor: 'pointer' }}
        action={
          <Button
            size="small"
            type="text"
            onClick={(e) => {
              e.stopPropagation()
              showErrorDetail()
            }}>
            {t('common.detail')}
          </Button>
        }
      />
      <ErrorDetailModal open={showDetailModal} onClose={() => setShowDetailModal(false)} error={block.error} />
    </>
  )
}

interface ErrorDetailModalProps {
  open: boolean
  onClose: () => void
  error?: Record<string, any>
}

const ErrorDetailModal: React.FC<ErrorDetailModalProps> = ({ open, onClose, error }) => {
  const { t } = useTranslation()

  const copyErrorDetails = () => {
    if (!error) return

    const errorText = `
${t('error.message')}: ${error.message || 'N/A'}
${t('error.requestUrl')}: ${error.url || 'N/A'}
${t('error.requestBody')}: ${error.requestBody ? JSON.stringify(error.requestBody, null, 2) : 'N/A'}
${t('error.stack')}: ${error.stack || 'N/A'}
    `.trim()

    navigator.clipboard.writeText(errorText)
  }

  const renderErrorDetails = (error: any) => {
    if (!error) return <div>{t('error.unknown')}</div>

    return (
      <ErrorDetailList>
        {error.message && (
          <ErrorDetailItem>
            <ErrorDetailLabel>{t('error.message')}:</ErrorDetailLabel>
            <ErrorDetailValue>{error.message}</ErrorDetailValue>
          </ErrorDetailItem>
        )}

        {error.url && (
          <ErrorDetailItem>
            <ErrorDetailLabel>{t('error.requestUrl')}:</ErrorDetailLabel>
            <ErrorDetailValue>{error.url}</ErrorDetailValue>
          </ErrorDetailItem>
        )}

        {error.requestBody && (
          <ErrorDetailItem>
            <ErrorDetailLabel>{t('error.requestBody')}:</ErrorDetailLabel>
            <CodeViewer
              className="source-view"
              language="json"
              expanded={true}
              // unwrapped={true}
            >
              {JSON.stringify(error.requestBody, null, 2)}
            </CodeViewer>
          </ErrorDetailItem>
        )}

        {error.stack && (
          <ErrorDetailItem>
            <ErrorDetailLabel>{t('error.stack')}:</ErrorDetailLabel>
            <StackTrace>
              <pre>{error.stack}</pre>
            </StackTrace>
          </ErrorDetailItem>
        )}
      </ErrorDetailList>
    )
  }

  return (
    <Modal
      centered
      title={t('error.detail')}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="copy" onClick={copyErrorDetails}>
          {t('common.copy')}
        </Button>,
        <Button key="close" onClick={onClose}>
          {t('common.close')}
        </Button>
      ]}
      width={600}>
      <ErrorDetailContainer>{renderErrorDetails(error)}</ErrorDetailContainer>
    </Modal>
  )
}

const ErrorDetailContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
`

const ErrorDetailList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const ErrorDetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ErrorDetailLabel = styled.div`
  font-weight: 600;
  color: var(--color-text);
  font-size: 14px;
`

const ErrorDetailValue = styled.div`
  font-family: var(--code-font-family);
  font-size: 12px;
  padding: 8px;
  background: var(--color-code-background);
  border-radius: 4px;
  border: 1px solid var(--color-border);
  word-break: break-word;
  color: var(--color-text);
`

const StackTrace = styled.div`
  background: var(--color-background-soft);
  border: 1px solid var(--color-error);
  border-radius: 6px;
  padding: 12px;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--code-font-family);
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-error);
  }
`

const Alert = styled(AntdAlert)`
  margin: 0.5rem 0 !important;
  padding: 10px;
  font-size: 12px;
  & .ant-alert-close-icon {
    margin: 5px;
  }
`

export default React.memo(ErrorBlock)
