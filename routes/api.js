/*jshint laxbreak:true */

/*
 * GET api url.
 */

var Q = require('q');
var User = require('../models/User');
var winston = require('winston');

// usefule data keys map
var usefulDataKeysMap = {
    base: [
        'login', 'name', 'avatar_url', 'html_url',
        'followers', 'following', 'public_gists',
        'bio', 'email', 'blog', 'location', 'company'
    ],
    repos: ['name', 'html_url', 'description', 'watchers_count'],
    orgs: ['login', 'avatar_url'],
    eventsStatis: ['date', 'counter']
};
/**
 * filter data, only remains the useful key
 *
 * @param {string} moduleName .
 * @param {Array|Object} data .
 * @return {Array|Object} filtered data.
 */
var filterData = function (moduleName, data) {
    var obj;

    if (!Array.isArray(data)) {
        // object
        obj = {};
        usefulDataKeysMap[moduleName].forEach(function (key) {
            obj[key] = data[key];
        });
    } else {
        // array
        obj = data.map(function (o) {
            return filterData(moduleName, o);
        });
    }

    return obj;
};

/**
 * generate callback to deal with get*Data function error.
 *
 * @param {Object} data .
 * @return {Function} callback.
 */
var rejectGetDataError = function (data) {
    return function (err) {
        winston.error(err.message);
        data.success = false;
        data.message = err.message;
        throw err;
    };
};

/**
 * Get basic data.
 * Use github api: '/user/loginName'
 *
 * @param {string} loginName loginName.
 * @param {Object} data .
 */
var getBaseData = function (loginName, data) {
    if (data.success && !data.data.base) {
        data.data.base = true;
        return User.getUserData(loginName)
            .then(function (d) {
                data.data.base = d
                    ? filterData('base', d)
                    : {};
            })
            .fail(rejectGetDataError(data));
    } else {
        return;
    }
};

var getDataFuncMap = {
    base: getBaseData,
    details: getBaseData,
    stats: getBaseData,
    repos: function (loginName, data) {
        return User.getReposData(loginName)
            .then(function (d) {
                data.data.repos = d
                    ? filterData('repos', d)
                    : [];
            })
            .fail(rejectGetDataError(data));
    },
    orgs: function (loginName, data) {
        return User.getOrgsData(loginName)
            .then(function (d) {
                data.data.orgs = d
                    ? filterData('orgs', d)
                    : [];
            })
            .fail(rejectGetDataError(data));
    },
    eventsStatis: function (loginName, data) {
        return User.getEventsStatisData(loginName)
            .then(function (d) {
                data.data.eventsStatis = d
                    ? filterData('eventsStatis', d)
                    : [];
            })
            .fail(rejectGetDataError(data));
    }
};

module.exports = function (app) {
    app.get('/api', function (req, res) {
        res.type('application/javascript');

        var loginName = req.query.login;
        var mods = req.query.mods;
        // check params
        if (!loginName || !mods) {
            res.jsonp({
                success: false,
                message: '`login` or `mods` query not found.'
            });
        }

        // init
        mods = mods.split(',');
        var data = {
            success: true,
            data: {}
        };

        // start get needed data
        var getDataPromises = mods.map(function (mod) {
            var getData = getDataFuncMap[mod];
            if (getData) {
                return getData(loginName, data);
            }
        });
        Q.all(getDataPromises)
            .done(function () {
                res.jsonp(data);
            });
    });
};
