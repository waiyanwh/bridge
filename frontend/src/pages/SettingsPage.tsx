import {
    Clock,
    Eye,
    EyeOff,
    LayoutList,
    Github,
    Cpu,
    Palette
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSettings } from '@/context/SettingsContext'
import { useTheme, type Theme } from '@/context/ThemeContext'
import packageJson from '../../package.json'

export function SettingsPage() {
    const {
        refreshInterval,
        setRefreshInterval,
        showSystemNamespaces,
        setShowSystemNamespaces,
        tableDensity,
        setTableDensity
    } = useSettings()

    const { theme, setTheme } = useTheme()

    const themeOptions: { value: Theme; label: string; icon: string }[] = [
        { value: 'light', label: 'Light', icon: '☀️' },
        { value: 'dark', label: 'Dark', icon: '🌙' },
        { value: 'bridge', label: 'Bridge', icon: '🌉' },
    ]

    return (
        <div className="space-y-6 max-w-4xl mx-auto py-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your preferences and application configuration.
                </p>
            </div>

            {/* General Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">General</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Auto-Refresh Rate</Label>
                            <p className="text-sm text-muted-foreground">
                                How often to fetch new data from the cluster.
                            </p>
                        </div>
                        <Select
                            value={refreshInterval.toString()}
                            onValueChange={(val) => setRefreshInterval(parseInt(val))}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select interval" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">Off (Manual)</SelectItem>
                                <SelectItem value="5000">5 seconds</SelectItem>
                                <SelectItem value="10000">10 seconds</SelectItem>
                                <SelectItem value="30000">30 seconds</SelectItem>
                                <SelectItem value="60000">1 minute</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Theme Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Theme</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Color Theme</Label>
                            <p className="text-sm text-muted-foreground">
                                Choose your preferred color scheme.
                            </p>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/20">
                            {themeOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={theme === option.value ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setTheme(option.value)}
                                    className="h-8 gap-1.5 text-xs"
                                >
                                    <span>{option.icon}</span>
                                    <span>{option.label}</span>
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <LayoutList className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Appearance</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Show System Namespaces</Label>
                            <p className="text-sm text-muted-foreground">
                                Show kube-system and other internal namespaces in dropdowns.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {showSystemNamespaces ? (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Switch
                                checked={showSystemNamespaces}
                                onCheckedChange={setShowSystemNamespaces}
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Table Density</Label>
                            <p className="text-sm text-muted-foreground">
                                Control the spacing in data tables.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border p-1 bg-muted/20">
                            <Button
                                variant={tableDensity === 'normal' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setTableDensity('normal')}
                                className="h-7 text-xs"
                            >
                                Normal
                            </Button>
                            <Button
                                variant={tableDensity === 'compact' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setTableDensity('compact')}
                                className="h-7 text-xs"
                            >
                                Compact
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* About Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Cpu className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">About</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1">
                            <p className="font-medium">Bridge</p>
                            <p className="text-sm text-muted-foreground">
                                High-performance Kubernetes dashboard.
                            </p>
                        </div>
                        <Badge variant="secondary" className="font-mono">
                            v{packageJson.version}
                        </Badge>
                    </div>

                    <div className="flex justify-end">
                        <Button variant="outline" className="gap-2" asChild>
                            <a href="https://github.com/waiyanwh/bridge" target="_blank" rel="noopener noreferrer">
                                <Github className="h-4 w-4" />
                                View on GitHub
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
