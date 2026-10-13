const assert = require('node:assert/strict');
const sinon = require('sinon');
const registerRoutes = require('../../../../../core/frontend/apps/rsvp/routes');
const service = require('../../../../../core/frontend/apps/rsvp/service');
const models = require('../../../../../core/server/models');

describe('RSVP Routes', function () {
    let siteApp;

    beforeEach(function () {
        siteApp = {
            get: sinon.spy(),
            post: sinon.spy(),
            delete: sinon.spy()
        };
        registerRoutes(siteApp);
    });

    afterEach(function () {
        sinon.restore();
    });

    it('registers GET, POST and DELETE handlers on /rsvp/:slug', function () {
        for (const method of ['get', 'post', 'delete']) {
            sinon.assert.calledOnce(siteApp[method]);
            assert.equal(siteApp[method].firstCall.args[0], '/rsvp/:slug');
            // member session loader + member guard + post guard + controller
            assert.equal(siteApp[method].firstCall.args.length, 5);
        }
    });

    describe('member validation middleware', function () {
        function getValidateMember() {
            // args: [path, loadMemberSession, validateMember, validatePost, controller]
            return siteApp.get.firstCall.args[2];
        }

        it('responds 401 and stops the chain without a member', function () {
            const res = {
                status: sinon.stub().callsFake(() => res),
                json: sinon.stub()
            };
            const next = sinon.spy();

            getValidateMember()({}, res, next);

            sinon.assert.calledOnceWithExactly(res.status, 401);
            assert.equal(res.json.firstCall.args[0].error, 'Unauthorized');
            sinon.assert.notCalled(next);
        });

        it('calls next when a member session exists', function () {
            const res = {status: sinon.stub()};
            const next = sinon.spy();

            getValidateMember()({member: {id: 'member-1'}}, res, next);

            sinon.assert.calledOnce(next);
            sinon.assert.notCalled(res.status);
        });
    });

    describe('post validation middleware', function () {
        function getValidatePost() {
            return siteApp.get.firstCall.args[3];
        }

        let res;
        let next;

        beforeEach(function () {
            res = {
                status: sinon.stub().callsFake(() => res),
                json: sinon.stub()
            };
            next = sinon.spy();
        });

        it('responds 404 when the post does not exist', async function () {
            sinon.stub(models.Post, 'findOne').resolves(null);

            await getValidatePost()({params: {slug: 'nope'}}, res, next);

            sinon.assert.calledOnceWithExactly(res.status, 404);
            assert.equal(res.json.firstCall.args[0].error, 'Not found');
            sinon.assert.notCalled(next);
        });

        it('responds 404 when the post has no rsvp tag', async function () {
            sinon.stub(models.Post, 'findOne').resolves({id: 'post-1'});
            sinon.stub(service, 'isRsvpEnabled').resolves(false);

            await getValidatePost()({params: {slug: 'my-event'}}, res, next);

            sinon.assert.calledOnceWithExactly(res.status, 404);
            sinon.assert.notCalled(next);
        });

        it('attaches the post and calls next for rsvp-enabled posts', async function () {
            const post = {id: 'post-1'};
            sinon.stub(models.Post, 'findOne').resolves(post);
            sinon.stub(service, 'isRsvpEnabled').resolves(true);
            const req = {params: {slug: 'my-event'}};

            await getValidatePost()(req, res, next);

            assert.equal(req.post, post);
            sinon.assert.calledOnce(next);
            sinon.assert.notCalled(res.status);
        });
    });
});
