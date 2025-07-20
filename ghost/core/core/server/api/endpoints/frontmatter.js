const models = require('../../models');
const errors = require('@tryghost/errors');

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: 'frontmatter',

    edit: {
        headers: {
            cacheInvalidate: false
        },
        options: [
            'id'
        ],
        data: [
            'frontmatter'
        ],
        validation: {
            options: {
                id: { required: true }
            }
        },
        permissions: {
            docName: 'posts',
            method: 'edit'
        },
        async query(frame) {
            await models.Post.edit({
                id: frame.options.id,
                posts_meta: {
                    frontmatter: frame.data.frontmatter
                }
            }, {
                withRelated: ['posts_meta'],
                id: frame.options.id
            });
        }
    }
};

module.exports = controller; 