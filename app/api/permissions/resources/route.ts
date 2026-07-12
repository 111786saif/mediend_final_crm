import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

interface ResourceNode {
  id: string
  key: string
  label: string
  type: string
  parentId: string | null
  sortOrder: number
  isActive: boolean
  children: ResourceNode[]
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    // Gate access: only IT / admin level users can manage / read full resource metadata tree
    if (!hasPermission(user, 'it:permissions') && user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // Group resources by parentId to build hierarchical tree structure
    const nodesMap = new Map<string, ResourceNode>()
    const roots: ResourceNode[] = []

    for (const res of resources) {
      nodesMap.set(res.id, {
        id: res.id,
        key: res.key,
        label: res.label,
        type: res.type,
        parentId: res.parentId,
        sortOrder: res.sortOrder,
        isActive: res.isActive,
        children: [],
      })
    }

    for (const node of nodesMap.values()) {
      if (node.parentId) {
        const parentNode = nodesMap.get(node.parentId)
        if (parentNode) {
          parentNode.children.push(node)
        } else {
          // If parent is not active/missing, treat as root fallback
          roots.push(node)
        }
      } else {
        roots.push(node)
      }
    }

    // Sort children at each level
    const sortChildren = (nodes: ResourceNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder)
      for (const n of nodes) {
        if (n.children.length > 0) {
          sortChildren(n.children)
        }
      }
    }
    sortChildren(roots)

    return successResponse(roots)
  } catch (error) {
    console.error('Error fetching resource tree:', error)
    return errorResponse('Failed to fetch resource tree', 500)
  }
}
