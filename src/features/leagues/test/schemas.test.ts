import { createSchema, invitationToken, leagueDetailSchema } from '../schemas';

describe('league input and responses', () => {
  it('requires a valid timezone and nonempty name', () => {
    expect(createSchema.safeParse({ name: '  ', timezone: 'UTC' }).success).toBe(false);
    expect(createSchema.safeParse({ name: 'Friends', timezone: 'not/a-zone' }).success).toBe(false);
    expect(createSchema.parse({ name: ' Friends ', timezone: 'Europe/Madrid' }).name).toBe(
      'Friends',
    );
  });
  it('accepts either a shared link or a token', () => {
    expect(invitationToken('kinetix://league-invitation/abc123')).toBe('abc123');
    expect(invitationToken(' abc123 ')).toBe('abc123');
  });
  it('accepts legacy null membership fields', () => {
    expect(
      leagueDetailSchema.safeParse({
        id: 1,
        name: 'Friends',
        timezone: null,
        role: null,
        created_at: '2026-01-01',
        members: [{ user_id: 1, display_name: 'A', role: 'admin', joined_at: null }],
      }).success,
    ).toBe(true);
  });
});
