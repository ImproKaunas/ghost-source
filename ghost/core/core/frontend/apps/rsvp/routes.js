const membersService = require('../../../server/services/members');
const controller = require('./controllers');
const models = require('../../../server/models');
const service = require('./service');

function validateMember(req, res, next) {
    if (!req.member) {
        return res.status(401);
    }
    next();
}

async function validatePost(req, res, next) {
    // @ts-ignore
    const post = await models.Post.findOne({
        slug: req.params.slug
    });

    if (!post || !await service.isRsvpEnabled(post)) {
        return res.status(404).json({
            error: 'Not found',
            message: 'Event not found.'
        });
    }

    req.post = post;
    next();
}

function registerRoutes(siteApp) {

    siteApp.get('/rsvp/:slug', 
        membersService.middleware.loadMemberSession,
        validateMember,
        validatePost,
        controller.getRsvp
    );

    siteApp.post('/rsvp/:slug',
        membersService.middleware.loadMemberSession,
        validateMember,
        validatePost,
        controller.addRsvp
    );

    siteApp.delete('/rsvp/:slug',
        membersService.middleware.loadMemberSession,
        validateMember,
        validatePost,
        controller.removeRsvp
    );
}

module.exports = registerRoutes;