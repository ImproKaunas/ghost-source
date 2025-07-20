import PostsRoute from 'ghost-admin/routes/posts';

export default class RsvpPostsRoute extends PostsRoute {
    async model(params) {
        
        // Always filter by tag:hash-rsvp
        const newParams = { ...params, tag: 'hash-rsvp' };
        return super.model(newParams);
    }
}
