import { getTranslation, type TranslationKey } from '@/i18n/catalog';
import type { Language } from '@/i18n/Language';

const catalogueKeys: Readonly<Record<string, TranslationKey>> = {
  arms: 'trainingCatalogue.arms',
  back: 'trainingCatalogue.back',
  'lower arms': 'trainingCatalogue.lower_arms',
  'lower legs': 'trainingCatalogue.lower_legs',
  'upper arms': 'trainingCatalogue.upper_arms',
  'upper legs': 'trainingCatalogue.upper_legs',
  chest: 'trainingCatalogue.chest',
  shoulders: 'trainingCatalogue.shoulders',
  legs: 'trainingCatalogue.legs',
  neck: 'trainingCatalogue.neck',
  waist: 'trainingCatalogue.waist',
  cardio: 'trainingCatalogue.cardio',
  abs: 'trainingCatalogue.abs',
  abductors: 'trainingCatalogue.abductors',
  adductors: 'trainingCatalogue.adductors',
  biceps: 'trainingCatalogue.biceps',
  calves: 'trainingCatalogue.calves',
  delts: 'trainingCatalogue.delts',
  forearms: 'trainingCatalogue.forearms',
  glutes: 'trainingCatalogue.glutes',
  hamstrings: 'trainingCatalogue.hamstrings',
  lats: 'trainingCatalogue.lats',
  pectorals: 'trainingCatalogue.pectorals',
  quads: 'trainingCatalogue.quads',
  quadriceps: 'trainingCatalogue.quadriceps',
  traps: 'trainingCatalogue.traps',
  triceps: 'trainingCatalogue.triceps',
  'upper back': 'trainingCatalogue.upper_back',
  spine: 'trainingCatalogue.spine',
  'body weight': 'trainingCatalogue.body_weight',
  band: 'trainingCatalogue.band',
  barbell: 'trainingCatalogue.barbell',
  'bosu ball': 'trainingCatalogue.bosu_ball',
  cable: 'trainingCatalogue.cable',
  dumbbell: 'trainingCatalogue.dumbbell',
  'ez barbell': 'trainingCatalogue.ez_barbell',
  kettlebell: 'trainingCatalogue.kettlebell',
  'leverage machine': 'trainingCatalogue.leverage_machine',
  'medicine ball': 'trainingCatalogue.medicine_ball',
  'resistance band': 'trainingCatalogue.resistance_band',
  roller: 'trainingCatalogue.roller',
  rope: 'trainingCatalogue.rope',
  'smith machine': 'trainingCatalogue.smith_machine',
  'stability ball': 'trainingCatalogue.stability_ball',
  'stationary bike': 'trainingCatalogue.stationary_bike',
  treadmill: 'trainingCatalogue.treadmill',
  weighted: 'trainingCatalogue.weighted',
  wheel: 'trainingCatalogue.wheel',
};

export function catalogueLabel(value: string, language: Language): string {
  if (language === 'en') return value;
  const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  const messageKey = Object.hasOwn(catalogueKeys, key) ? catalogueKeys[key] : undefined;
  return messageKey ? getTranslation(language)(messageKey) : value;
}
