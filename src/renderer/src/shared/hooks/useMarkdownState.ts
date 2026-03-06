import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export function useMarkdownState<T>(
  loadFn: (fallback: T) => Promise<T>,
  saveFn: (state: T) => Promise<void>,
  fallback: T
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [state, setState] = useState<T>(fallback)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let mounted = true
    loadFn(fallback)
      .then((loaded) => {
        if (mounted) setState(loaded)
      })
      .finally(() => {
        if (mounted) setHydrated(true)
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveFn(state).catch(console.error)
  }, [state, hydrated])

  return [state, setState, hydrated]
}
