import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { translations, Locale } from './translations';

export type { Locale };

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string) => string;
  isSwahili: boolean;
  isEnglish: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'nuru-ui-locale';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === 'sw' ? 'sw' : 'en') as Locale;
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'sw' : 'en');
  }, [locale, setLocale]);

  const t = useCallback((key: string): string => {
    return translations[key]?.[locale] ?? translations[key]?.en ?? key;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{
      locale,
      setLocale,
      toggleLocale,
      t,
      isSwahili: locale === 'sw',
      isEnglish: locale === 'en',
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Standalone translate (for use outside React)
export function t(key: string, locale: Locale = 'en'): string {
  return translations[key]?.[locale] ?? translations[key]?.en ?? key;
}
