/**
 * Cheil fork (plan item 5): a campaign card changed while this tab, a
 * document in the campaign's folder, is open (or the shell opened it again
 * for the change). The shell sends the old texts and their new values; the
 * editor replaces them through its own operations (`apply`, one undo step)
 * and answers how many places each changed; the panel says what changed.
 * Outside the app, or for a document no campaign holds, nothing arrives.
 */
import { useEffect, useRef } from 'react'
import { cheilCardChangeNote, cheilChangeCounts, type CheilPropagatePair } from './cheil-fields'
import { cheilTemplateNote } from './cheil-my-template'

/** how long a document just opened may take to load before the change goes in anyway */
const LOAD_TRIES = 100
const LOAD_WAIT_MS = 250

export function useCheilPropagate(options: {
  lang: string
  /** replace each pair's `find` with its `to`; how many places each changed, in order */
  apply: (pairs: CheilPropagatePair[]) => Promise<number[]> | number[]
  /** put a line in the panel */
  note: (text: string) => void
  /** the document has loaded (a tab the shell just opened may still be reading its file) */
  loaded?: () => boolean
}): void {
  const ref = useRef(options)
  ref.current = options
  useEffect(() => {
    const bridge = (
      globalThis as {
        aiOfficeUserSkills?: {
          onCheilPropagate?: (
            apply: (pairs: CheilPropagatePair[], purpose: 'card' | 'template') => Promise<number[]>,
          ) => () => void
        }
      }
    ).aiOfficeUserSkills
    if (!bridge?.onCheilPropagate) return
    return bridge.onCheilPropagate(async (pairs, purpose) => {
      let tries = 0
      while (ref.current.loaded && !ref.current.loaded() && tries++ < LOAD_TRIES) {
        await new Promise((resolve) => setTimeout(resolve, LOAD_WAIT_MS))
      }
      const counts = await ref.current.apply(pairs)
      const items = cheilChangeCounts(pairs, counts)
      ref.current.note(
        purpose === 'template'
          ? cheilTemplateNote(ref.current.lang, items)
          : cheilCardChangeNote(ref.current.lang, items),
      )
      return counts
    })
  }, [])
}
