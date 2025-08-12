import { AppLogo } from '@renderer/config/env'
import { loggerService } from '@renderer/services/LoggerService'
import { Button, Card, Col, Divider, Layout, Row, Space, Typography } from 'antd'
import { Database, FlaskConical, Settings, TestTube } from 'lucide-react'
import React from 'react'
import styled from 'styled-components'

import PreferenceBasicTests from './components/PreferenceBasicTests'
import PreferenceHookTests from './components/PreferenceHookTests'
import PreferenceMultipleTests from './components/PreferenceMultipleTests'
import PreferenceServiceTests from './components/PreferenceServiceTests'

const { Header, Content } = Layout
const { Title, Text } = Typography

const logger = loggerService.withContext('TestApp')

const TestApp: React.FC = () => {
  // Get window title to determine window number
  const windowTitle = document.title
  const windowMatch = windowTitle.match(/#(\d+)/)
  const windowNumber = windowMatch ? windowMatch[1] : '1'

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px' }}>
        <HeaderContent>
          <Space align="center">
            <img src={AppLogo} alt="Logo" style={{ width: 28, height: 28, borderRadius: 6 }} />
            <Title level={4} style={{ margin: 0, color: 'var(--color-primary)' }}>
              Test Window #{windowNumber}
            </Title>
          </Space>
          <Space>
            <FlaskConical size={20} color="var(--color-primary)" />
            <Text type="secondary">Cross-Window Sync Testing</Text>
          </Space>
        </HeaderContent>
      </Header>

      <Content style={{ padding: '24px', overflow: 'auto' }}>
        <Container>
          <Row gutter={[24, 24]}>
            {/* Introduction Card */}
            <Col span={24}>
              <Card>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Space align="center">
                    <TestTube size={24} color="var(--color-primary)" />
                    <Title level={3} style={{ margin: 0 }}>
                      PreferenceService 功能测试 (窗口 #{windowNumber})
                    </Title>
                  </Space>
                  <Text type="secondary">
                    此测试窗口用于验证 PreferenceService 和 usePreference hooks
                    的各项功能，包括单个偏好设置的读写、多个偏好设置的批量操作、跨窗口数据同步等。
                  </Text>
                  <Text type="secondary">测试使用的都是真实的偏好设置系统，所有操作都会影响实际的数据库存储。</Text>
                  <Text type="secondary" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                    📋 跨窗口测试指南：在一个窗口中修改偏好设置，观察其他窗口是否实时同步更新。
                  </Text>
                </Space>
              </Card>
            </Col>

            {/* PreferenceService Basic Tests */}
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <Database size={18} />
                    <span>PreferenceService 基础测试</span>
                  </Space>
                }
                size="small">
                <PreferenceServiceTests />
              </Card>
            </Col>

            {/* Basic Hook Tests */}
            <Col span={12}>
              <Card
                title={
                  <Space>
                    <Settings size={18} />
                    <span>usePreference Hook 测试</span>
                  </Space>
                }
                size="small">
                <PreferenceBasicTests />
              </Card>
            </Col>

            {/* Hook Tests */}
            <Col span={12}>
              <Card
                title={
                  <Space>
                    <Settings size={18} />
                    <span>Hook 高级功能测试</span>
                  </Space>
                }
                size="small">
                <PreferenceHookTests />
              </Card>
            </Col>

            {/* Multiple Preferences Tests */}
            <Col span={24}>
              <Card
                title={
                  <Space>
                    <Database size={18} />
                    <span>usePreferences 批量操作测试</span>
                  </Space>
                }
                size="small">
                <PreferenceMultipleTests />
              </Card>
            </Col>
          </Row>

          <Divider />

          <Row justify="center">
            <Button
              type="primary"
              onClick={() => {
                logger.info('Closing test window')
                window.close()
              }}>
              关闭测试窗口
            </Button>
          </Row>
        </Container>
      </Content>
    </Layout>
  )
}

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
`

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`

export default TestApp
