import type { Account } from '../schemas';
export const completeAccount: Account = {
  id: 1,
  status: 'active',
  created_at: '2026-10-14T12:00:00Z',
  onboarding: { profile_complete: true, objective_selected: true, required: false },
  profile: {
    display_name: 'Alice',
    timezone: null,
    age: 25,
    height_cm: '170.00',
    weight_kg: '70.000000',
    measurement_system: 'metric',
    picture_url: null,
    updated_at: '2026-10-14T12:00:00Z',
  },
};
export const incompleteAccount: Account = {
  ...completeAccount,
  onboarding: { profile_complete: false, objective_selected: false, required: true },
  profile: {
    ...completeAccount.profile,
    display_name: null,
    age: null,
    height_cm: null,
    weight_kg: null,
    measurement_system: null,
  },
};
