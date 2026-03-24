/**
 * Reusable loading skeleton components for all pages.
 * Drop-in replacements during data loading states.
 */

export function SkeletonCard() {
    return (
        <div className="card-elevated p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                </div>
            </div>
            <div className="h-8 bg-muted rounded w-1/4" />
        </div>
    );
}

export function SkeletonRow() {
    return (
        <div className="flex items-center gap-4 p-4 border-b border-border/40 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-2/5" />
                <div className="h-3 bg-muted rounded w-1/4" />
            </div>
            <div className="h-6 bg-muted rounded w-16" />
        </div>
    );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="card-elevated overflow-hidden">
            {/* Header */}
            <div className="flex gap-4 p-4 bg-muted/30 border-b border-border/40 animate-pulse">
                {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} className="h-4 bg-muted base rounded flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border-b border-border/40 last:border-b-0 animate-pulse">
                    {Array.from({ length: cols }).map((_, j) => (
                        <div key={j} className="h-4 bg-muted rounded flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonChart() {
    return (
        <div className="card-elevated p-6 animate-pulse">
            <div className="h-5 bg-muted rounded w-40 mb-6" />
            <div className="flex items-end gap-2 h-48">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-muted rounded-t"
                        style={{ height: `${20 + Math.random() * 80}%` }}
                    />
                ))}
            </div>
            <div className="flex justify-between mt-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-3 bg-muted rounded w-8" />
                ))}
            </div>
        </div>
    );
}

export function SkeletonDashboard() {
    return (
        <div className="space-y-6 p-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>
            {/* Chart */}
            <SkeletonChart />
            {/* Table */}
            <SkeletonTable rows={6} cols={5} />
        </div>
    );
}

export function SkeletonPage() {
    return (
        <div className="max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
            <SkeletonDashboard />
        </div>
    );
}
