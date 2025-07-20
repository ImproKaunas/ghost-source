const path = require('path');
const express = require('express');
const config = require('../../../shared/config');
const logging = require('@tryghost/logging');

module.exports = {
    activate: () => {
        logging.info('Static app server activated');
    },
    setupMiddleware: siteApp => {
        siteApp.use('/apps', express.static(
            path.join(
                config.get('paths').publicFilePath,
                'apps'
            )
        ));
    },
};