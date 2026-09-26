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

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      aria-label={theme === 'dark' ? '낮 모드로 전환' : '다크 모드로 전환'}
      className="theme-switch__button"
      onClick={() => setTheme(nextTheme)}
      title={theme === 'dark' ? '낮 모드로 전환' : '다크 모드로 전환'}
      type="button"
    >
      <span aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
    </button>
  );
}
