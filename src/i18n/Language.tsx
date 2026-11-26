import React, { createContext, useContext, useState } from 'react';
import { getTranslation } from './catalog';

export type Language = 'en' | 'es';
type LanguageContextValue = { language: Language; setPreview: (language: Language | null) => void };
const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setPreview: () => {},
});

export function LanguageProvider({
  language,
  children,
}: React.PropsWithChildren<{ language: Language }>) {
  const [preview, setPreview] = useState<Language | null>(null);
  return (
    <LanguageContext.Provider value={{ language: preview ?? language, setPreview }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext).language;
}

export function selectCopy(spanish: boolean, es: string, en: string): string {
  return spanish ? es : en;
}

export function useTranslation() {
  return getTranslation(useLanguage());
}

export function useLanguagePreview() {
  return useContext(LanguageContext).setPreview;
}
