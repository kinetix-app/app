import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LanguageProvider } from '@/i18n/Language';
import { ConsentScreen } from '../components/ConsentScreen';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));

test('shows camera consent and denial guidance in Spanish', () => {
  render(
    <LanguageProvider language="es">
      <ConsentScreen
        supportedNames={[]}
        denied
        onAllow={jest.fn()}
        onOpenSettings={jest.fn()}
        onClose={jest.fn()}
      />
    </LanguageProvider>,
  );
  expect(screen.getByText('Revisa tu técnica')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Abrir ajustes' })).toBeTruthy();
  expect(screen.getByText(/El acceso a la cámara está desactivado/)).toBeTruthy();
});
