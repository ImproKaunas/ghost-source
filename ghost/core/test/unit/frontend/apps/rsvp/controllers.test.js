const should = require('should');
const sinon = require('sinon');
const service = require('../../../../../core/frontend/apps/rsvp/service');
const controllers = require('../../../../../core/frontend/apps/rsvp/controllers');
const constants = require('../../../../../core/frontend/apps/rsvp/constants');
const models = require('../../../../../core/server/models');

describe('RSVP Controllers', function () {
    let req;
    let res;
    let label;
    let feedbackAddStub;

    before(function () {
        models.init();
    });

    beforeEach(function () {
        label = {id: 'label-1', toJSON: () => ({id: 'label-1', name: 'rsvp-my-event'})};

        req = {
            post: {
                id: 'post-1',
                get: sinon.stub().callsFake((key) => {
                    return {title: 'My Event', slug: 'my-event'}[key];
                })
            },
            member: {
                id: 'member-1',
                email: 'member@example.com',
                labels: []
            }
        };

        res = {
            status: sinon.stub().callsFake(() => res),
            json: sinon.stub()
        };

        sinon.stub(service, 'getRsvpSettings').resolves({capacity: -1, label: 'rsvp-my-event'});
        sinon.stub(service, 'getLabel').resolves(label);
        sinon.stub(service, 'hasLabel').resolves(false);
        sinon.stub(service, 'getRsvpCount').resolves(0);
        sinon.stub(service, 'addLabel').resolves(true);
        sinon.stub(service, 'removeLabel').resolves(true);

        feedbackAddStub = sinon.stub(models.MemberFeedback, 'add').resolves({});
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('getRsvp', function () {
        it('returns event info and rsvp status for member without rsvp', async function () {
            await controllers.getRsvp(req, res);

            sinon.assert.calledOnce(res.json);
            const body = res.json.firstCall.args[0];
            body.should.eql({
                event: {
                    id: 'post-1',
                    title: 'My Event',
                    slug: 'my-event',
                    capacity: {isLimited: false, isFull: false}
                },
                member: {email: 'member@example.com'},
                rsvp: false
            });
        });

        it('returns rsvp true when member has the label', async function () {
            service.hasLabel.resolves(true);

            await controllers.getRsvp(req, res);

            res.json.firstCall.args[0].rsvp.should.be.true();
        });

        it('reports full capacity for limited events at capacity', async function () {
            service.getRsvpSettings.resolves({capacity: 2, label: 'rsvp-my-event'});
            service.getRsvpCount.resolves(2);

            await controllers.getRsvp(req, res);

            res.json.firstCall.args[0].event.capacity.should.eql({isLimited: true, isFull: true});
        });

        it('reports not full for limited events under capacity', async function () {
            service.getRsvpSettings.resolves({capacity: 5, label: 'rsvp-my-event'});
            service.getRsvpCount.resolves(2);

            await controllers.getRsvp(req, res);

            res.json.firstCall.args[0].event.capacity.should.eql({isLimited: true, isFull: false});
        });
    });

    describe('addRsvp', function () {
        it('adds the label and records feedback', async function () {
            await controllers.addRsvp(req, res);

            sinon.assert.calledOnceWithExactly(service.addLabel, req.member, label);
            sinon.assert.calledOnce(feedbackAddStub);
            feedbackAddStub.firstCall.args[0].should.match({
                member_id: 'member-1',
                post_id: 'post-1',
                score: constants.FEEDBACK_SCORE.RSVP_ADDED
            });
            res.json.firstCall.args[0].rsvp.should.be.true();
        });

        it('is idempotent when member already has an rsvp', async function () {
            service.hasLabel.resolves(true);

            await controllers.addRsvp(req, res);

            sinon.assert.notCalled(service.addLabel);
            sinon.assert.notCalled(feedbackAddStub);
            res.json.firstCall.args[0].rsvp.should.be.true();
        });

        it('rejects with 400 when the event is full', async function () {
            service.getRsvpSettings.resolves({capacity: 1, label: 'rsvp-my-event'});
            service.getRsvpCount.resolves(1);

            await controllers.addRsvp(req, res);

            sinon.assert.calledOnceWithExactly(res.status, 400);
            sinon.assert.notCalled(service.addLabel);
            res.json.firstCall.args[0].error.should.equal('Capacity reached');
        });

        it('allows rsvp when limited event has free spots', async function () {
            service.getRsvpSettings.resolves({capacity: 5, label: 'rsvp-my-event'});
            service.getRsvpCount.resolves(4);

            await controllers.addRsvp(req, res);

            sinon.assert.calledOnce(service.addLabel);
            res.json.firstCall.args[0].rsvp.should.be.true();
        });

        it('responds with 500 when adding the label fails', async function () {
            service.addLabel.resolves(false);

            await controllers.addRsvp(req, res);

            sinon.assert.calledOnceWithExactly(res.status, 500);
            res.json.firstCall.args[0].error.should.equal('Server error');
        });

        it('still succeeds when feedback recording fails', async function () {
            feedbackAddStub.rejects(new Error('feedback boom'));
            sinon.stub(console, 'error');

            await controllers.addRsvp(req, res);

            sinon.assert.neverCalledWith(res.status, 500);
            res.json.firstCall.args[0].rsvp.should.be.true();
        });
    });

    describe('removeRsvp', function () {
        beforeEach(function () {
            service.hasLabel.resolves(true);
        });

        it('removes the label and records feedback', async function () {
            await controllers.removeRsvp(req, res);

            sinon.assert.calledOnceWithExactly(service.removeLabel, req.member, label);
            sinon.assert.calledOnce(feedbackAddStub);
            feedbackAddStub.firstCall.args[0].should.match({
                member_id: 'member-1',
                post_id: 'post-1',
                score: constants.FEEDBACK_SCORE.RSVP_REMOVED
            });
            res.json.firstCall.args[0].rsvp.should.be.false();
        });

        it('is idempotent when member has no rsvp', async function () {
            service.hasLabel.resolves(false);

            await controllers.removeRsvp(req, res);

            sinon.assert.notCalled(service.removeLabel);
            sinon.assert.notCalled(feedbackAddStub);
            res.json.firstCall.args[0].rsvp.should.be.false();
        });

        it('responds with 500 when removal and re-add both fail', async function () {
            service.removeLabel.resolves(false);
            service.addLabel.resolves(false);

            await controllers.removeRsvp(req, res);

            sinon.assert.calledOnceWithExactly(res.status, 500);
            res.json.firstCall.args[0].error.should.equal('Server error');
        });

        it('still succeeds when feedback recording fails', async function () {
            feedbackAddStub.rejects(new Error('feedback boom'));
            sinon.stub(console, 'error');

            await controllers.removeRsvp(req, res);

            sinon.assert.neverCalledWith(res.status, 500);
            res.json.firstCall.args[0].rsvp.should.be.false();
        });
    });
});
