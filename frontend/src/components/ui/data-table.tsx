import * as React from 'react'
import { Search } from 'lucide-react'
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
}: DataTableProps<T>) {
    const [searchQuery, setSearchQuery] = React.useState('')

    // Filter data by search query
    const filteredData = React.useMemo(() => {
        if (!searchQuery || !searchKey) return data
        return data.filter((item) => {
            const value = item[searchKey]
            if (typeof value === 'string') {
                return value.toLowerCase().includes(searchQuery.toLowerCase())
            }
            return true
        })
    }, [data, searchQuery, searchKey])

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
                                        column.align === 'right' && 'text-right'
                                    )}
                                >
                                    {column.header}
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
                        ) : filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-16 text-center text-sm text-muted-foreground"
                                >
                                    {searchQuery ? 'No results match your search.' : emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow
                                    key={keyExtractor(item)}
                                    onClick={() => onRowClick?.(item)}
                                    className={cn(
                                        'hover:bg-[hsl(224,10%,12%)]',
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
