const assert = require('assert/strict');
const ObjectId = require('bson-objectid').default;
const {agentProvider, fixtureManager} = require('../../../../utils/e2e-framework');
const DataGenerator = require('../../../../utils/fixtures/data-generator');
const models = require('../../../../../core/server/models');
const knex = require('../../../../../core/server/data/db').knex;
const service = require('../../../../../core/frontend/apps/rsvp/service');
const constants = require('../../../../../core/frontend/apps/rsvp/constants');

async function createPost(data = {}) {
    const post = DataGenerator.forKnex.createPost({email_recipient_filter: 'all', ...data});
    await knex('posts').insert(post);
    return models.Post.findOne({id: post.id});
}

async function tagAsRsvp(post) {
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
}

async function setFrontmatter(post, frontmatter) {
    await knex('posts_meta').insert({
        id: ObjectId().toHexString(),
        post_id: post.id,
        frontmatter
    });
}

async function createMember(email) {
    const added = await models.Member.add({email, name: email.split('@')[0], email_disabled: false});
    const member = await models.Member.findOne({id: added.id}, {withRelated: ['labels']});
    return member.toJSON();
}

async function reloadMember(id) {
    const member = await models.Member.findOne({id}, {withRelated: ['labels']});
    return member.toJSON();
}

describe('RSVP Service', function () {
    beforeAll(async function () {
        await agentProvider.getAdminAPIAgent();
        await fixtureManager.init();
    });

    describe('getLabel', function () {
        it('creates the label when it does not exist and finds it afterwards', async function () {
            const created = await service.getLabel('rsvp:some-event');
            assert.ok(created.id);

            const found = await service.getLabel('rsvp:some-event');
            assert.equal(found.id, created.id);

            const count = await knex('labels').where('name', 'rsvp:some-event').count('id as count').first();
            assert.equal(count.count, 1);
        });
    });

    describe('label membership roundtrip', function () {
        it('addLabel/hasLabel/getRsvpCount/removeLabel work against the real DB', async function () {
            const label = await service.getLabel('rsvp:roundtrip-event');
            let member = await createMember('roundtrip@example.com');

            assert.equal(await service.hasLabel(member, label), false);
            assert.equal(Number(await service.getRsvpCount(label)), 0);

            assert.equal(await service.addLabel(member, label), true);
            member = await reloadMember(member.id);
            assert.equal(await service.hasLabel(member, label), true);
            assert.equal(Number(await service.getRsvpCount(label)), 1);

            assert.equal(await service.removeLabel(member, label), true);
            member = await reloadMember(member.id);
            assert.equal(await service.hasLabel(member, label), false);
            assert.equal(Number(await service.getRsvpCount(label)), 0);
        });

        it('counts each member once and only for the given label', async function () {
            const label = await service.getLabel('rsvp:count-event');
            const otherLabel = await service.getLabel('rsvp:other-event');
            const first = await createMember('count-1@example.com');
            const second = await createMember('count-2@example.com');

            await service.addLabel(first, label);
            await service.addLabel(second, otherLabel);

            assert.equal(Number(await service.getRsvpCount(label)), 1);
            assert.equal(Number(await service.getRsvpCount(otherLabel)), 1);
        });
    });

    describe('isRsvpEnabled', function () {
        it('is true for posts tagged #rsvp and false otherwise', async function () {
            const rsvpPost = await createPost({slug: 'rsvp-enabled-post'});
            await tagAsRsvp(rsvpPost);
            const plainPost = await createPost({slug: 'plain-post'});

            assert.equal(await service.isRsvpEnabled(rsvpPost), true);
            assert.equal(await service.isRsvpEnabled(plainPost), false);
        });
    });

    describe('getRsvpSettings', function () {
        it('returns defaults when the post has no frontmatter', async function () {
            const post = await createPost({slug: 'no-frontmatter-post'});

            const settings = await service.getRsvpSettings(post);
            assert.deepEqual(settings, {
                capacity: -1,
                label: `${constants.LABEL_PREFIX}no-frontmatter-post`
            });
        });

        it('merges rsvp frontmatter over the defaults', async function () {
            const post = await createPost({slug: 'frontmatter-post'});
            await setFrontmatter(post, JSON.stringify({rsvp: {capacity: 12}}));

            const settings = await service.getRsvpSettings(post);
            assert.deepEqual(settings, {
                capacity: 12,
                label: `${constants.LABEL_PREFIX}frontmatter-post`
            });
        });

        it('falls back to defaults on malformed frontmatter JSON', async function () {
            const post = await createPost({slug: 'broken-frontmatter-post'});
            await setFrontmatter(post, '{not valid json');

            const settings = await service.getRsvpSettings(post);
            assert.deepEqual(settings, {
                capacity: -1,
                label: `${constants.LABEL_PREFIX}broken-frontmatter-post`
            });
        });
    });
});
