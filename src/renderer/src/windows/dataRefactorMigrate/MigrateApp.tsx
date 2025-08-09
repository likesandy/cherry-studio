import { AppLogo } from '@renderer/config/env'
import { IpcChannel } from '@shared/IpcChannel'
import { Alert, Button, Card, Progress, Space, Steps, Typography } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

const { Title, Text } = Typography

interface MigrationProgress {
  stage: string
  progress: number
  total: number
  message: string
}

const MigrateApp: React.FC = () => {
  const [progress, setProgress] = useState<MigrationProgress>({
    stage: 'idle',
    progress: 0,
    total: 100,
    message: '准备开始迁移...'
  })
  const [showBackupRequired, setShowBackupRequired] = useState(false)

  useEffect(() => {
    // Listen for progress updates
    const handleProgress = (_: any, progressData: MigrationProgress) => {
      setProgress(progressData)
    }

    // Listen for backup requirement
    const handleBackupRequired = () => {
      setShowBackupRequired(true)
    }

    window.electron.ipcRenderer.on(IpcChannel.DataMigrateProgress, handleProgress)
    window.electron.ipcRenderer.on(IpcChannel.DataMigrate_RequireBackup, handleBackupRequired)

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
      window.electron.ipcRenderer.removeAllListeners(IpcChannel.DataMigrate_RequireBackup)
    }
  }, [])

  const currentStep = useMemo(() => {
    switch (progress.stage) {
      case 'idle':
        return 0
      case 'backup':
        return 1
      case 'migration':
        return 2
      case 'completed':
        return 4
      case 'error':
      case 'cancelled':
        return 3
      default:
        return 0
    }
  }, [progress.stage])

  const stepStatus = useMemo(() => {
    if (progress.stage === 'error' || progress.stage === 'cancelled') {
      return 'error'
    }
    return 'process'
  }, [progress.stage])

  const handleStartMigration = () => {
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_StartFlow)
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
    setShowBackupRequired(false)
    // Notify the main process that backup is completed
    window.electron.ipcRenderer.invoke(IpcChannel.DataMigrate_BackupCompleted)
  }

  const getProgressColor = () => {
    switch (progress.stage) {
      case 'completed':
        return '#52c41a'
      case 'error':
      case 'cancelled':
        return '#ff4d4f'
      default:
        return '#1890ff'
    }
  }

  const renderActionButtons = () => {
    switch (progress.stage) {
      case 'idle':
        return (
          <Button type="primary" onClick={handleStartMigration}>
            开始迁移
          </Button>
        )
      case 'completed':
        return (
          <Button type="primary" onClick={handleRestartApp}>
            重启应用
          </Button>
        )
      case 'error':
      case 'cancelled':
        return (
          <Space>
            <Button onClick={handleCloseWindow}>关闭</Button>
          </Space>
        )
      case 'backup':
      case 'migration':
        return (
          <Button onClick={handleCancel} disabled={progress.stage === 'backup'}>
            取消迁移
          </Button>
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
            <Title level={3} style={{ margin: 0 }}>
              Cherry Studio Data Migration
            </Title>
          </div>
        }
        bordered={false}>
        <LogoContainer>
          <img src={AppLogo} alt="Cherry Studio" />
        </LogoContainer>

        <div style={{ margin: '24px 0' }}>
          <Steps
            current={currentStep}
            status={stepStatus}
            items={[{ title: '开始' }, { title: '备份' }, { title: '迁移' }, { title: '完成' }]}
          />
        </div>

        {progress.stage !== 'idle' && (
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

        {progress.stage === 'error' && (
          <Alert
            message="Migration Error"
            description="The migration process encountered an error. You can try again or restore from a backup using an older version."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {progress.stage === 'completed' && (
          <Alert
            message="Migration Successful"
            description="Your data has been successfully migrated to the new format. Cherry Studio will now start with your updated data."
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {showBackupRequired && (
          <Alert
            message="Backup Required"
            description="A backup is required before migration can proceed. Please create a backup of your data to ensure safety."
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
            action={
              <Space>
                <Button size="small" onClick={handleShowBackupDialog}>
                  Create Backup
                </Button>
                <Button size="small" type="link" onClick={handleBackupCompleted}>
                  I've Already Created a Backup
                </Button>
              </Space>
            }
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`

const MigrationCard = styled(Card)`
  width: 100%;
  max-width: 500px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

  .ant-card-head {
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
  }

  .ant-card-body {
    padding: 32px 24px;
  }
`

const LogoContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 24px;

  img {
    width: 64px;
    height: 64px;
    border-radius: 8px;
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
