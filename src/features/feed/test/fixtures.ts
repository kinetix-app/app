import type { Post } from '../schemas';

export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 10,
    caption: '',
    description: 'Leg day done',
    visibility: 'PUBLIC',
    type: 'SESSION',
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    author: { id: 2, display_name: 'Bob', has_picture: false },
    workout: {
      session_id: 7,
      title: 'Strength A',
      activity_type: 'gym',
      started_at: '2026-11-09T16:00:00Z',
      ended_at: '2026-11-09T16:45:00Z',
      duration_seconds: 2700,
      exercise_count: 2,
      set_count: 3,
      total_reps: 23,
      total_volume_kg: '1312.50',
      exercises: ['Bench press', 'Squat'],
    },
    media: [],
    like_count: 2,
    comment_count: 0,
    liked_by_me: false,
    is_mine: false,
    ...overrides,
  };
}
