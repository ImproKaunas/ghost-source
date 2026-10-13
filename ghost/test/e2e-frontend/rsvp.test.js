const assert = require('assert/strict');
const supertest = require('supertest');
const ObjectId = require('bson-objectid').default;
const {agentProvider, fixtureManager} = require('../utils/e2e-framework');
const DataGenerator = require('../utils/fixtures/data-generator');
const models = require('../../core/server/models');
const knex = require('../../core/server/data/db').knex;

async function createRsvpPost(slug, frontmatter = null) {
    const post = DataGenerator.forKnex.createPost({
        slug,
        status: 'published',
        email_recipient_filter: 'all'
    });
    await knex('posts').insert(post);

    let tag = await models.Tag.findOne({slug: 'hash-rsvp'});
    if (!tag) {
        tag = await models.Tag.add({name: '#rsvp'});
    }
    await knex('posts_tags').insert({
        id: ObjectId().toHexString(),
        post_id: post.id,
        tag_id: tag.id,
        sort_order: 0
    });

    if (frontmatter) {
        await knex('posts_meta').insert({
            id: ObjectId().toHexString(),
            post_id: post.id,
            frontmatter
        });
    }

    return post;
}

describe('RSVP frontend routes', function () {
    let membersAgent;
    let site;
    let memberCookie;

    beforeAll(async function () {
        membersAgent = await agentProvider.getMembersAPIAgent();
        await fixtureManager.init('members');
        site = supertest.agent(membersAgent.app);
        memberCookie = await membersAgent.loginAs('rsvp-member@example.com');
    });

    it('rejects requests without a member session', async function () {
        const res = await site.get('/rsvp/whatever/');
        assert.equal(res.status, 401);
        assert.equal(res.body.error, 'Unauthorized');
    });

    it('404s for posts that are not rsvp-enabled', async function () {
        const res = await site.get('/rsvp/no-such-event/').set('Cookie', memberCookie);
        assert.equal(res.status, 404);
        assert.equal(res.body.error, 'Not found');
    });

    it('supports the full rsvp add/remove flow', async function () {
        await createRsvpPost('e2e-event');

        let res = await site.get('/rsvp/e2e-event/').set('Cookie', memberCookie);
        assert.equal(res.status, 200);
        assert.equal(res.body.rsvp, false);
        assert.equal(res.body.event.slug, 'e2e-event');
        assert.deepEqual(res.body.event.capacity, {isLimited: false, isFull: false});
        assert.equal(res.body.member.email, 'rsvp-member@example.com');

        res = await site.post('/rsvp/e2e-event/').set('Cookie', memberCookie);
        assert.equal(res.status, 200);
        assert.equal(res.body.rsvp, true);

        // idempotent second add
        res = await site.post('/rsvp/e2e-event/').set('Cookie', memberCookie);
        assert.equal(res.status, 200);
        assert.equal(res.body.rsvp, true);

        const label = await models.Label.findOne({name: 'rsvp:e2e-event'});
        assert.ok(label, 'rsvp label should have been created');
        const count = await knex('members_labels').where('label_id', label.id).count('id as c').first();
        assert.equal(Number(count.c), 1);

        res = await site.delete('/rsvp/e2e-event/').set('Cookie', memberCookie);
        assert.equal(res.status, 200);
        assert.equal(res.body.rsvp, false);

        const after = await knex('members_labels').where('label_id', label.id).count('id as c').first();
        assert.equal(Number(after.c), 0);
    });

    it('enforces capacity from frontmatter', async function () {
        await createRsvpPost('e2e-full-event', JSON.stringify({rsvp: {capacity: 1}}));

        // another member takes the only spot
        const otherCookie = await membersAgent.loginAs('rsvp-other@example.com');
        let res = await site.post('/rsvp/e2e-full-event/').set('Cookie', otherCookie);
        assert.equal(res.status, 200);
        assert.equal(res.body.rsvp, true);

        res = await site.get('/rsvp/e2e-full-event/').set('Cookie', memberCookie);
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.event.capacity, {isLimited: true, isFull: true});

        res = await site.post('/rsvp/e2e-full-event/').set('Cookie', memberCookie);
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'Capacity reached');
    });
});
