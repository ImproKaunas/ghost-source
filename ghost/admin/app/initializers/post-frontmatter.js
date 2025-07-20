import Post from 'ghost-admin/models/post';
import { attr } from '@ember-data/model';

// Reopen the post model to add frontmatter attribute.
// It is returned by the API, but not used by the Post model and therefore dropped.
export default {
  initialize: () => {
    Post.reopen({
      frontmatter: attr()
    });
  }
};