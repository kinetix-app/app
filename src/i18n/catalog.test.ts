import en from './locales/en.json';
import es from './locales/es.json';
import { getTranslation } from './catalog';

function leaves(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof child === 'string'
        ? [[path, child]]
        : Object.entries(leaves(child as Record<string, unknown>, path));
    }),
  );
}

test('catalogs have matching keys and interpolation variables', () => {
  const english = leaves(en);
  const spanish = leaves(es);
  expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
  for (const key of Object.keys(english)) {
    const variables = (message: string) =>
      [...message.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();
    expect(variables(spanish[key])).toEqual(variables(english[key]));
  }
});

test('uses the selected language', () => {
  expect(getTranslation('en')('navigation.home')).toBe('Feed');
  expect(getTranslation('es')('navigation.home')).toBe('Inicio');
  expect(getTranslation(false)('navigation.home')).toBe('Feed');
  expect(getTranslation(true)('navigation.home')).toBe('Inicio');
  // @ts-expect-error Unknown keys must fail type checking.
  if (false) getTranslation('en')('navigation.misspelled');
});
