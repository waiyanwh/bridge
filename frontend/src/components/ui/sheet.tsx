import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { YamlEditorDialog } from "@/components/YamlEditorDialog"
import { X, Maximize2, Minimize2, FileCode } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = DialogPrimitive.Root

const SheetTrigger = DialogPrimitive.Trigger

const SheetClose = DialogPrimitive.Close

const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        className={cn(
            "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
        ref={ref}
    />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

interface SheetContentProps
    extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    side?: "top" | "bottom" | "left" | "right"
}

const sheetVariants = {
    top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
    bottom:
        "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
    left: "inset-y-0 left-0 h-full w-full border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:w-3/5 sm:max-w-none",
    right:
        "inset-y-0 right-0 h-full w-full border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right md:w-3/5 sm:max-w-none",
}

// 1. Create Context
interface SheetContextType {
    isMaximized: boolean
    toggleMaximize: () => void
}
const SheetContext = React.createContext<SheetContextType>({
    isMaximized: false,
    toggleMaximize: () => { },
})

const SheetContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
    const [isMaximized, setIsMaximized] = React.useState(false)

    return (
        <SheetPortal>
            <SheetOverlay />
            <SheetContext.Provider value={{ isMaximized, toggleMaximize: () => setIsMaximized(!isMaximized) }}>
                <DialogPrimitive.Content
                    ref={ref}
                    className={cn(
                        "fixed z-50 gap-4 bg-background p-6 shadow-lg transition-all ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
                        sheetVariants[side],
                        isMaximized && "!w-[95%] !max-w-none",
                        className
                    )}
                    {...props}
                >
                    {children}
                </DialogPrimitive.Content>
            </SheetContext.Provider>
        </SheetPortal>
    )
})
SheetContent.displayName = DialogPrimitive.Content.displayName

interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    resourceKind?: string
    resourceName?: string
    namespace?: string
    onYamlSuccess?: () => void
}

const SheetHeader = ({
    className,
    children,
    resourceKind,
    resourceName,
    namespace,
    onYamlSuccess,
    ...props
}: SheetHeaderProps) => {
    const { isMaximized, toggleMaximize } = React.useContext(SheetContext)
    const [yamlEditorOpen, setYamlEditorOpen] = React.useState(false)

    return (
        <div
            className={cn(
                "flex items-center justify-between mb-4",
                className
            )}
            {...props}
        >
            {/* Left Zone: Info/Title */}
            <div className="flex-1 flex flex-col space-y-2 text-center sm:text-left pr-6">
                {children}
            </div>

            {/* Right Zone: Controls */}
            <div className="flex items-center gap-4">
                {resourceKind && resourceName && namespace && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setYamlEditorOpen(true)}
                            title="Edit YAML"
                        >
                            <FileCode className="h-4 w-4" />
                            <span className="sr-only">Edit YAML</span>
                        </Button>

                        <YamlEditorDialog
                            open={yamlEditorOpen}
                            onOpenChange={setYamlEditorOpen}
                            resourceType={resourceKind}
                            name={resourceName}
                            namespace={namespace}
                            onSuccess={onYamlSuccess}
                        />
                    </>
                )}

                <button
                    onClick={toggleMaximize}
                    className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
                    title={isMaximized ? "Restore" : "Maximize"}
                    type="button"
                >
                    {isMaximized ? (
                        <Minimize2 className="h-4 w-4" />
                    ) : (
                        <Maximize2 className="h-4 w-4" />
                    )}
                    <span className="sr-only">Toggle Maximize</span>
                </button>

                <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
            </div>
        </div>
    )
}
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
            className
        )}
        {...props}
    />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn("text-lg font-semibold text-foreground", className)}
        {...props}
    />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
    Sheet,
    SheetPortal,
    SheetOverlay,
    SheetTrigger,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
}
