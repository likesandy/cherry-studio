import { CheckCircleOutlined, CloudUploadOutlined, LoadingOutlined, RocketOutlined } from '@ant-design/icons'
import { IpcChannel } from '@shared/IpcChannel'
import { Alert, Button, Card, Progress, Space, Steps, Typography } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

const { Title, Text } = Typography

type MigrationStage =
  | 'introduction' // Introduction phase - user can cancel
  | 'backup_required' // Backup required - show backup requirement
  | 'backup_progress' // Backup in progress - user is backing up
  | 'backup_confirmed' // Backup confirmed - ready to migrate
  | 'migration' // Migration in progress - cannot cancel
  | 'completed' // Completed - restart app
  | 'error' // Error - recovery options

interface MigrationProgress {
  stage: MigrationStage
  progress: number
  total: number
  message: string
  error?: string
}

const MigrateApp: React.FC = () => {
  const [progress, setProgress] = useState<MigrationProgress>({
    stage: 'introduction',
    progress: 0,
    total: 100,
    message: 'Ready to start data migration'
  })

  useEffect(() => {
    // Listen for progress updates
    const handleProgress = (_: any, progressData: MigrationProgress) => {
      setProgress(progressData)
    }

    window.electron.ipcRenderer.on(IpcChannel.DataMigrateProgress, handleProgress)

    // Request initial progress
    window.electron.ipcRenderer
      .invoke(IpcChannel.DataMigrate_GetProgress)
      .then((initialProgress: MigrationProgress) => {
        if (initialProgress) {
          setProgress(initialProgress)
        }
      })

    return () => {
      window.electron.ipcRenderer.removeAllListeners(IpcChannel.DataMigrateProgress)
    }
  }, [])

  const currentStep = useMemo(() => {
    switch (progress.stage) {
      case 'introduction':
        return 0
      case 'backup_required':
      case 'backup_progress':
      case 'backup_confirmed':
        return 1
      case 'migration':
        return 2
      case 'completed':
        return 3
      case 'error':
        return -1 // Error state - will be handled separately
      default:
        return 0
    }
  }, [progress.stage])

  const stepStatus = useMemo(() => {
    if (progress.stage === 'error') {
      return 'error'
    }
    return 'process'
  }, [progress.stage])

  const handleProceedToBackup = () => {
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_ProceedToBackup)
  }

  const handleStartMigration = () => {
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_StartMigration)
  }

  const handleRestartApp = () => {
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_RestartApp)
  }

  const handleCloseWindow = () => {
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_CloseWindow)
  }

  const handleCancel = () => {
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_Cancel)
  }

  const handleShowBackupDialog = () => {
    // Open the main window backup dialog
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_ShowBackupDialog)
  }

  const handleBackupCompleted = () => {
    // Notify the main process that backup is completed
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_BackupCompleted)
  }

  const handleRetryMigration = () => {
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_RetryMigration)
  }

  const getProgressColor = () => {
    switch (progress.stage) {
      case 'completed':
        return '#52c41a'
      case 'error':
        return '#ff4d4f'
      case 'backup_confirmed':
        return '#52c41a'
      default:
        return '#1890ff'
    }
  }

  const getCurrentStepIcon = () => {
    switch (progress.stage) {
      case 'introduction':
        return <RocketOutlined style={{ fontSize: 64, color: '#1890ff', margin: '24px 0' }} />
      case 'backup_required':
      case 'backup_progress':
        return <CloudUploadOutlined style={{ fontSize: 64, color: '#faad14', margin: '24px 0' }} />
      case 'backup_confirmed':
        return <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', margin: '24px 0' }} />
      case 'migration':
        return <LoadingOutlined style={{ fontSize: 64, color: '#1890ff', margin: '24px 0' }} />
      case 'completed':
        return <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', margin: '24px 0' }} />
      case 'error':
        return <div style={{ fontSize: 64, color: '#ff4d4f', margin: '24px 0' }}>⚠️</div>
      default:
        return <RocketOutlined style={{ fontSize: 64, color: '#1890ff', margin: '24px 0' }} />
    }
  }

  const renderActionButtons = () => {
    switch (progress.stage) {
      case 'introduction':
        return (
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" onClick={handleProceedToBackup}>
              开始迁移
            </Button>
          </Space>
        )
      case 'backup_required':
        return (
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" onClick={handleShowBackupDialog}>
              创建备份
            </Button>
            <Button onClick={handleBackupCompleted}>我已完成备份</Button>
          </Space>
        )
      case 'backup_confirmed':
        return (
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" onClick={handleStartMigration}>
              开始迁移
            </Button>
          </Space>
        )
      case 'migration':
        return <Button disabled>迁移进行中...</Button>
      case 'completed':
        return (
          <Button type="primary" onClick={handleRestartApp}>
            重启应用
          </Button>
        )
      case 'error':
        return (
          <Space>
            <Button onClick={handleCloseWindow}>关闭应用</Button>
            <Button type="primary" onClick={handleRetryMigration}>
              重新尝试
            </Button>
          </Space>
        )
      default:
        return null
    }
  }

  return (
    <Container>
      <MigrationCard
        title={
          <div style={{ textAlign: 'center' }}>
            <Title level={4} style={{ margin: 0, fontWeight: 'normal' }}>
              数据迁移向导
            </Title>
          </div>
        }
        bordered={false}>
        <div style={{ margin: '16px 0 32px 0' }}>
          <Steps
            current={currentStep}
            status={stepStatus}
            size="small"
            items={[{ title: '介绍' }, { title: '备份' }, { title: '迁移' }, { title: '完成' }]}
          />
        </div>

        <div style={{ textAlign: 'center' }}>{getCurrentStepIcon()}</div>

        {progress.stage !== 'introduction' && progress.stage !== 'error' && (
          <ProgressContainer>
            <Progress
              percent={progress.progress}
              strokeColor={getProgressColor()}
              trailColor="#f0f0f0"
              size="default"
              showInfo={true}
            />
          </ProgressContainer>
        )}

        <MessageContainer>
          <Text type="secondary">{progress.message}</Text>
        </MessageContainer>

        {progress.stage === 'introduction' && (
          <Alert
            message="数据迁移向导"
            description="本次更新将数据迁移到更高效的存储格式，迁移前会创建完整备份确保数据安全。"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {progress.stage === 'backup_required' && (
          <Alert
            message="创建数据备份"
            description="迁移前必须创建数据备份以确保数据安全。请选择备份位置或确认已有最新备份。"
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {progress.stage === 'backup_confirmed' && (
          <Alert
            message="备份完成"
            description="数据备份已完成，现在可以安全地开始迁移。"
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {progress.stage === 'error' && (
          <Alert
            message="迁移失败"
            description={progress.error || '迁移过程遇到错误，您可以重新尝试或继续使用之前版本（原始数据完好保存）。'}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {progress.stage === 'completed' && (
          <Alert
            message="迁移完成"
            description="数据已成功迁移到新格式，应用将重新启动以应用更改。"
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>{renderActionButtons()}</div>
      </MigrationCard>
    </Container>
  )
}

const Container = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #f5f5f5;
  padding: 20px;
`

const MigrationCard = styled(Card)`
  width: 100%;
  max-width: 600px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);

  .ant-card-head {
    background: #fff;
    border-bottom: 1px solid #f0f0f0;
  }

  .ant-card-body {
    padding: 24px 32px 32px 32px;
  }
`

const ProgressContainer = styled.div`
  margin: 24px 0;
`

const MessageContainer = styled.div`
  text-align: center;
  margin: 16px 0;
  min-height: 24px;
`

export default MigrateApp
