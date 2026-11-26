import React, { createContext, useContext } from 'react';

export type Language = 'en' | 'es';
const LanguageContext = createContext<Language>('en');

export function LanguageProvider({
  language,
  children,
}: React.PropsWithChildren<{ language: Language }>) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
