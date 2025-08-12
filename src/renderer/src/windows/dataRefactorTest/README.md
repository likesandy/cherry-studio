# PreferenceService 测试窗口

专用于测试 PreferenceService 和 usePreference hooks 功能的独立测试窗口系统。

## 🎯 当前实现

✅ **已完成的功能**：
- 专用的测试窗口 (DataRefactorTestWindow)
- **双窗口启动**：应用启动时会同时打开主窗口和两个测试窗口
- **跨窗口同步测试**：两个测试窗口可以相互验证偏好设置的实时同步
- 完整的测试界面，包含4个专业测试组件
- 自动窗口定位，避免重叠
- 窗口编号标识，便于区分

## 测试组件

### 1. PreferenceService 基础测试
- 直接测试服务层API：get, set, getCachedValue, isCached, preload, getMultiple
- 支持各种数据类型：字符串、数字、布尔值、JSON对象
- 实时显示操作结果

### 2. usePreference Hook 测试  
- 测试单个偏好设置的React hooks
- 支持的测试键：
  - `app.theme.mode` - 主题模式
  - `app.language` - 语言设置
  - `app.spell_check.enabled` - 拼写检查
  - `app.zoom_factor` - 缩放因子
- 实时值更新和类型转换

### 3. usePreferences 批量操作测试
- 测试多个偏好设置的批量管理
- 4种预设场景：基础设置、UI设置、用户设置、自定义组合
- 批量更新功能，支持JSON格式输入
- 快速切换操作

### 4. Hook 高级功能测试
- 预加载机制测试
- 订阅机制验证
- 缓存管理测试
- 性能测试
- 多个hook实例同步测试

## 启动方式

**自动启动**：应用正常启动时会自动创建两个测试窗口，窗口会自动错位显示避免重叠

**手动启动**：
```javascript
// 在开发者控制台中执行 - 创建单个测试窗口
const { dataRefactorMigrateService } = require('./out/main/data/migrate/dataRefactor/DataRefactorMigrateService')
dataRefactorMigrateService.createTestWindow()

// 创建多个测试窗口
dataRefactorMigrateService.createTestWindow() // 第二个窗口
dataRefactorMigrateService.createTestWindow() // 第三个窗口...

// 关闭所有测试窗口
dataRefactorMigrateService.closeTestWindows()
```

## 文件结构

```
src/renderer/src/windows/dataRefactorTest/
├── entryPoint.tsx                    # 窗口入口
├── TestApp.tsx                       # 主应用组件  
└── components/
    ├── PreferenceServiceTests.tsx    # 服务层测试
    ├── PreferenceBasicTests.tsx      # 基础Hook测试
    ├── PreferenceHookTests.tsx       # 高级Hook测试
    └── PreferenceMultipleTests.tsx   # 批量操作测试
```

## 跨窗口同步测试

🔄 **测试场景**：
1. **实时同步验证**：在窗口#1中修改某个偏好设置，立即观察窗口#2是否同步更新
2. **并发修改测试**：在两个窗口中快速连续修改同一设置，验证数据一致性
3. **批量操作同步**：在一个窗口中批量更新多个设置，观察另一个窗口的同步表现
4. **Hook实例同步**：验证多个usePreference hook实例是否正确同步

📋 **测试步骤**：
1. 同时打开两个测试窗口（自动启动）
2. 选择相同的偏好设置键进行测试
3. 在窗口#1中修改值，观察窗口#2的反应
4. 检查"Hook 高级功能测试"中的订阅触发次数是否增加
5. 验证缓存状态和实时数据的一致性

## 注意事项

⚠️ **所有测试操作都会影响真实的数据库存储！**

- 测试使用真实的偏好设置系统
- 修改的值会同步到主应用和所有测试窗口
- 可以在主应用、测试窗口#1、测试窗口#2之间看到实时同步效果

## 开发模式特性

- 自动打开DevTools便于调试
- 支持热重载
- 完整的TypeScript类型检查
- React DevTools支持

## 💡 快速开始

1. **启动应用** - 自动打开2个测试窗口
2. **选择测试** - 在"usePreference Hook 测试"中选择要测试的偏好设置键
3. **跨窗口验证** - 在窗口#1中修改值，观察窗口#2是否同步
4. **高级测试** - 使用"Hook 高级功能测试"验证订阅和缓存机制
5. **批量测试** - 使用"usePreferences 批量操作测试"进行多项设置测试

## 🔧 技术实现

- **窗口管理**: DataRefactorMigrateService 单例管理多个测试窗口
- **数据同步**: 基于真实的 PreferenceService 和 IPC 通信
- **UI框架**: Ant Design + styled-components + React 18
- **类型安全**: 完整的 TypeScript 类型检查和偏好设置键约束