import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  resolvedTheme: 'light',
  setThemeMode: () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme') as ThemeMode;
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => {
      const activeTheme: 'light' | 'dark' =
        mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
      setResolvedTheme(activeTheme);
      document.documentElement.setAttribute('data-theme', activeTheme);

      // Status bar meta color
      document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove());
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = activeTheme === 'dark' ? '#0B1220' : '#ffffff';
      document.head.appendChild(meta);
    };

    updateTheme();
    media.addEventListener('change', updateTheme);
    return () => media.removeEventListener('change', updateTheme);
  }, [mode]);

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem('theme', newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
