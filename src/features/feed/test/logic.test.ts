import { ApiError } from '@/services/apiClient';
import { formatWorkoutVolume } from '@/features/training/workoutFormat';
import { buildPostForm } from '../api';
import { shareErrorMessage } from '../components/ShareWorkoutScreen';
import { duration, relativeTime, setLine, authorName } from '../format';
import { mediaPathSchema, postPageSchema, postSchema } from '../schemas';
import { makePost } from './fixtures';

test('formats workout totals without losing explicit units', () => {
  expect(duration(2700)).toBe('45 min');
  expect(duration(3600)).toBe('1 h');
  expect(duration(5460)).toBe('1 h 31 min');
  expect(formatWorkoutVolume('1312.50')).toBe('1,312.5 kg');
  expect(formatWorkoutVolume('1234567.00')).toBe('1,234,567 kg');
  expect(formatWorkoutVolume('0.00')).toBe('0 kg');
  expect(formatWorkoutVolume()).toBe('—');
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

test('post form carries the workout, trimmed caption and description, visibility and repeated files', () => {
  const file = new Blob(['web'], { type: 'image/png' });
  const form = buildPostForm({
    trainingSessionId: 7,
    caption: '  Great session  ',
    description: '  Improved my squat.  ',
    visibility: 'PRIVATE',
    photos: [
      { uri: 'blob:web', name: 'web.png', type: 'image/png', file },
      { uri: 'file:///native.jpg', name: 'native.jpg', type: 'image/jpeg' },
    ],
  });
  expect(form.get('training_session_id')).toBe('7');
  expect(form.get('caption')).toBe('Great session');
  expect(form.get('description')).toBe('Improved my squat.');
  expect(form.get('visibility')).toBe('PRIVATE');
  expect(form.getAll('files')).toHaveLength(2);
});

test('older feed responses keep legacy text and fall back to the Training session title', () => {
  const post = makePost();
  const parsed = postSchema.parse({
    ...post,
    caption: undefined,
    description: undefined,
    text: 'Legacy post text',
    workout: { ...post.workout, title: undefined },
  });
  expect(parsed.caption).toBe('');
  expect(parsed.description).toBe('Legacy post text');
  expect(parsed.workout?.title).toBe('Training session');
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
    caption: '',
    description: 'Hi',
    visibility: 'PUBLIC',
    photos: [],
  });
  expect(form.get('training_session_id')).toBeNull();
  expect(form.get('caption')).toBe('');
  expect(form.get('description')).toBe('Hi');
});

test('set lines show what was recorded without float rounding', () => {
  const set = { reps: null, weight_kg: null, duration_seconds: null, distance_km: null };
  expect(setLine({ ...set, reps: 8, weight_kg: '100.000000' })).toBe('8 reps × 100 kg');
  expect(setLine({ ...set, reps: 1, weight_kg: '62.50' })).toBe('1 rep × 62.5 kg');
  expect(setLine({ ...set, reps: 12, weight_kg: '0.00' })).toBe('12 reps');
  expect(setLine({ ...set, duration_seconds: 45 })).toBe('45 s');
  expect(setLine({ ...set, distance_km: '2.50', duration_seconds: 720 })).toBe('2.5 km in 12 min');
  expect(setLine(set)).toBe('Done');
});

test('share errors explain what to change', () => {
  const message = (status: number) => shareErrorMessage(new ApiError(status));
  expect(message(409)).toMatch(/already shared/);
  expect(message(413)).toMatch(/too large/);
  expect(message(415)).toMatch(/JPEG, PNG or WebP/);
  expect(message(422)).toMatch(/caption, description, photo or workout/);
  expect(message(503)).toMatch(/unavailable/);
  expect(message(401)).toMatch(/Sign out/);
  expect(message(500)).toMatch(/Try again/);
  expect(shareErrorMessage(new Error('offline'))).toMatch(
    /caption, description and photos are kept/,
  );
});
