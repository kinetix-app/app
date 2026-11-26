import { createInstance } from 'i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import type { Language } from './Language';

type LeafKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafKeys<T[K]>}`;
}[keyof T & string];
type RawKey = LeafKeys<typeof en>;
export type TranslationKey =
  | RawKey
  | (RawKey extends infer K
      ? K extends `${infer Base}_one` | `${infer Base}_other`
        ? Base
        : never
      : never);
export type TranslationOptions = Record<string, string | number | undefined> & { count?: number };

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export function getTranslation(language: Language) {
  const translate = i18n.getFixedT(language);
  return (key: TranslationKey, options?: TranslationOptions) => translate(key, options ?? {});
}
