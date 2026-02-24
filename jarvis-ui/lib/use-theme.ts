"use client"

import { useState, useCallback, useEffect } from "react"

export type Theme = "light" | "dark"

const STORAGE_KEY = "jarvis-theme"

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light")

  // Sync with DOM on mount (the inline script already set the class)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial = stored === "dark" ? "dark" : "light"
    setTheme(initial)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light"
      document.documentElement.classList.toggle("dark", next === "dark")
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { theme, isDark: theme === "dark", toggleTheme }
}
