

interface ResourceGaugeProps {
    label: string
    value: number // 0-100
    usage: string
    capacity: string
    color?: string
}

export function ResourceGauge({ label, value, usage, capacity, color }: ResourceGaugeProps) {
    // Determine color based on value if not provided
    const getColor = (val: number) => {
        if (color) return color
        if (val >= 90) return 'text-red-500'
        if (val >= 70) return 'text-amber-500'
        return 'text-emerald-500'
    }

    const strokeColor = getColor(value)

    // SVG Config
    const radius = 30
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (value / 100) * circumference

    return (
        <div className="flex flex-col items-center">
            <div className="relative h-20 w-20 flex items-center justify-center">
                {/* Background Circle */}
                <svg className="transform -rotate-90 w-full h-full">
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        className="text-muted/20"
                    />
                    {/* Progress Circle */}
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className={`${strokeColor} transition-all duration-1000 ease-out`}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-bold ${strokeColor}`}>{value}%</span>
                </div>
            </div>
            <div className="mt-1 text-center">
                <div className="text-xs font-medium text-muted-foreground">{label}</div>
                <div className="text-[10px] text-muted-foreground/60">{usage} / {capacity}</div>
            </div>
        </div>
    )
}
