import { NotesTreeNode } from '@renderer/types/note'

export function findNode(tree: NotesTreeNode[], nodeId: string): NotesTreeNode | null {
  for (const node of tree) {
    if (node.id === nodeId) {
      return node
    }
    if (node.children) {
      const found = findNode(node.children, nodeId)
      if (found) {
        return found
      }
    }
  }
  return null
}

export function findNodeByPath(tree: NotesTreeNode[], targetPath: string): NotesTreeNode | null {
  for (const node of tree) {
    if (node.treePath === targetPath || node.externalPath === targetPath) {
      return node
    }
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath)
      if (found) {
        return found
      }
    }
  }
  return null
}

export function findParent(tree: NotesTreeNode[], nodeId: string): NotesTreeNode | null {
  for (const node of tree) {
    if (!node.children) {
      continue
    }
    if (node.children.some((child) => child.id === nodeId)) {
      return node
    }
    const found = findParent(node.children, nodeId)
    if (found) {
      return found
    }
  }
  return null
}
