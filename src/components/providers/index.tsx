"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeProvider>{children}</ThemeProvider>
    </NextThemesProvider>
  );
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [primaryColor, setPrimaryColor] = useState("#0C1C33");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    const savedColor = localStorage.getItem("primaryColor");
    if (savedTheme) setTheme(savedTheme);
    if (savedColor) setPrimaryColor(savedColor);
  }, []);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const handleSetPrimaryColor = (color: string) => {
    setPrimaryColor(color);
    localStorage.setItem("primaryColor", color);
    document.documentElement.style.setProperty("--primary-color", color);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    handleSetTheme(newTheme);
  };

  useEffect(() => {
    if (mounted) {
      document.documentElement.style.setProperty("--primary-color", primaryColor);
    }
  }, [primaryColor, mounted]);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900" />;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, primaryColor, setPrimaryColor: handleSetPrimaryColor, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
