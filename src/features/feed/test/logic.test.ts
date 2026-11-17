import { buildPostForm } from '../api';
import { duration, exerciseLine, relativeTime, volume, authorName } from '../format';
import { mediaPathSchema, postPageSchema } from '../schemas';
import { makePost } from './fixtures';

test('formats workout totals without losing explicit units', () => {
  expect(duration(2700)).toBe('45 min');
  expect(duration(3600)).toBe('1 h');
  expect(duration(5460)).toBe('1 h 31 min');
  expect(volume('1312.50')).toBe('1,312.5 kg');
  expect(volume('1234567.00')).toBe('1,234,567 kg');
  expect(volume('0.00')).toBe('0 kg');
  expect(exerciseLine(['A', 'B'])).toBe('A · B');
  expect(exerciseLine(['A', 'B', 'C', 'D', 'E'])).toBe('A · B · C · +2 more');
  expect(authorName(null)).toBe('Kinetix athlete');
  expect(authorName('  ')).toBe('Kinetix athlete');
});

test('relative time stays readable across ranges', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  expect(relativeTime('2026-11-10T11:59:30Z', now)).toBe('Just now');
  expect(relativeTime('2026-11-10T11:15:00Z', now)).toBe('45 min ago');
  expect(relativeTime('2026-11-10T07:00:00Z', now)).toBe('5 h ago');
  expect(relativeTime('2026-11-08T12:00:00Z', now)).toBe('2 d ago');
  expect(relativeTime('2026-10-01T12:00:00Z', now)).toBe('Oct 1');
});

test('post form carries the workout, trimmed caption, visibility and repeated files', () => {
  const file = new Blob(['web'], { type: 'image/png' });
  const form = buildPostForm({
    trainingSessionId: 7,
    text: '  Great session  ',
    visibility: 'PRIVATE',
    photos: [
      { uri: 'blob:web', name: 'web.png', type: 'image/png', file },
      { uri: 'file:///native.jpg', name: 'native.jpg', type: 'image/jpeg' },
    ],
  });
  expect(form.get('training_session_id')).toBe('7');
  expect(form.get('text')).toBe('Great session');
  expect(form.get('visibility')).toBe('PRIVATE');
  expect(form.getAll('files')).toHaveLength(2);
});

test('only authenticated post media paths are accepted from the server', () => {
  expect(mediaPathSchema.safeParse('/api/v1/posts/1/media/2').success).toBe(true);
  for (const path of [
    'https://evil.example/x.jpg',
    '/api/v1/me/profile/picture',
    '/api/v1/posts/1/media/2?x=1',
  ])
    expect(mediaPathSchema.safeParse(path).success).toBe(false);
  const page = { items: [makePost({ media: [{ id: 1, type: 'IMAGE', order: 1, url: '//x' }] })] };
  expect(postPageSchema.safeParse({ ...page, next_before_id: null }).success).toBe(false);
});

test('a post without a workout omits the workout field', () => {
  const form = buildPostForm({
    trainingSessionId: null,
    text: 'Hi',
    visibility: 'PUBLIC',
    photos: [],
  });
  expect(form.get('training_session_id')).toBeNull();
  expect(form.get('text')).toBe('Hi');
});
