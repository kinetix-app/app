import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LanguageProvider } from '@/i18n/Language';
import { NutritionSummary, PortionNutritionPreview } from '../components/NutritionSummary';

const values = { calories: 1234.5, carbohydrates: 20, protein: 10, fats: 5 };

test('shows translated macro names and Spanish number formatting', () => {
  render(
    <LanguageProvider language="es">
      <NutritionSummary values={values} precision={1} />
      <PortionNutritionPreview values={values} factor={1} portion="Por ración" />
    </LanguageProvider>,
  );
  expect(screen.getByLabelText('Carbohidratos')).toBeTruthy();
  expect(screen.getByText('Proteínas')).toBeTruthy();
  expect(screen.getByText('1234,5 kcal')).toBeTruthy();
});
