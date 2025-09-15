# UI 组件库迁移状态

## 使用示例

```typescript
// 从 @cherrystudio/ui 导入组件
import { Spinner, DividerWithText, InfoTooltip } from '@cherrystudio/ui'

// 在组件中使用
function MyComponent() {
  return (
    <div>
      <Spinner size={24} />
      <DividerWithText text="分隔文本" />
      <InfoTooltip content="提示信息" />
    </div>
  )
}
```

## 目录结构说明

```
@packages/ui/
├── src/
│   ├── components/         # 组件主目录
│   │   ├── base/           # 基础组件（按钮、输入框、标签等）
│   │   ├── display/        # 显示组件（卡片、列表、表格等）
│   │   ├── layout/         # 布局组件（容器、网格、间距等）
│   │   ├── icons/          # 图标组件
│   │   ├── interactive/    # 交互组件（弹窗、提示、下拉等）
│   │   └── composite/      # 复合组件（多个基础组件组合而成）
│   ├── hooks/              # 自定义 React Hooks
│   └── types/              # TypeScript 类型定义
```

### 组件分类指南

提交 PR 时，请根据组件功能将其放入正确的目录：

- **base**: 最基础的 UI 元素，如按钮、输入框、开关、标签等
- **display**: 用于展示内容的组件，如卡片、列表、表格、标签页等
- **layout**: 用于页面布局的组件，如容器、网格系统、分隔符等
- **icons**: 所有图标相关的组件
- **interactive**: 需要用户交互的组件，如模态框、抽屉、提示框、下拉菜单等
- **composite**: 复合组件，由多个基础组件组合而成

## 迁移概览

- **总组件数**: 236
- **已迁移**: 18
- **已重构**: 0
- **待迁移**: 218

## 组件状态表

| 组件名称 | 原路径 | 分类 | 迁移状态 | 重构状态 |
|---------|--------|------|---------|---------|
| CopyButton | src/renderer/src/components/CopyButton.tsx | base | ✅ | ❌ |
| DividerWithText | src/renderer/src/components/DividerWithText.tsx | base | ✅ | ❌ |
| EmojiIcon | src/renderer/src/components/EmojiIcon.tsx | base | ✅ | ❌ |
| IndicatorLight | src/renderer/src/components/IndicatorLight.tsx | base | ✅ | ❌ |
| Spinner | src/renderer/src/components/Spinner.tsx | base | ✅ | ❌ |
| TextBadge | src/renderer/src/components/TextBadge.tsx | base | ✅ | ❌ |
| Ellipsis | src/renderer/src/components/Ellipsis/index.tsx | display | ✅ | ❌ |
| ExpandableText | src/renderer/src/components/ExpandableText.tsx | display | ✅ | ❌ |
| ThinkingEffect | src/renderer/src/components/ThinkingEffect.tsx | display | ✅ | ❌ |
| HorizontalScrollContainer | src/renderer/src/components/HorizontalScrollContainer/index.tsx | layout | ✅ | ❌ |
| Scrollbar | src/renderer/src/components/Scrollbar/index.tsx | layout | ✅ | ❌ |
| VisionIcon | src/renderer/src/components/Icons/VisionIcon.tsx | icons | ✅ | ❌ |
| WebSearchIcon | src/renderer/src/components/Icons/WebSearchIcon.tsx | icons | ✅ | ❌ |
| ToolsCallingIcon | src/renderer/src/components/Icons/ToolsCallingIcon.tsx | icons | ✅ | ❌ |
| FileIcons | src/renderer/src/components/Icons/FileIcons.tsx | icons | ✅ | ❌ |
| SvgSpinners180Ring | src/renderer/src/components/Icons/SvgSpinners180Ring.tsx | icons | ✅ | ❌ |
| ReasoningIcon | src/renderer/src/components/Icons/ReasoningIcon.tsx | icons | ✅ | ❌ |
| InfoTooltip | src/renderer/src/components/TooltipIcons/InfoTooltip.tsx | interactive | ✅ | ❌ |

## 迁移步骤

### 第一阶段：复制迁移（当前阶段）
- 将组件原样复制到 @packages/ui
- 保留原有依赖（antd、styled-components 等）
- 在文件顶部添加原路径注释

### 第二阶段：重构优化
- 移除 antd 依赖，替换为 HeroUI
- 移除 styled-components，替换为 Tailwind CSS
- 优化组件 API 和类型定义

## 注意事项

1. **不迁移**包含以下依赖的组件**(解耦后可迁移)**：
   - window.api 调用
   - Redux（useSelector、useDispatch 等）
   - 其他外部数据源

2. **可迁移**但需要后续解耦的组件：
   - 使用 i18n 的组件（将 i18n 改为 props 传入）
   - 使用 antd 的组件（后续替换为 HeroUI）

3. **提交规范**：
   - 每次 PR 专注于一个类别的组件
   - 确保所有迁移的组件都有导出
   - 更新此文档的迁移状态