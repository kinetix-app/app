import { apiClient } from '@/services/apiClient';
import {
  commentInputSchema,
  commentPageSchema,
  commentSchema,
  likeSchema,
  mediaPathSchema,
  postPageSchema,
  postSchema,
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
  /** Null posts without a workout; they then need a caption or a photo. */
  trainingSessionId: number | null;
  text: string;
  visibility: PostVisibility;
  photos: readonly PostPhoto[];
}>;

export function buildPostForm(input: PostInput) {
  const form = new FormData();
  if (input.trainingSessionId !== null)
    form.append('training_session_id', String(input.trainingSessionId));
  form.append('text', input.text.trim());
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

export const feedApi = {
  posts: (
    beforeId: number | null,
    signal?: AbortSignal,
    scope: 'everyone' | 'friends' = 'friends',
  ) =>
    apiClient.get(
      `/api/v1/posts?limit=10&scope=${scope}${beforeId ? `&before_id=${beforeId}` : ''}`,
      {
        schema: postPageSchema,
        signal,
      },
    ),
  create: (input: PostInput, signal?: AbortSignal) =>
    apiClient.postMultipart('/api/v1/posts', buildPostForm(input), { schema: postSchema, signal }),
  remove: (postId: number) => apiClient.delete(`/api/v1/posts/${postId}`),
  like: (postId: number, liked: boolean) =>
    liked
      ? apiClient.put(`/api/v1/posts/${postId}/like`, undefined, { schema: likeSchema })
      : apiClient.delete(`/api/v1/posts/${postId}/like`, { schema: likeSchema }),
  comments: (postId: number, afterId: number | null, signal?: AbortSignal) =>
    apiClient.get(
      `/api/v1/posts/${postId}/comments?limit=30${afterId ? `&after_id=${afterId}` : ''}`,
      { schema: commentPageSchema, signal },
    ),
  addComment: (postId: number, comment: string) =>
    apiClient.post(`/api/v1/posts/${postId}/comments`, commentInputSchema.parse({ comment }), {
      schema: commentSchema,
    }),
  removeComment: (postId: number, commentId: number) =>
    apiClient.delete(`/api/v1/posts/${postId}/comments/${commentId}`),
  media: (path: string, signal?: AbortSignal) =>
    apiClient.getBlob(mediaPathSchema.parse(path), { signal }),
};
