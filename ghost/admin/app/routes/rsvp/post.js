import AuthenticatedRoute from 'ghost-admin/routes/authenticated';
const { slugify } = require('@tryghost/string');

export default class RsvpPostRoute extends AuthenticatedRoute {
    async model(params) {
        const post = await this.store.findRecord('post', params.id, {
            include: 'posts_meta'
        });

        try {
            post.frontmatter = {
                rsvp: {},
                ...JSON.parse(post.frontmatter)
            };
        } catch (error) {
            post.frontmatter = { rsvp: {} };
        }

        const label = slugify((post.frontmatter.rsvp.label || `rsvp:${post.slug}`));
        const members = await this.store.query('member', {
            filter: `label:'${label}'`,
            limit: 'all'
        });

        return { post, members }
    }
}