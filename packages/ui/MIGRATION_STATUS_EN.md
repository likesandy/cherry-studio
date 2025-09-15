# UI Component Library Migration Status

## Usage Example

```typescript
// Import components from @cherrystudio/ui
import { Spinner, DividerWithText, InfoTooltip } from '@cherrystudio/ui'

// Use in components
function MyComponent() {
  return (
    <div>
      <Spinner size={24} />
      <DividerWithText text="Divider Text" />
      <InfoTooltip content="Tooltip message" />
    </div>
  )
}
```

## Directory Structure

```
@packages/ui/
├── src/
│   ├── components/         # Main components directory
│   │   ├── base/           # Basic components (buttons, inputs, labels, etc.)
│   │   ├── display/        # Display components (cards, lists, tables, etc.)
│   │   ├── layout/         # Layout components (containers, grids, spacing, etc.)
│   │   ├── icons/          # Icon components
│   │   ├── interactive/    # Interactive components (modals, tooltips, dropdowns, etc.)
│   │   └── composite/      # Composite components (made from multiple base components)
│   ├── hooks/              # Custom React Hooks
│   └── types/              # TypeScript type definitions
```

### Component Classification Guide

When submitting PRs, please place components in the correct directory based on their function:

- **base**: Most basic UI elements like buttons, inputs, switches, labels, etc.
- **display**: Components for displaying content like cards, lists, tables, tabs, etc.
- **layout**: Components for page layout like containers, grid systems, dividers, etc.
- **icons**: All icon-related components
- **interactive**: Components requiring user interaction like modals, drawers, tooltips, dropdowns, etc.
- **composite**: Composite components made from multiple base components

## Migration Overview

- **Total Components**: 236
- **Migrated**: 18
- **Refactored**: 0
- **Pending Migration**: 218

## Component Status Table

| Component Name | Original Path | Category | Migration Status | Refactoring Status |
|---------------|---------------|----------|------------------|-------------------|
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

## Migration Steps

### Phase 1: Copy Migration (Current Phase)

- Copy components as-is to @packages/ui
- Retain original dependencies (antd, styled-components, etc.)
- Add original path comment at file top

### Phase 2: Refactor and Optimize

- Remove antd dependencies, replace with HeroUI
- Remove styled-components, replace with Tailwind CSS
- Optimize component APIs and type definitions

## Notes

1. **Do NOT migrate** components with these dependencies:
   - window.api calls
   - Redux (useSelector, useDispatch, etc.)
   - Other external data sources

2. **Can migrate** but need decoupling later:
   - Components using i18n (change i18n to props)
   - Components using antd (replace with HeroUI later)

3. **Submission Guidelines**:
   - Each PR should focus on one category of components
   - Ensure all migrated components are exported
   - Update migration status in this document