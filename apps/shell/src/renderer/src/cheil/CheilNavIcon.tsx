/** Cheil fork: quiet outline symbols for the five primary destinations. */
export function CheilNavIcon({
  name,
}: {
  name: 'home' | 'campaigns' | 'knowledge' | 'tools' | 'files'
}) {
  const paths = {
    home: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h6v6h-6z',
    campaigns: 'm3 7 9-4 9 4-9 4z M3 12l9 4 9-4 M3 17l9 4 9-4',
    knowledge: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1z M12 5v15',
    tools: 'M4 3v6 M4 13v8 M12 3v10 M12 17v4 M20 3v2 M20 9v12 M1 9h6 M9 17h6 M17 5h6',
    files: 'M3 7V5h6l2 3h10v12H3z M3 8h8',
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
