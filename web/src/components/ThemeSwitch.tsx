import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div aria-label="화면 모드" className="theme-switch" role="group">
      <button
        aria-label="낮 모드"
        aria-pressed={theme === 'light'}
        className="theme-switch__button"
        onClick={() => setTheme('light')}
        title="낮 모드"
        type="button"
      >
        <span aria-hidden="true">☀️</span>
      </button>
      <button
        aria-label="밤 모드"
        aria-pressed={theme === 'dark'}
        className="theme-switch__button"
        onClick={() => setTheme('dark')}
        title="밤 모드"
        type="button"
      >
        <span aria-hidden="true">🌙</span>
      </button>
    </div>
  );
}
