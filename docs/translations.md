# Application translations

The profile supports the language codes `en` and `es`, defaulting to English when an older account response omits the field. The authenticated profile owns the selection; saving it updates localized screens and reloads restore it. Translation coverage is being expanded across the remaining screens. Catalogue values remain server-owned: translate known codes for display, retain the original value for filters and requests, and show unknown values unchanged. Never translate user-authored content.

For every new or changed user-facing string, provide both English and Spanish, including accessibility labels, validation, empty, loading, error and success states. Use `useLanguage()` from `src/i18n/Language.tsx` for language-dependent presentation. Keep code values separate from labels. Exercise both languages in relevant tests and check text wrapping in supported layouts. Use the English fallback before authentication or when the profile predates the language field.

# Traducciones de la aplicación

El perfil admite los códigos de idioma `en` y `es` en el perfil; el inglés es el valor predeterminado cuando una respuesta antigua no incluye el campo. La selección pertenece al perfil autenticado: al guardarla cambia el idioma de las pantallas traducidas y se recupera al volver a cargar. La cobertura de traducción se está ampliando al resto de pantallas. Los valores del catálogo pertenecen al servidor: traduce los códigos conocidos para mostrarlos, conserva el valor original para filtros y peticiones, y muestra los valores desconocidos sin cambios. No traduzcas contenido creado por usuarios.

Cada texto nuevo o modificado debe incluir inglés y español, también las etiquetas de accesibilidad, validaciones y estados vacíos, de carga, error y éxito. Usa `useLanguage()` de `src/i18n/Language.tsx` para la presentación según el idioma. Mantén los códigos separados de las etiquetas. Comprueba ambos idiomas en las pruebas correspondientes y revisa el ajuste del texto en las interfaces compatibles. Antes de la autenticación o si el perfil es anterior a este campo, se usa inglés.
