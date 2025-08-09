import { CheckCircleOutlined, ExclamationCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { IpcChannel } from '@shared/IpcChannel'
import { Alert, Button, Card, Progress, Space, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'

const { Title, Text } = Typography

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
  }
`

const StageIndicator = styled.div<{ stage: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;

  .stage-icon {
    font-size: 20px;
    color: ${(props) => {
      switch (props.stage) {
        case 'completed':
          return '#52c41a'
        case 'error':
          return '#ff4d4f'
        default:
          return '#1890ff'
      }
    }};
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
    message: 'Initializing migration...'
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

  const getStageTitle = () => {
    switch (progress.stage) {
      case 'backup':
        return 'Creating Backup'
      case 'migration':
        return 'Migrating Data'
      case 'completed':
        return 'Migration Completed'
      case 'error':
        return 'Migration Failed'
      case 'cancelled':
        return 'Migration Cancelled'
      default:
        return 'Preparing Migration'
    }
  }

  const getStageIcon = () => {
    switch (progress.stage) {
      case 'completed':
        return <CheckCircleOutlined className="stage-icon" />
      case 'error':
      case 'cancelled':
        return <ExclamationCircleOutlined className="stage-icon" />
      default:
        return <LoadingOutlined className="stage-icon" />
    }
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

  const showCancelButton = () => {
    return progress.stage !== 'completed' && progress.stage !== 'error' && progress.stage !== 'cancelled'
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
          <img
            src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Im0xMiAyIDMgN2g3bC01LjUgNEwxOSAyMGwtNy02LTcgNiAyLjUtN0w2IDloN2wzLTd6Ii8+Cjwvc3ZnPgo8L3N2Zz4K"
            alt="Cherry Studio"
          />
        </LogoContainer>

        <StageIndicator stage={progress.stage}>
          {getStageIcon()}
          <Title level={4} style={{ margin: 0 }}>
            {getStageTitle()}
          </Title>
        </StageIndicator>

        <ProgressContainer>
          <Progress
            percent={progress.progress}
            strokeColor={getProgressColor()}
            trailColor="#f0f0f0"
            size="default"
            showInfo={true}
          />
        </ProgressContainer>

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

        {showCancelButton() && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Space>
              <Button onClick={handleCancel} disabled={progress.stage === 'backup'}>
                Cancel Migration
              </Button>
            </Space>
          </div>
        )}
      </MigrationCard>
    </Container>
  )
}

export default MigrateApp
