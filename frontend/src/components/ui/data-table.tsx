import * as React from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Column<T> {
    key: string
    header: string
    width?: string
    align?: 'left' | 'center' | 'right'
    render?: (item: T) => React.ReactNode
    className?: string
    sortable?: boolean
    sortingFn?: (a: T, b: T) => number
}

interface SortConfig {
    key: string
    direction: 'asc' | 'desc'
}

interface DataTableProps<T> {
    data: T[]
    columns: Column<T>[]
    keyExtractor: (item: T) => string
    searchPlaceholder?: string
    searchKey?: keyof T
    onRowClick?: (item: T) => void
    isLoading?: boolean
    emptyMessage?: string
    defaultSort?: SortConfig
}

export function DataTable<T>({
    data,
    columns,
    keyExtractor,
    searchPlaceholder = 'Search...',
    searchKey,
    onRowClick,
    isLoading,
    emptyMessage = 'No data found.',
    defaultSort,
}: DataTableProps<T>) {
    const [searchQuery, setSearchQuery] = React.useState('')
    const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(defaultSort ?? null)

    // Handle sorting toggle
    const handleSort = (key: string) => {
        setSortConfig((current) => {
            if (current?.key === key) {
                // Toggle direction or clear
                if (current.direction === 'asc') {
                    return { key, direction: 'desc' }
                } else {
                    return null // Clear sort after desc
                }
            }
            // New sort key
            return { key, direction: 'asc' }
        })
    }

    // Get sort icon for a column
    const getSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) {
            return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
        }
        if (sortConfig.direction === 'asc') {
            return <ArrowUp className="ml-1 h-3 w-3" />
        }
        return <ArrowDown className="ml-1 h-3 w-3" />
    }

    // Filter and sort data
    const processedData = React.useMemo(() => {
        let result = [...data]

        // Apply search filter
        if (searchQuery && searchKey) {
            result = result.filter((item) => {
                const value = item[searchKey]
                if (typeof value === 'string') {
                    return value.toLowerCase().includes(searchQuery.toLowerCase())
                }
                return true
            })
        }

        // Apply sorting
        if (sortConfig) {
            const column = columns.find((col) => col.key === sortConfig.key)

            result.sort((a, b) => {
                // Use custom sorting function if provided
                if (column?.sortingFn) {
                    const comparison = column.sortingFn(a, b)
                    return sortConfig.direction === 'asc' ? comparison : -comparison
                }

                // Default sorting by key value
                const aValue = (a as Record<string, unknown>)[sortConfig.key]
                const bValue = (b as Record<string, unknown>)[sortConfig.key]

                // Handle null/undefined
                if (aValue == null && bValue == null) return 0
                if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1
                if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1

                // Compare by type
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
                }

                // String comparison
                const aStr = String(aValue).toLowerCase()
                const bStr = String(bValue).toLowerCase()
                const comparison = aStr.localeCompare(bStr)
                return sortConfig.direction === 'asc' ? comparison : -comparison
            })
        }

        return result
    }, [data, searchQuery, searchKey, sortConfig, columns])

    return (
        <div className="space-y-3">
            {/* Search bar - top right */}
            {searchKey && (
                <div className="flex justify-end">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-sm"
                        />
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {columns.map((column) => (
                                <TableHead
                                    key={column.key}
                                    style={{ width: column.width }}
                                    className={cn(
                                        'h-9 text-xs font-medium uppercase tracking-wide text-muted-foreground',
                                        column.align === 'center' && 'text-center',
                                        column.align === 'right' && 'text-right',
                                        column.sortable && 'cursor-pointer select-none hover:text-foreground'
                                    )}
                                    onClick={column.sortable ? () => handleSort(column.key) : undefined}
                                >
                                    <span className="inline-flex items-center">
                                        {column.header}
                                        {column.sortable && getSortIcon(column.key)}
                                    </span>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-16 text-center text-sm text-muted-foreground"
                                >
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : processedData.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-16 text-center text-sm text-muted-foreground"
                                >
                                    {searchQuery ? 'No results match your search.' : emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            processedData.map((item) => (
                                <TableRow
                                    key={keyExtractor(item)}
                                    onClick={() => onRowClick?.(item)}
                                    className={cn(
                                        'hover:bg-muted/50',
                                        onRowClick && 'cursor-pointer'
                                    )}
                                >
                                    {columns.map((column) => (
                                        <TableCell
                                            key={column.key}
                                            className={cn(
                                                'py-2 text-sm',
                                                column.align === 'center' && 'text-center',
                                                column.align === 'right' && 'text-right',
                                                column.className
                                            )}
                                        >
                                            {column.render
                                                ? column.render(item)
                                                : String((item as Record<string, unknown>)[column.key] ?? '')}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
