import { apiClient } from '@/services/apiClient';
import {
  commentInputSchema,
  commentPageSchema,
  commentSchema,
  likeSchema,
  mediaPathSchema,
  postPageSchema,
  postSchema,
  workoutDetailSchema,
  workoutOptionsSchema,
  workoutTemplateSchema,
  type PostVisibility,
} from './schemas';

/** A picked photo: a web File, or a native file URI that fetch uploads itself. */
export type PostPhoto = Readonly<{
  uri: string;
  name: string;
  type: string;
  file?: Blob;
}>;

export type PostInput = Readonly<{
  /** A post without a workout needs a caption, description or photo. */
  trainingSessionId: number | null;
  caption: string;
  description: string;
  visibility: PostVisibility;
  photos: readonly PostPhoto[];
}>;

export function buildPostForm(input: PostInput) {
  const form = new FormData();
  if (input.trainingSessionId !== null)
    form.append('training_session_id', String(input.trainingSessionId));
  form.append('caption', input.caption.trim());
  form.append('description', input.description.trim());
  form.append('visibility', input.visibility);
  for (const photo of input.photos) {
    if (photo.file) form.append('files', photo.file, photo.name);
    else
      form.append('files', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as unknown as Blob);
  }
  return form;
}

/** Optional cursor query parameter, e.g. "&before_id=42"; empty when there is none. */
function cursor(name: string, value: number | null) {
  return value ? `&${name}=${value}` : '';
}

export const feedApi = {
  posts: (
    beforeId: number | null,
    signal?: AbortSignal,
    scope: 'everyone' | 'friends' = 'friends',
  ) =>
    apiClient.get(`/api/v1/posts?limit=10&scope=${scope}` + cursor('before_id', beforeId), {
      schema: postPageSchema,
      signal,
    }),
  create: (input: PostInput, signal?: AbortSignal) =>
    apiClient.postMultipart('/api/v1/posts', buildPostForm(input), { schema: postSchema, signal }),
  workout: (postId: number, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/posts/${postId}/workout`, { schema: workoutDetailSchema, signal }),
  workoutOptions: (selectedSessionId: number | null, signal?: AbortSignal) =>
    apiClient.get(
      '/api/v1/posts/workout-options' +
        (selectedSessionId === null ? '' : `?selected_session_id=${selectedSessionId}`),
      { schema: workoutOptionsSchema, signal },
    ),
  workoutTemplate: (postId: number) =>
    apiClient.get(`/api/v1/posts/${postId}/workout-template`, { schema: workoutTemplateSchema }),
  remove: (postId: number) => apiClient.delete(`/api/v1/posts/${postId}`),
  like: (postId: number, liked: boolean) =>
    liked
      ? apiClient.put(`/api/v1/posts/${postId}/like`, undefined, { schema: likeSchema })
      : apiClient.delete(`/api/v1/posts/${postId}/like`, { schema: likeSchema }),
  comments: (postId: number, afterId: number | null, signal?: AbortSignal) =>
    apiClient.get(`/api/v1/posts/${postId}/comments?limit=30` + cursor('after_id', afterId), {
      schema: commentPageSchema,
      signal,
    }),
  addComment: (postId: number, comment: string) =>
    apiClient.post(`/api/v1/posts/${postId}/comments`, commentInputSchema.parse({ comment }), {
      schema: commentSchema,
    }),
  removeComment: (postId: number, commentId: number) =>
    apiClient.delete(`/api/v1/posts/${postId}/comments/${commentId}`),
  media: (path: string, signal?: AbortSignal) =>
    apiClient.getBlob(mediaPathSchema.parse(path), { signal }),
};
