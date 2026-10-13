import { slugify } from '@tryghost/string';
import type { Post } from '@tryghost/admin-x-framework/api/posts';

/**
 * RSVP data model (local fork feature): event posts are tagged #rsvp and keep
 * their settings as JSON in `posts_meta.frontmatter` under the `rsvp` key.
 * The API flattens posts_meta onto the post resource, so every post read and
 * browse response carries `frontmatter` even though the framework's Post type
 * does not declare it.
 */
export type RsvpPost = Post & { frontmatter?: string | null };

export interface RsvpSettings {
  /** Maximum attendees; unset means unlimited. */
  capacity?: number | string;
  /** Member label naming attendees; unset means the default `rsvp:<slug>`. */
  label?: string;
}

export function parseRsvpSettings(post: RsvpPost): RsvpSettings {
  try {
    const frontmatter = JSON.parse(post.frontmatter || '{}') as { rsvp?: RsvpSettings };
    return { ...frontmatter.rsvp };
  } catch {
    return {};
  }
}

/**
 * The attendee label's slug, for member queries. Registrations go by label
 * NAME (`rsvp:<post-slug>` unless overridden), but the members API filters by
 * label SLUG, and Ghost never regenerates a label's slug — so this must match
 * how Ghost slugified the name when the label was first created.
 */
export function rsvpLabelSlug(post: RsvpPost): string {
  return slugify(parseRsvpSettings(post).label || `rsvp:${post.slug}`);
}
