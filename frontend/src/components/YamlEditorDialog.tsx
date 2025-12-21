import { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { X, Save, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchResourceYAML, applyResourceYAML } from '@/api'

interface YamlEditorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    resourceType: string
    namespace: string
    name: string
    onSuccess?: () => void
}

export function YamlEditorDialog({
    open,
    onOpenChange,
    resourceType,
    namespace,
    name,
    onSuccess,
}: YamlEditorDialogProps) {
    const [yaml, setYaml] = useState<string>('')
    const [originalYaml, setOriginalYaml] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showConfirm, setShowConfirm] = useState(false)

    // Load YAML when dialog opens
    const loadYaml = useCallback(async () => {
        if (!namespace || !name) return

        setIsLoading(true)
        setError(null)
        setYaml('')
        setOriginalYaml('')

        try {
            const data = await fetchResourceYAML(resourceType, namespace, name)
            setYaml(data.yaml)
            setOriginalYaml(data.yaml)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load YAML')
        } finally {
            setIsLoading(false)
        }
    }, [resourceType, namespace, name])

    // Load when opened - using useEffect correctly
    useEffect(() => {
        if (open) {
            loadYaml()
        } else {
            // Reset state when closed
            setYaml('')
            setOriginalYaml('')
            setError(null)
            setShowConfirm(false)
        }
    }, [open, loadYaml])

    // Handle save
    const handleSave = async () => {
        if (!showConfirm) {
            setShowConfirm(true)
            return
        }

        setIsSaving(true)
        setError(null)
        try {
            await applyResourceYAML(resourceType, namespace, name, yaml)
            setOriginalYaml(yaml)
            setShowConfirm(false)
            onSuccess?.()
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply YAML')
            setShowConfirm(false)
        } finally {
            setIsSaving(false)
        }
    }

    const hasChanges = yaml !== originalYaml

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => !isSaving && onOpenChange(false)}
            />

            {/* Dialog */}
            <div className="fixed inset-4 flex flex-col rounded-lg border border-border bg-background shadow-2xl md:inset-8 lg:inset-12">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold">Edit YAML</h2>
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-sm">
                            {resourceType}/{name}
                        </span>
                        {hasChanges && (
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                                Unsaved changes
                            </span>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-hidden">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-muted-foreground">Loading resource...</span>
                        </div>
                    ) : error && !yaml ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center">
                                <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
                                <p className="mt-2 text-red-400">{error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadYaml}
                                    className="mt-4"
                                >
                                    Retry
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Editor
                            height="100%"
                            language="yaml"
                            theme="vs-dark"
                            value={yaml}
                            onChange={(value) => setYaml(value || '')}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: '"JetBrains Mono", monospace',
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 2,
                                wordWrap: 'on',
                            }}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    {/* Error message */}
                    <div className="flex-1">
                        {error && yaml && (
                            <div className="flex items-center gap-2 text-sm text-red-400">
                                <AlertTriangle className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                        {showConfirm && !error && (
                            <div className="flex items-center gap-2 text-sm text-amber-400">
                                <AlertTriangle className="h-4 w-4" />
                                Are you sure you want to apply these changes to the cluster?
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {showConfirm ? (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowConfirm(false)}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="gap-2"
                                >
                                    {isSaving ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    Confirm & Apply
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={!hasChanges || isSaving || isLoading}
                                    className="gap-2"
                                >
                                    <Save className="h-4 w-4" />
                                    Save & Apply
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
