const logging = require('@tryghost/logging');
const models = require('../../../server/models');
const constants = require('./constants');
const knex = require('../../../server/data/db').knex;

/**
 * Find or create a label
 */
async function getLabel(labelName) {
    // @ts-ignore
    let label = await models.Label.findOne({name: labelName});
    if (!label) {
        // @ts-ignore
        label = await models.Label.add({
            name: labelName,
            created_by: 'system'
        });
    }
    return label;
}

/**
 * Check if member has a label
 */
async function hasLabel(member, label) {

    const id = label.id;

    try {
        const labels = member.labels || (member.related ? member.related('labels') : []);
        // Support both Bookshelf model and plain object with labels array
        if (Array.isArray(labels)) {
            // If labels is an array of objects (plain or Bookshelf models)
            return labels.some(l => {
                if (typeof l.get === 'function') {
                    return l.get('id') === id;
                }
                return l.id === id;
            });
        }
        return false;
    } catch (error) {
        logging.error(`Error checking if member has label ${label.id}:`, error);
        return false;
    }
}

/**
 * Add a label to a member
 */
async function addLabel(member, label) {

    try {
        // @ts-ignore
        await models.Member.edit({
            labels: [...member.labels, label.toJSON()]
        }, { id: member.id });
        return true
    } catch(e) {
        console.error(e);
        return false;
    }
}

/**
 * Remove a label from a member
 */
async function removeLabel(member, label) {

    const id = label.id;
    try {
        // @ts-ignore
        await models.Member.edit({
            labels: member.labels.filter(l => l.id !== id)
        }, { id: member.id });
        return true;
    } catch(e) {
        console.error(e);
        return false;
    }
}

/**
 * Check if RSVP functionality is enabled for a post
 */
async function isRsvpEnabled(post) {
    const result = await knex('posts_tags')
        .join('tags', 'posts_tags.tag_id', 'tags.id')
        .where('posts_tags.post_id', post.id)
        .andWhere('tags.slug', 'hash-rsvp')
        .count('tags.id as count')
        .first();

    const count = typeof result?.count === 'string' ? parseInt(result.count, 10) : result?.count;
    return count > 0;
}
/**
 * Get RSVP settings for a post
 */
async function getRsvpSettings(post) {

    const defaults = {
        capacity: -1,
        label: `${constants.LABEL_PREFIX}${post.get('slug')}`
    }

    const data = await knex('posts_meta')
        .select('frontmatter')
        .where('post_id', post.id)
        .first();

    if (data && data.frontmatter) {
        try {
            return {
                ...defaults,
                ...(JSON.parse(data.frontmatter).rsvp || {})
            };
        } catch (error) {
            logging.error(`Error parsing frontmatter JSON in post ${post.id}:`, error);
            return defaults;
        }
    } else {
        logging.error(`Unable to get frontmatter for post ${post.id}`);
        return defaults;
    }
}

/**
 * Get the number of RSVPs
 */
async function getRsvpCount(label) {
    const result = await knex('members_labels')
        .where('label_id', label.id)
        .count('member_id as count')
        .first();

    return result && result.count ? result.count : 0;
}

module.exports = {
    isRsvpEnabled,
    getRsvpSettings,
    getRsvpCount,
    getLabel,
    hasLabel,
    addLabel,
    removeLabel
}; 