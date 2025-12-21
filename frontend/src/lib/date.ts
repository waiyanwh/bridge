import { formatDistanceToNow, parseISO } from 'date-fns'

/**
 * Formats an age string like "2m ago", "3d ago"
 * Accepts either ISO date string or already formatted age string
 */
export function formatAge(dateOrAge: string): string {
    // If it's already in the short format (like "2d", "3h"), return as-is
    if (/^\d+[smhdyMw]$/.test(dateOrAge)) {
        return dateOrAge
    }

    try {
        const date = parseISO(dateOrAge)
        return formatDistanceToNow(date, { addSuffix: false })
            .replace('about ', '')
            .replace(' minutes', 'm')
            .replace(' minute', 'm')
            .replace(' hours', 'h')
            .replace(' hour', 'h')
            .replace(' days', 'd')
            .replace(' day', 'd')
            .replace(' months', 'mo')
            .replace(' month', 'mo')
            .replace(' years', 'y')
            .replace(' year', 'y')
            .replace('less than a', '<1')
    } catch {
        return dateOrAge
    }
}

/**
 * Formats a date for display
 */
export function formatDate(dateString: string): string {
    try {
        const date = parseISO(dateString)
        return date.toLocaleString()
    } catch {
        return dateString
    }
}
