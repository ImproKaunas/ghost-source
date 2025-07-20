const service = require('./service');
const logging = require('@tryghost/logging');
const models = require('../../../server/models');   
const constants = require('./constants');

async function getRsvp(req, res) {

    const settings = await service.getRsvpSettings(req.post);
    const label = await service.getLabel(settings.label);
    const status = await service.hasLabel(req.member, label);

    const isLimited = settings.capacity !== -1;
    const isFull = isLimited ?
        await service.getRsvpCount(label) >= settings.capacity :
        false;

    res.json({
        event: {
            id: req.post.id,
            title: req.post.get('title'),
            slug: req.post.get('slug'),
            capacity: {
                isLimited, 
                isFull
            }
        },
        member: {
            email: req.member.email,
        },
        rsvp: status
    });
}

async function addRsvp(req, res) {
    const settings = await service.getRsvpSettings(req.post);
    const label = await service.getLabel(settings.label);
    const status = await service.hasLabel(req.member, label);

    if (!status) {

        if (settings.capacity !== -1) {
            const count = await service.getRsvpCount(label);
            if (count >= settings.capacity) {
                return res.status(400).json({
                    error: 'Capacity reached',
                    message: 'Event is full.'
                });
            }
        }

        if (!await service.addLabel(req.member, label)) {
            return res.status(500).json({
                error: 'Server error',
                message: 'Unable to add RSVP response.'
            });
        }

        try {
            // @ts-ignore
            await models.MemberFeedback.add({
                member_id: req.member.id,
                post_id: req.post.id,
                score: constants.FEEDBACK_SCORE.RSVP_ADDED,
                created_at: new Date()
            });
        } catch(e) {
            console.error('Error adding feedback', e);
        }
    }

    res.json({
        event: {
            id: req.post.id,
            title: req.post.get('title'),
            slug: req.post.get('slug'),
            capacity: {
                isLimited: settings.capacity !== -1,
                isFull: settings.capacity !== -1 && await service.getRsvpCount(label) >= settings.capacity
            }
        },
        member: {
            email: req.member.email,
        },
        rsvp: true
    });
}

async function removeRsvp(req, res) {
    const settings = await service.getRsvpSettings(req.post);
    const label = await service.getLabel(settings.label);
    const status = await service.hasLabel(req.member, label);

    if (status) {
        
        if (!await service.removeLabel(req.member, label)) {
            if (!await service.addLabel(req.member, label)) {
                return res.status(500).json({
                    error: 'Server error',
                    message: 'Unable to remove RSVP response.'
                });
            }
        }

        try {
        // @ts-ignore
            await models.MemberFeedback.add({
                member_id: req.member.id,
                post_id: req.post.id,
                score: constants.FEEDBACK_SCORE.RSVP_REMOVED,
                created_at: new Date()
            });
        } catch(e) {
            console.error('Error adding feedback', e);
        }   
    }

    res.json({
        event: {
            id: req.post.id,
            title: req.post.get('title'),
            slug: req.post.get('slug'),
            capacity: {
                isLimited: settings.capacity !== -1,
                isFull: settings.capacity !== -1 && await service.getRsvpCount(label) >= settings.capacity
            }
        },
        member: {
            email: req.member.email,
        },
        rsvp: false
    });
}

module.exports = {
    getRsvp,
    addRsvp,
    removeRsvp,
}; 