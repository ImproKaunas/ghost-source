const logging = require('@tryghost/logging');
const registerRoutes = require('./routes');

module.exports = {

    activate: () => {
        logging.info('RSVP frontend app activated');
    },

    setupMiddleware: (siteApp) => {
        registerRoutes(siteApp);
    }
};