import { useCallback, useState } from "react"

const STORAGE_KEY = "log-ui-groups"

/**
 * Which metric groups are open, per project, persisted in localStorage like pins. Only groups the user has
 * toggled are stored; the rest use the default passed to `isOpen`.
 */
export function useGroupState(project: string): {
  isOpen: (path: string, fallback: boolean) => boolean
  setOpen: (path: string, open: boolean) => void
} {
  const storageKey = `${STORAGE_KEY}:${project}`
  const [state, setState] = useState<Record<string, boolean>>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as unknown
      return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })
  const isOpen = useCallback((path: string, fallback: boolean) => state[path] ?? fallback, [state])
  const setOpen = useCallback(
    (path: string, open: boolean) =>
      setState((prev) => {
        const next = { ...prev, [path]: open }
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          /* storage unavailable: the choice lasts for this page view */
        }
        return next
      }),
    [storageKey],
  )
  return { isOpen, setOpen }
}
