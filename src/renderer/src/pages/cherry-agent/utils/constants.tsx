import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  SettingOutlined as CogIcon,
  UserOutlined
} from '@ant-design/icons'
import { SessionLogEntity } from '@renderer/types/agent'
import React from 'react'

// Message metadata extractor
export const extractSystemMetadata = (log: SessionLogEntity) => {
  const content = log.content as any
  const metadata: { label: string; value: string; icon?: React.ReactNode }[] = []

  switch (log.type) {
    case 'agent_session_init':
      if (content.system_prompt)
        metadata.push({ label: 'System Prompt', value: content.system_prompt, icon: <CogIcon /> })
      if (content.max_turns)
        metadata.push({ label: 'Max Turns', value: content.max_turns.toString(), icon: <ClockCircleOutlined /> })
      if (content.permission_mode)
        metadata.push({ label: 'Permission', value: content.permission_mode, icon: <UserOutlined /> })
      if (content.cwd) metadata.push({ label: 'Working Directory', value: content.cwd, icon: <InfoCircleOutlined /> })
      break
    case 'agent_session_started':
      if (content.session_id)
        metadata.push({ label: 'Claude Session ID', value: content.session_id, icon: <InfoCircleOutlined /> })
      break
    case 'agent_session_result':
      metadata.push({
        label: 'Status',
        value: content.success ? 'Success' : 'Failed',
        icon: content.success ? <InfoCircleOutlined /> : <ExclamationCircleOutlined />
      })
      if (content.num_turns)
        metadata.push({ label: 'Turns', value: content.num_turns.toString(), icon: <ClockCircleOutlined /> })
      if (content.duration_ms)
        metadata.push({
          label: 'Duration',
          value: `${(content.duration_ms / 1000).toFixed(1)}s`,
          icon: <ClockCircleOutlined />
        })
      if (content.total_cost_usd)
        metadata.push({ label: 'Cost', value: `$${content.total_cost_usd.toFixed(4)}`, icon: <InfoCircleOutlined /> })
      break
    case 'agent_error':
      if (content.error_message)
        metadata.push({ label: 'Error', value: content.error_message, icon: <ExclamationCircleOutlined /> })
      if (content.error_type)
        metadata.push({ label: 'Type', value: content.error_type, icon: <ExclamationCircleOutlined /> })
      break
  }

  return metadata
}

// Helper function to get session metrics from logs
export const getSessionMetrics = (logs: SessionLogEntity[]) => {
  const metrics = {
    duration: null as string | null,
    cost: null as string | null,
    turns: null as number | null,
    hasError: false
  }

  logs.forEach((log) => {
    if (log.type === 'agent_session_result' && log.content) {
      const content = log.content as any
      if (content.duration_ms) {
        metrics.duration = `${(content.duration_ms / 1000).toFixed(1)}s`
      }
      if (content.total_cost_usd) {
        metrics.cost = `$${content.total_cost_usd.toFixed(4)}`
      }
      if (content.num_turns) {
        metrics.turns = content.num_turns
      }
    }
    if (log.type === 'agent_error') {
      metrics.hasError = true
    }
  })

  return metrics
}
