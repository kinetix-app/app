import i18next from 'i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import type { Language } from './Language';

type LeafKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafKeys<T[K]>}`;
}[keyof T & string];
export type TranslationKey = LeafKeys<typeof en>;

const i18n = i18next.createInstance();
void i18n.init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export function getTranslation(language: Language) {
  const translate = i18n.getFixedT(language);
  return (key: TranslationKey) => translate(key);
}
