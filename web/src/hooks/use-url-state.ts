import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"

import { parseState, stateToParams, type WsState } from "@/lib/url-state"

export function useUrlState(): [WsState, (patch: Partial<WsState>) => void] {
  const [sp, setSp] = useSearchParams()
  const state = useMemo(() => parseState(sp), [sp])
  const update = useCallback(
    (patch: Partial<WsState>) => {
      setSp((prev) => stateToParams({ ...parseState(prev), ...patch }, prev), { replace: true })
    },
    [setSp],
  )
  return [state, update]
}
