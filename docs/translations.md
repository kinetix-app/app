# Application translations

The saved account profile determines the interface language. English is the default before sign-in and when an older account response omits a language. The bundled English and Spanish catalogs are in `src/i18n/locales/`. Provide both languages for new or changed UI copy, including accessible names and feedback.

Use `useTranslation()` in components or `getTranslation(language)` in pure helpers. Pass the language code, not a boolean indicating a particular language. For example:

```tsx
const t = useTranslation();
<Text>{t('navigation.home')}</Text>;
```

Messages may use named interpolation, for example `t('feed.minAgo', { minutes })` with `{{minutes}}` in each catalog. For a plural, define `message_one` and `message_other` in both catalogs and pass a numeric `count` to `t('message', { count })`.

Map known server codes to catalog keys for display. Preserve the original codes in API requests and retain the original display value for unknown catalogue values. Never translate user-authored content. Keep interpolation variables aligned across languages and test both languages, feedback, accessibility and text wrapping.

Adding a language also requires registering its catalog, accepting its code in the application and account API, exposing it in the profile selector, and testing its plural rules and layouts. Some existing screens still contain English/Spanish branches and must be migrated before a third language is supported throughout the app.
