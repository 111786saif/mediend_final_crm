'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch } from '@/lib/api-client'
import {
  Plus,
  Pencil,
  Search,
  Grid3x3,
  TableIcon,
  Package,
  MapPin,
  ShoppingCart,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Warehouse,
  Boxes,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'
import type {
  ItemMaster,
  LocationMaster,
  PurchaseTransaction,
  IssueTransaction,
  ItemsResponse,
  LocationsResponse,
  PurchasesResponse,
  IssuesResponse,
} from '@/lib/finance/inventory-types'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function InventoryContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabParam || 'items')

  useEffect(() => {
    if (tabParam && ['items', 'locations', 'purchases', 'issues'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])
  const [itemViewMode, setItemViewMode] = useState<'table' | 'grid'>('table')
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [stockAlertFilter, setStockAlertFilter] = useState<string>('all')

  // Item Master State
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null)
  const [itemFormData, setItemFormData] = useState({
    name: '',
    price: '',
    unit: '',
    supplierId: '',
    locationId: '',
    minimumStockLevel: '',
    maximumStockLevel: '',
    description: '',
  })

  // Location Master State
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationMaster | null>(null)
  const [locationFormData, setLocationFormData] = useState({
    name: '',
    code: '',
    type: 'WAREHOUSE' as 'WAREHOUSE' | 'SUB_WAREHOUSE',
    parentId: '',
    description: '',
  })

  // Purchase Transaction State
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)
  const [purchaseFormData, setPurchaseFormData] = useState({
    itemId: '',
    supplierId: '',
    locationId: '',
    quantity: '',
    unitPrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    description: '',
  })

  // Issue Transaction State
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false)
  const [issueFormData, setIssueFormData] = useState({
    itemId: '',
    locationId: '',
    quantity: '',
    issuedToId: '',
    issueDate: new Date().toISOString().split('T')[0],
    description: '',
  })

  // Fetch Items
  const { data: itemsData, isLoading: itemsLoading } = useQuery<ItemsResponse>({
    queryKey: ['inventory-items', search, locationFilter, supplierFilter, stockAlertFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (locationFilter !== 'all') params.set('locationId', locationFilter)
      if (supplierFilter !== 'all') params.set('supplierId', supplierFilter)
      params.set('isActive', 'true')
      params.set('includeStock', 'true')
      return apiGet<ItemsResponse>(`/api/finance/inventory/items?${params.toString()}`)
    },
  })

  // Fetch Locations
  const { data: locationsData } = useQuery<LocationsResponse>({
    queryKey: ['inventory-locations'],
    queryFn: () => apiGet<LocationsResponse>('/api/finance/inventory/locations?isActive=true&includeChildren=true'),
  })

  // Fetch Purchases
  const { data: purchasesData } = useQuery<PurchasesResponse>({
    queryKey: ['inventory-purchases'],
    queryFn: () => apiGet<PurchasesResponse>('/api/finance/inventory/purchases?limit=100'),
    enabled: activeTab === 'purchases',
  })

  // Fetch Issues
  const { data: issuesData } = useQuery<IssuesResponse>({
    queryKey: ['inventory-issues'],
    queryFn: () => apiGet<IssuesResponse>('/api/finance/inventory/issues?limit=100'),
    enabled: activeTab === 'issues',
  })

  // Fetch Suppliers (SUPPLIER type parties)
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiGet<{ data: Array<{ id: string; name: string }> }>('/api/finance/parties?partyType=SUPPLIER&isActive=true&limit=100'),
  })

  // Fetch Users (for issue transactions)
  const { data: usersData } = useQuery<Array<{ id: string; name: string; email: string }>>({
    queryKey: ['users-list'],
    queryFn: () => apiGet<Array<{ id: string; name: string; email: string }>>('/api/users'),
    enabled: activeTab === 'issues',
  })

  // Calculate dashboard stats
  const totalItems = itemsData?.data.length || 0
  const lowStockItems = itemsData?.data.filter((item) => {
    const stock = item.currentStock || 0
    return stock < item.minimumStockLevel
  }).length || 0
  const totalStockValue = itemsData?.data.reduce((sum, item) => {
    return sum + (item.currentStock || 0) * item.price
  }, 0) || 0

  // Item mutations
  const createItemMutation = useMutation({
    mutationFn: (data: Omit<typeof itemFormData, 'price' | 'minimumStockLevel' | 'maximumStockLevel'> & {
      price: number
      minimumStockLevel: number
      maximumStockLevel: number
    }) => apiPost('/api/finance/inventory/items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      setIsItemDialogOpen(false)
      resetItemForm()
      toast.success('Item created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create item')
    },
  })

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { 
      id: string
      data: Partial<Omit<typeof itemFormData, 'price' | 'minimumStockLevel' | 'maximumStockLevel'>> & {
        price?: number
        minimumStockLevel?: number
        maximumStockLevel?: number
      }
    }) =>
      apiPatch(`/api/finance/inventory/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      setIsItemDialogOpen(false)
      setEditingItem(null)
      resetItemForm()
      toast.success('Item updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update item')
    },
  })

  // Location mutations
  const createLocationMutation = useMutation({
    mutationFn: (data: typeof locationFormData) => apiPost('/api/finance/inventory/locations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-locations'] })
      setIsLocationDialogOpen(false)
      resetLocationForm()
      toast.success('Location created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create location')
    },
  })

  const updateLocationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof locationFormData> }) =>
      apiPatch(`/api/finance/inventory/locations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-locations'] })
      setIsLocationDialogOpen(false)
      setEditingLocation(null)
      resetLocationForm()
      toast.success('Location updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update location')
    },
  })

  // Purchase mutation
  const createPurchaseMutation = useMutation({
    mutationFn: (data: Omit<typeof purchaseFormData, 'quantity' | 'unitPrice'> & {
      quantity: number
      unitPrice: number
    }) => apiPost('/api/finance/inventory/purchases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-purchases', 'inventory-items'] })
      setIsPurchaseDialogOpen(false)
      resetPurchaseForm()
      toast.success('Purchase created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create purchase')
    },
  })

  // Issue mutation
  const createIssueMutation = useMutation({
    mutationFn: (data: Omit<typeof issueFormData, 'quantity'> & {
      quantity: number
    }) => apiPost('/api/finance/inventory/issues', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-issues', 'inventory-items'] })
      setIsIssueDialogOpen(false)
      resetIssueForm()
      toast.success('Issue created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create issue')
    },
  })

  const resetItemForm = () => {
    setItemFormData({
      name: '',
      price: '',
      unit: '',
      supplierId: '',
      locationId: '',
      minimumStockLevel: '',
      maximumStockLevel: '',
      description: '',
    })
    setEditingItem(null)
  }

  const resetLocationForm = () => {
    setLocationFormData({
      name: '',
      code: '',
      type: 'WAREHOUSE',
      parentId: '',
      description: '',
    })
    setEditingLocation(null)
  }

  const resetPurchaseForm = () => {
    setPurchaseFormData({
      itemId: '',
      supplierId: '',
      locationId: '',
      quantity: '',
      unitPrice: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      description: '',
    })
  }

  const resetIssueForm = () => {
    setIssueFormData({
      itemId: '',
      locationId: '',
      quantity: '',
      issuedToId: '',
      issueDate: new Date().toISOString().split('T')[0],
      description: '',
    })
  }

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...itemFormData,
      price: parseFloat(itemFormData.price),
      minimumStockLevel: parseFloat(itemFormData.minimumStockLevel) || 0,
      maximumStockLevel: parseFloat(itemFormData.maximumStockLevel) || 0,
    }

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data })
    } else {
      createItemMutation.mutate(data)
    }
  }

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: typeof locationFormData = {
      ...locationFormData,
      parentId: locationFormData.type === 'SUB_WAREHOUSE' ? locationFormData.parentId : '',
    }

    if (editingLocation) {
      updateLocationMutation.mutate({ id: editingLocation.id, data })
    } else {
      createLocationMutation.mutate(data)
    }
  }

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...purchaseFormData,
      quantity: parseFloat(purchaseFormData.quantity),
      unitPrice: parseFloat(purchaseFormData.unitPrice),
    }
    createPurchaseMutation.mutate(data)
  }

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...issueFormData,
      quantity: parseFloat(issueFormData.quantity),
    }
    createIssueMutation.mutate(data)
  }

  const getStockStatus = (item: ItemMaster) => {
    const stock = item.currentStock || 0
    if (stock < item.minimumStockLevel) return { status: 'LOW', color: 'text-red-600', bg: 'bg-red-50' }
    if (stock > item.maximumStockLevel) return { status: 'HIGH', color: 'text-yellow-600', bg: 'bg-yellow-50' }
    return { status: 'NORMAL', color: 'text-green-600', bg: 'bg-green-50' }
  }

  // Filter items by stock alert
  const filteredItems = itemsData?.data.filter((item) => {
    if (stockAlertFilter === 'all') return true
    const stockStatus = getStockStatus(item)
    return stockStatus.status === stockAlertFilter.toUpperCase()
  }) || []

  // Build location tree
  const buildLocationTree = (locations: LocationMaster[]): LocationMaster[] => {
    const locationMap = new Map(locations.map((loc) => [loc.id, loc]))
    const rootLocations: LocationMaster[] = []

    locations.forEach((location) => {
      if (!location.parentId) {
        rootLocations.push(location)
      }
    })

    return rootLocations
  }

  const locationTree = locationsData?.data ? buildLocationTree(locationsData.data) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Manage items, locations, purchases, and issues</p>
        </div>
      </div>

      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
              <Package className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl font-bold text-red-600">{lowStockItems}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Stock Value</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalStockValue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Locations</p>
                <p className="text-2xl font-bold">{locationsData?.data.length || 0}</p>
              </div>
              <Warehouse className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="purchases" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Purchases
          </TabsTrigger>
          <TabsTrigger value="issues" className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Issues
          </TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Item Master</CardTitle>
                  <CardDescription>Manage inventory items</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemViewMode(itemViewMode === 'table' ? 'grid' : 'table')}
                  >
                    {itemViewMode === 'table' ? <Grid3x3 className="h-4 w-4 mr-2" /> : <TableIcon className="h-4 w-4 mr-2" />}
                    {itemViewMode === 'table' ? 'Grid View' : 'Table View'}
                  </Button>
                  <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetItemForm}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Item' : 'Create New Item'}</DialogTitle>
                        <DialogDescription>
                          {editingItem ? 'Update item details' : 'Add a new item to inventory'}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleItemSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-name">Item Name *</Label>
                            <Input
                              id="item-name"
                              value={itemFormData.name}
                              onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-price">Price *</Label>
                            <Input
                              id="item-price"
                              type="number"
                              step="0.01"
                              min="0"
                              value={itemFormData.price}
                              onChange={(e) => setItemFormData({ ...itemFormData, price: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-unit">Unit *</Label>
                            <Input
                              id="item-unit"
                              value={itemFormData.unit}
                              onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}
                              placeholder="e.g., pcs, kg, box"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-supplier">Supplier *</Label>
                            <Select
                              value={itemFormData.supplierId}
                              onValueChange={(value) => setItemFormData({ ...itemFormData, supplierId: value })}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select supplier" />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliersData?.data && suppliersData.data.length > 0 ? (
                                  suppliersData.data.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                      {supplier.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No suppliers found
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Add suppliers in <Link href="/finance/parties" className="text-primary underline">Finance → Parties</Link> with type &quot;SUPPLIER&quot;
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="item-location">Location *</Label>
                          <Select
                            value={itemFormData.locationId}
                            onValueChange={(value) => setItemFormData({ ...itemFormData, locationId: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locationsData?.data
                                .filter((loc) => loc.isActive)
                                .map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name} ({location.code})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-min-stock">Minimum Stock Level</Label>
                            <Input
                              id="item-min-stock"
                              type="number"
                              step="0.01"
                              min="0"
                              value={itemFormData.minimumStockLevel}
                              onChange={(e) => setItemFormData({ ...itemFormData, minimumStockLevel: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-max-stock">Maximum Stock Level</Label>
                            <Input
                              id="item-max-stock"
                              type="number"
                              step="0.01"
                              min="0"
                              value={itemFormData.maximumStockLevel}
                              onChange={(e) => setItemFormData({ ...itemFormData, maximumStockLevel: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="item-description">Description</Label>
                          <Textarea
                            id="item-description"
                            value={itemFormData.description}
                            onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsItemDialogOpen(false)
                              resetItemForm()
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                            {editingItem ? 'Update' : 'Create'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locationsData?.data
                      .filter((loc) => loc.isActive)
                      .map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliersData?.data.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stockAlertFilter} onValueChange={setStockAlertFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Stock Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="normal">Normal Stock</SelectItem>
                    <SelectItem value="high">High Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Grid View */}
              {itemViewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredItems.map((item) => {
                    const stockStatus = getStockStatus(item)
                    return (
                      <Card key={item.id} className={stockStatus.bg}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{item.name}</CardTitle>
                              <CardDescription className="font-mono">{item.itemCode}</CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingItem(item)
                                setItemFormData({
                                  name: item.name,
                                  price: item.price.toString(),
                                  unit: item.unit,
                                  supplierId: item.supplierId,
                                  locationId: item.locationId,
                                  minimumStockLevel: item.minimumStockLevel.toString(),
                                  maximumStockLevel: item.maximumStockLevel.toString(),
                                  description: item.description || '',
                                })
                                setIsItemDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Price:</span>
                            <span className="font-semibold">{formatCurrency(item.price)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Current Stock:</span>
                            <span className={`font-semibold ${stockStatus.color}`}>
                              {item.currentStock || 0} {item.unit}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Min/Max:</span>
                            <span className="text-xs">
                              {item.minimumStockLevel}/{item.maximumStockLevel} {item.unit}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Location:</span>
                            <span className="text-xs">{item.location.name}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Supplier:</span>
                            <span className="text-xs">{item.supplier.name}</span>
                          </div>
                          <Badge variant={stockStatus.status === 'LOW' ? 'destructive' : 'secondary'} className="w-full justify-center">
                            {stockStatus.status} STOCK
                          </Badge>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {filteredItems.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-8">
                      No items found
                    </div>
                  )}
                </div>
              ) : (
                /* Table View */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Min/Max</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const stockStatus = getStockStatus(item)
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono font-medium">{item.itemCode}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{formatCurrency(item.price)}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className={stockStatus.color}>
                            {item.currentStock || 0} {item.unit}
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.minimumStockLevel}/{item.maximumStockLevel} {item.unit}
                          </TableCell>
                          <TableCell>{item.location.name}</TableCell>
                          <TableCell>{item.supplier.name}</TableCell>
                          <TableCell>
                            <Badge variant={stockStatus.status === 'LOW' ? 'destructive' : 'secondary'}>
                              {stockStatus.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingItem(item)
                                setItemFormData({
                                  name: item.name,
                                  price: item.price.toString(),
                                  unit: item.unit,
                                  supplierId: item.supplierId,
                                  locationId: item.locationId,
                                  minimumStockLevel: item.minimumStockLevel.toString(),
                                  maximumStockLevel: item.maximumStockLevel.toString(),
                                  description: item.description || '',
                                })
                                setIsItemDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No items found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Location Master</CardTitle>
                  <CardDescription>Manage warehouses and sub-warehouses</CardDescription>
                </div>
                <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetLocationForm}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingLocation ? 'Edit Location' : 'Create New Location'}</DialogTitle>
                      <DialogDescription>
                        {editingLocation ? 'Update location details' : 'Add a new warehouse or sub-warehouse'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLocationSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="location-name">Name *</Label>
                        <Input
                          id="location-name"
                          value={locationFormData.name}
                          onChange={(e) => setLocationFormData({ ...locationFormData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location-code">Code *</Label>
                        <Input
                          id="location-code"
                          value={locationFormData.code}
                          onChange={(e) => setLocationFormData({ ...locationFormData, code: e.target.value.toUpperCase() })}
                          placeholder="e.g., WH-001"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location-type">Type *</Label>
                        <Select
                          value={locationFormData.type}
                          onValueChange={(value: 'WAREHOUSE' | 'SUB_WAREHOUSE') =>
                            setLocationFormData({ ...locationFormData, type: value, parentId: value === 'WAREHOUSE' ? '' : locationFormData.parentId })
                          }
                          required
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                            <SelectItem value="SUB_WAREHOUSE">Sub-Warehouse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {locationFormData.type === 'SUB_WAREHOUSE' && (
                        <div className="space-y-2">
                          <Label htmlFor="location-parent">Parent Warehouse *</Label>
                          <Select
                            value={locationFormData.parentId}
                            onValueChange={(value) => setLocationFormData({ ...locationFormData, parentId: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select parent warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                              {locationsData?.data
                                .filter((loc) => loc.type === 'WAREHOUSE' && loc.isActive)
                                .map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name} ({location.code})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="location-description">Description</Label>
                        <Textarea
                          id="location-description"
                          value={locationFormData.description}
                          onChange={(e) => setLocationFormData({ ...locationFormData, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsLocationDialogOpen(false)
                            resetLocationForm()
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createLocationMutation.isPending || updateLocationMutation.isPending}>
                          {editingLocation ? 'Update' : 'Create'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {locationTree.map((location) => (
                  <div key={location.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          <Warehouse className="h-4 w-4" />
                          {location.name} <span className="text-xs text-muted-foreground font-mono">({location.code})</span>
                        </div>
                        {location.description && (
                          <p className="text-sm text-muted-foreground mt-1">{location.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingLocation(location)
                          setLocationFormData({
                            name: location.name,
                            code: location.code,
                            type: location.type,
                            parentId: location.parentId || '',
                            description: location.description || '',
                          })
                          setIsLocationDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    {location.children && location.children.length > 0 && (
                      <div className="mt-4 ml-6 space-y-2 border-l-2 pl-4">
                        {location.children.map((child) => (
                          <div key={child.id} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                              <Boxes className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{child.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">({child.code})</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const childLocation = locationsData?.data.find((l) => l.id === child.id)
                                if (childLocation) {
                                  setEditingLocation(childLocation)
                                  setLocationFormData({
                                    name: childLocation.name,
                                    code: childLocation.code,
                                    type: childLocation.type,
                                    parentId: childLocation.parentId || '',
                                    description: childLocation.description || '',
                                  })
                                  setIsLocationDialogOpen(true)
                                }
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {locationTree.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">No locations found</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchases" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Purchase Transactions</CardTitle>
                  <CardDescription>Record item purchases</CardDescription>
                </div>
                <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetPurchaseForm}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Purchase
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Purchase</DialogTitle>
                      <DialogDescription>Record a purchase transaction</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="purchase-item">Item *</Label>
                        <Select
                          value={purchaseFormData.itemId}
                          onValueChange={(value) => {
                            setPurchaseFormData({ ...purchaseFormData, itemId: value })
                            // Auto-fill unit price from item
                            const item = itemsData?.data.find((i) => i.id === value)
                            if (item) {
                              setPurchaseFormData((prev) => ({ ...prev, unitPrice: item.price.toString() }))
                            }
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemsData?.data
                              .filter((item) => item.isActive)
                              .map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.itemCode})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="purchase-supplier">Supplier *</Label>
                          <Select
                            value={purchaseFormData.supplierId}
                            onValueChange={(value) => setPurchaseFormData({ ...purchaseFormData, supplierId: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliersData?.data && suppliersData.data.length > 0 ? (
                                suppliersData.data.map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No suppliers found
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Add suppliers in <Link href="/finance/parties" className="text-primary underline">Finance → Parties</Link> with type &quot;SUPPLIER&quot;
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="purchase-location">Location *</Label>
                          <Select
                            value={purchaseFormData.locationId}
                            onValueChange={(value) => setPurchaseFormData({ ...purchaseFormData, locationId: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locationsData?.data
                                .filter((loc) => loc.isActive)
                                .map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name} ({location.code})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="purchase-quantity">Quantity *</Label>
                          <Input
                            id="purchase-quantity"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={purchaseFormData.quantity}
                            onChange={(e) => setPurchaseFormData({ ...purchaseFormData, quantity: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="purchase-unit-price">Unit Price *</Label>
                          <Input
                            id="purchase-unit-price"
                            type="number"
                            step="0.01"
                            min="0"
                            value={purchaseFormData.unitPrice}
                            onChange={(e) => setPurchaseFormData({ ...purchaseFormData, unitPrice: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Total Price</Label>
                          <div className="pt-2 font-semibold text-lg">
                            {formatCurrency(
                              (parseFloat(purchaseFormData.quantity) || 0) * (parseFloat(purchaseFormData.unitPrice) || 0)
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="purchase-date">Purchase Date *</Label>
                        <Input
                          id="purchase-date"
                          type="date"
                          value={purchaseFormData.purchaseDate}
                          onChange={(e) => setPurchaseFormData({ ...purchaseFormData, purchaseDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="purchase-description">Description</Label>
                        <Textarea
                          id="purchase-description"
                          value={purchaseFormData.description}
                          onChange={(e) => setPurchaseFormData({ ...purchaseFormData, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsPurchaseDialogOpen(false)
                            resetPurchaseForm()
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createPurchaseMutation.isPending}>
                          Create Purchase
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasesData?.data.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-mono font-medium">{purchase.purchaseNumber}</TableCell>
                      <TableCell>{format(new Date(purchase.purchaseDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{purchase.item.name}</div>
                          <div className="text-xs text-muted-foreground">{purchase.item.itemCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>{purchase.supplier.name}</TableCell>
                      <TableCell>{purchase.location.name}</TableCell>
                      <TableCell className="text-right">{purchase.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(purchase.unitPrice)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(purchase.totalPrice)}</TableCell>
                      <TableCell>
                        <Badge variant={purchase.status === 'COMPLETED' ? 'default' : 'secondary'}>
                          {purchase.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!purchasesData?.data || purchasesData.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No purchases found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Issue Transactions</CardTitle>
                  <CardDescription>Record item issues to employees</CardDescription>
                </div>
                <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetIssueForm}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Issue
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Issue</DialogTitle>
                      <DialogDescription>Issue items to an employee</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleIssueSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="issue-item">Item *</Label>
                        <Select
                          value={issueFormData.itemId}
                          onValueChange={(value) => {
                            setIssueFormData({ ...issueFormData, itemId: value })
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemsData?.data
                              .filter((item) => item.isActive)
                              .map((item) => {
                                const stock = item.currentStock || 0
                                return (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name} ({item.itemCode}) - Stock: {stock} {item.unit}
                                  </SelectItem>
                                )
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="issue-location">Location *</Label>
                          <Select
                            value={issueFormData.locationId}
                            onValueChange={(value) => setIssueFormData({ ...issueFormData, locationId: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locationsData?.data
                                .filter((loc) => loc.isActive)
                                .map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name} ({location.code})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="issue-quantity">Quantity *</Label>
                          <Input
                            id="issue-quantity"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={issueFormData.quantity}
                            onChange={(e) => setIssueFormData({ ...issueFormData, quantity: e.target.value })}
                            required
                          />
                          {issueFormData.itemId && issueFormData.locationId && (
                            <p className="text-xs text-muted-foreground">
                              Available: {(() => {
                                const item = itemsData?.data.find((i) => i.id === issueFormData.itemId)
                                // Note: This shows stock from item's primary location, not the selected location
                                // In a real implementation, we'd need to fetch stock per location
                                return item ? `${item.currentStock || 0} ${item.unit}` : 'N/A'
                              })()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="issue-issued-to">Issued To *</Label>
                          <Select
                            value={issueFormData.issuedToId}
                            onValueChange={(value) => setIssueFormData({ ...issueFormData, issuedToId: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                              {usersData?.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name} ({user.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="issue-date">Issue Date *</Label>
                          <Input
                            id="issue-date"
                            type="date"
                            value={issueFormData.issueDate}
                            onChange={(e) => setIssueFormData({ ...issueFormData, issueDate: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      {issueFormData.itemId && (
                        <div className="p-3 bg-muted rounded-md">
                          <div className="text-sm text-muted-foreground">Unit Price (from item master):</div>
                          <div className="font-semibold text-lg">
                            {formatCurrency(
                              itemsData?.data.find((i) => i.id === issueFormData.itemId)?.price || 0
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-2">Total Price:</div>
                          <div className="font-semibold text-lg">
                            {formatCurrency(
                              (parseFloat(issueFormData.quantity) || 0) *
                                (itemsData?.data.find((i) => i.id === issueFormData.itemId)?.price || 0)
                            )}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="issue-description">Description</Label>
                        <Textarea
                          id="issue-description"
                          value={issueFormData.description}
                          onChange={(e) => setIssueFormData({ ...issueFormData, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsIssueDialogOpen(false)
                            resetIssueForm()
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createIssueMutation.isPending}>
                          Create Issue
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Issued To</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuesData?.data.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="font-mono font-medium">{issue.issueNumber}</TableCell>
                      <TableCell>{format(new Date(issue.issueDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{issue.item.name}</div>
                          <div className="text-xs text-muted-foreground">{issue.item.itemCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>{issue.location.name}</TableCell>
                      <TableCell>{issue.issuedTo.name}</TableCell>
                      <TableCell className="text-right">{issue.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(issue.unitPrice)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(issue.totalPrice)}</TableCell>
                      <TableCell>
                        <Badge variant={issue.status === 'COMPLETED' ? 'default' : 'secondary'}>
                          {issue.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!issuesData?.data || issuesData.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No issues found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading Inventory...</div>}>
      <InventoryContent />
    </Suspense>
  )
}
