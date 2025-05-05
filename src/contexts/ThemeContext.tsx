import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark] = useState(() => {
    // Sempre usar dark mode como padrão
    localStorage.setItem('theme', 'dark');
    return true;
  });

  useEffect(() => {
    // Garantir que o dark mode esteja sempre ativo
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  // Manter a função toggleTheme para compatibilidade, mas ela não fará nada
  const toggleTheme = () => {
    // Não permitir alteração do tema
    return;
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};