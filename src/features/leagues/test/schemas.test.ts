import {
  createSchema,
  invitationToken,
  leagueDetailSchema,
  leaguePicturePathSchema,
  memberPictureSchema,
  leagueListItemSchema,
} from '../schemas';

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

test('private league and member images only accept their protected relative paths or existing HTTPS member pictures', () => {
  expect(leaguePicturePathSchema.safeParse('/api/v1/leagues/9/picture?v=abc-123').success).toBe(
    true,
  );
  expect(leaguePicturePathSchema.safeParse('https://example.com/image.jpg').success).toBe(false);
  expect(memberPictureSchema.safeParse('/api/v1/leagues/9/members/1/picture?v=abc').success).toBe(
    true,
  );
  expect(memberPictureSchema.safeParse('/api/v1/me/profile/picture').success).toBe(false);
  expect(memberPictureSchema.safeParse('http://example.com/image.jpg').success).toBe(false);
});

test('list summaries require valid weekly rank and member count without changing detail responses', () => {
  const summary = {
    id: 1,
    name: 'Friends',
    timezone: 'Europe/Madrid',
    role: 'member',
    picture_url: null,
    member_count: 8,
    current_week_position: 2,
  };
  expect(leagueListItemSchema.parse(summary).current_week_position).toBe(2);
  expect(leagueListItemSchema.safeParse({ ...summary, current_week_position: null }).success).toBe(
    true,
  );
  expect(leagueListItemSchema.safeParse({ ...summary, current_week_position: 0 }).success).toBe(
    false,
  );
  expect(leagueListItemSchema.safeParse({ ...summary, member_count: -1 }).success).toBe(false);
  expect(leagueListItemSchema.safeParse({ ...summary, member_count: undefined }).success).toBe(
    false,
  );
});
