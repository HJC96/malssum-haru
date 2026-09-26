export type ScriptureIconName = 'book' | 'leaf' | 'seedling' | 'waves' | 'books';

/** Small, decorative line icons that inherit their color from the surrounding label. */
export function ScriptureIcon({ name, className }: { name: ScriptureIconName; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24" fill="none">
      {name === 'book' && <>
        <path d="M12 6.2C9.7 4.6 6.8 4.2 3.5 5v13.1c3.2-.8 6.1-.4 8.5 1.2m0-13.1c2.3-1.6 5.2-2 8.5-1.2v13.1c-3.2-.8-6.1-.4-8.5 1.2m0-13.1v13.1" />
        <path d="M6.2 8.2c1.4-.2 2.6 0 3.8.5m7.8-.5c-1.4-.2-2.6 0-3.8.5" />
      </>}
      {name === 'leaf' && <>
        <path d="M19.5 4.5C11 4.5 5 6.8 5 12.3c0 3.1 2.2 5 5 5 5.7 0 8.9-6 9.5-12.8Z" />
        <path d="M4 20c3.4-5 7.2-7.7 12-10.1M9 15l-.4-3.3m4.1.1 2.8.3" />
      </>}
      {name === 'seedling' && <>
        <path d="M12 20v-8m0 2c-4.5 0-7-2.2-7-6.5 4.7 0 7 2 7 6.5Zm0-2c0-4.7 2.2-7 7-7 0 4.6-2.5 7-7 7Z" />
        <path d="M7 20h10" />
      </>}
      {name === 'waves' && <>
        <path d="M3 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 3-2M3 13c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 3-2M3 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 3-2" />
      </>}
      {name === 'books' && <>
        <path d="m4 7 12-3 1 4L5 11 4 7Zm2 5 12-3 1 4-12 3-1-4Zm1 6h13v3H7v-3Z" />
        <path d="m7 8 1 3m1 2 1 3m1 2v3" />
      </>}
    </svg>
  );
}
