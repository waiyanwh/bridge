import { Toaster as Sonner, toast } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
    return (
        <Sonner
            theme="dark"
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast:
                        'group toast group-[.toaster]:bg-zinc-900 group-[.toaster]:text-foreground group-[.toaster]:border-zinc-800 group-[.toaster]:shadow-lg',
                    description: 'group-[.toast]:text-muted-foreground',
                    actionButton:
                        'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                    cancelButton:
                        'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                },
            }}
            {...props}
        />
    )
}

export { Toaster, toast }
