import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "system",
    setTheme: () => { },
    resolvedTheme: "light",
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("asm-theme") as Theme) || "system";
        }
        return "system";
    });

    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

    useEffect(() => {
        const root = document.documentElement;

        const applyTheme = (t: Theme) => {
            const isDark =
                t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
            root.classList.toggle("dark", isDark);
            setResolvedTheme(isDark ? "dark" : "light");
        };

        applyTheme(theme);
        localStorage.setItem("asm-theme", theme);

        // Listen for system theme changes
        if (theme === "system") {
            const mql = window.matchMedia("(prefers-color-scheme: dark)");
            const handler = () => applyTheme("system");
            mql.addEventListener("change", handler);
            return () => mql.removeEventListener("change", handler);
        }
    }, [theme]);

    const setTheme = (t: Theme) => setThemeState(t);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
