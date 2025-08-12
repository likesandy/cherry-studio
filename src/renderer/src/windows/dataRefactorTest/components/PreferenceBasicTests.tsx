import { usePreference } from '@renderer/data/hooks/usePreference'
import type { PreferenceKeyType } from '@shared/data/types'
import { Button, Input, message, Select, Space, Switch, Typography } from 'antd'
import React, { useState } from 'react'
import styled from 'styled-components'

const { Text } = Typography
const { Option } = Select

/**
 * Basic usePreference hook testing component
 * Tests single preference management with React hooks
 */
const PreferenceBasicTests: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState<PreferenceKeyType>('app.theme.mode')

  // Use the hook with the selected key
  const [value, setValue] = usePreference(selectedKey)

  const [inputValue, setInputValue] = useState<string>('')

  const handleSetValue = async () => {
    try {
      let parsedValue: any = inputValue

      // Try to parse as JSON if it looks like an object/array/boolean/number
      if (
        inputValue.startsWith('{') ||
        inputValue.startsWith('[') ||
        inputValue === 'true' ||
        inputValue === 'false' ||
        !isNaN(Number(inputValue))
      ) {
        try {
          parsedValue = JSON.parse(inputValue)
        } catch {
          // Keep as string if JSON parsing fails
        }
      }

      await setValue(parsedValue)
      message.success('设置成功')
      setInputValue('')
    } catch (error) {
      message.error(`设置失败: ${(error as Error).message}`)
    }
  }

  const testCases = [
    { key: 'app.theme.mode', label: 'App Theme Mode', sampleValue: 'ThemeMode.dark' },
    { key: 'app.language', label: 'App Language', sampleValue: 'zh-CN' },
    { key: 'app.spell_check.enabled', label: 'Spell Check', sampleValue: 'true' },
    { key: 'app.zoom_factor', label: 'Zoom Factor', sampleValue: '1.2' },
    { key: 'app.tray.enabled', label: 'Tray Enabled', sampleValue: 'true' }
  ]

  return (
    <TestContainer>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Key Selection */}
        <div>
          <Text strong>选择测试的偏好设置键:</Text>
          <Select
            value={selectedKey}
            onChange={setSelectedKey}
            style={{ width: '100%', marginTop: 4 }}
            placeholder="选择偏好设置键">
            {testCases.map((testCase) => (
              <Option key={testCase.key} value={testCase.key}>
                {testCase.label} ({testCase.key})
              </Option>
            ))}
          </Select>
        </div>

        {/* Current Value Display */}
        <CurrentValueContainer>
          <Text strong>当前值:</Text>
          <ValueDisplay>
            {value !== undefined ? (
              typeof value === 'object' ? (
                JSON.stringify(value, null, 2)
              ) : (
                String(value)
              )
            ) : (
              <Text type="secondary">undefined (未设置或未加载)</Text>
            )}
          </ValueDisplay>
        </CurrentValueContainer>

        {/* Set New Value */}
        <div>
          <Text strong>设置新值:</Text>
          <Space.Compact style={{ width: '100%', marginTop: 4 }}>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入新值 (JSON格式用于对象/数组)"
              onPressEnter={handleSetValue}
            />
            <Button type="primary" onClick={handleSetValue}>
              设置
            </Button>
          </Space.Compact>
        </div>

        {/* Quick Actions */}
        <div>
          <Text strong>快速操作:</Text>
          <Space wrap style={{ marginTop: 8 }}>
            {/* Theme Toggle */}
            {selectedKey === 'app.theme.mode' && (
              <Button
                size="small"
                onClick={() => setValue(value === 'ThemeMode.dark' ? 'ThemeMode.light' : 'ThemeMode.dark')}>
                切换主题 ({value === 'ThemeMode.dark' ? 'light' : 'dark'})
              </Button>
            )}

            {/* Boolean Toggle */}
            {selectedKey === 'app.spell_check.enabled' && (
              <Switch
                checked={value === true}
                onChange={(checked) => setValue(checked)}
                checkedChildren="启用"
                unCheckedChildren="禁用"
              />
            )}

            {/* Language Switch */}
            {selectedKey === 'app.language' && (
              <>
                <Button size="small" onClick={() => setValue('zh-CN')}>
                  中文
                </Button>
                <Button size="small" onClick={() => setValue('en-US')}>
                  English
                </Button>
              </>
            )}

            {/* Zoom Factor */}
            {selectedKey === 'app.zoom_factor' && (
              <>
                <Button size="small" onClick={() => setValue(0.8)}>
                  80%
                </Button>
                <Button size="small" onClick={() => setValue(1.0)}>
                  100%
                </Button>
                <Button size="small" onClick={() => setValue(1.2)}>
                  120%
                </Button>
              </>
            )}

            {/* Sample Values */}
            <Button
              size="small"
              type="dashed"
              onClick={() => {
                const testCase = testCases.find((tc) => tc.key === selectedKey)
                if (testCase) {
                  setInputValue(testCase.sampleValue)
                }
              }}>
              示例值
            </Button>
          </Space>
        </div>

        {/* Hook Status Info */}
        <StatusContainer>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Hook状态: 当前监听 "{selectedKey}", 值类型: {typeof value}, 是否已定义: {value !== undefined ? '是' : '否'}
          </Text>
        </StatusContainer>
      </Space>
    </TestContainer>
  )
}

const TestContainer = styled.div`
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
`

const CurrentValueContainer = styled.div`
  padding: 12px;
  background: #f0f0f0;
  border-radius: 6px;
  border-left: 4px solid var(--color-primary);
`

const ValueDisplay = styled.pre`
  margin: 8px 0 0 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
`

const StatusContainer = styled.div`
  padding: 8px;
  background: #e6f7ff;
  border-radius: 4px;
  border: 1px solid #91d5ff;
`

export default PreferenceBasicTests
