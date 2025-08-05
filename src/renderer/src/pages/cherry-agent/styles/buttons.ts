import { Button } from 'antd'
import styled from 'styled-components'

export const CollapseButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    color: var(--color-text);
    background-color: var(--color-background-hover);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`

export const ActionButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: none;
  box-shadow: none;

  &:hover {
    color: var(--color-text);
    background-color: var(--color-background-hover);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &:focus {
    box-shadow: none;
    border: none;
  }
`

export const ExpandButton = styled(Button)`
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    color: var(--color-text);
    background-color: var(--color-background-hover);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &:focus {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--color-primary);
  }
`

export const SendButton = styled(Button)`
  height: auto;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.2);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(24, 144, 255, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`
