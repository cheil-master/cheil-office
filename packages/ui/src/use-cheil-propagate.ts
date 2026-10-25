/**
 * Cheil fork (plan item 5): a campaign card changed while this tab, opened
 * from the campaign, is open. The shell sends the old texts and their new
 * values; the editor replaces them through its own operations (`apply`, one
 * undo step) and answers how many places each changed; the panel says what
 * changed. Outside the app, or for a tab no campaign opened, nothing arrives.
 */
import { useEffect, useRef } from 'react'
import { cheilCardChangeNote, cheilChangeCounts, type CheilPropagatePair } from './cheil-fields'

export function useCheilPropagate(options: {
  lang: string
  /** replace each pair's `find` with its `to`; how many places each changed, in order */
  apply: (pairs: CheilPropagatePair[]) => Promise<number[]> | number[]
  /** put a line in the panel */
  note: (text: string) => void
}): void {
  const ref = useRef(options)
  ref.current = options
  useEffect(() => {
    const bridge = (
      globalThis as {
        aiOfficeUserSkills?: {
          onCheilPropagate?: (
            apply: (pairs: CheilPropagatePair[]) => Promise<number[]>,
          ) => () => void
        }
      }
    ).aiOfficeUserSkills
    if (!bridge?.onCheilPropagate) return
    return bridge.onCheilPropagate(async (pairs) => {
      const counts = await ref.current.apply(pairs)
      ref.current.note(cheilCardChangeNote(ref.current.lang, cheilChangeCounts(pairs, counts)))
      return counts
    })
  }, [])
}
