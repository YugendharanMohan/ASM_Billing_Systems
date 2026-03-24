/**
 * SearchInput — Reusable search field with icon and clear button.
 * Used across Workers, Orders, Inventory, Expenses, and Attendance pages.
 */

import { Search, X } from "lucide-react";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Search...", className = "" }: SearchInputProps) {
    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="form-field pl-10 pr-9 h-10"
            />
            {value && (
                <button
                    onClick={() => onChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
