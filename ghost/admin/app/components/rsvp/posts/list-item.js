import PostsListItem from 'ghost-admin/components/posts-list/list-item';

export default class RsvpPostsListItem extends PostsListItem {

    // Get non #rsvp tags
    get getTags() {
        return (this.args.post.tags || []).filter(tag => tag.slug !== 'hash-rsvp');
    }

    get hasTags() {
        return this.getTags.length > 0;
    }
}
