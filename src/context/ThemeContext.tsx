import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeMode } from '../types/editor';
import { loadUserSettings, saveUserSettings } from '../services/storage';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  const setTheme = React.useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      document.body.style.backgroundColor = '#1e1e1e';
      document.body.style.color = '#cccccc';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#333333';
    }

    loadUserSettings().then((settings) => {
      saveUserSettings({ ...settings, theme: newTheme });
    });
  }, []);

  useEffect(() => {
    loadUserSettings().then((settings) => {
      if (settings?.theme) {
        setTheme(settings.theme);
      }
    });
  }, [setTheme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
