/*jshint laxbreak:true */

/**
 * User model.
 */

var Q = require('q');
var github = require('octonode');
var mongoose = require('mongoose');
var winston = require('winston');
var nconf = require('nconf');
var Schema = mongoose.Schema;

// all data's time to live
var ttl = nconf.get('dataTTL');

// user schema
var userSchema = new Schema({
    login: { type: String, index: true },
    token: { type: String, index: true },
    // basic user info
    userData: {
        data: Schema.Types.Mixed,
        saveTime: { type: Date, 'default': null }
    },
    // repos data
    reposData: {
        data: [Schema.Types.Mixed],
        saveTime: { type: Date, 'default': null }
    },
    // orgnization data
    orgsData: {
        data: [Schema.Types.Mixed],
        saveTime: { type: Date, 'default': null }
    },
    // events statistics data
    eventsStatisData: {
        data: [{ date: Date, counter: Number }],
        saveTime: { type: Date, 'default': null }
    }
});

/**
 * find user instance by loginname.
 *
 * @param {string} loginName .
 * @return {Object} promise .
 */
userSchema.statics.findByLogin = function (loginName) {
    return Q.ninvoke(this, 'findOne', {login: loginName})
        .then(function (user) {
            if (!user) {
                throw new Error('Login name not found. '
                                + 'Please sign up Github Card first.');
            }

            return user;
        });
};

/**
 * Create user instance by github token, if not existed.
 *
 * @param {string} token .
 * @return {Object} promise .
 */
userSchema.statics.createByToken = function (token) {
    var that = this;
    return Q.ninvoke(this, 'findOne', {token: token})
        .then(function (user) {
            if (user) {
                // already existed
                return user;
            }

            // not exist, get new user info from github
            var ghme = github.client(token).me();
            return Q.ninvoke(ghme, 'info')
                .then(function (data) {
                    var user = new User({
                        login: data.login,
                        token: token,
                        userData: {
                            data: data,
                            saveTime: Date.now()
                        }
                    });

                    return Q.ninvoke(user, 'save');
                })
                .spread(function (user) {
                    // get other data
                    // to make server response faster
                    var loginName = user.login;
                    that.getReposData();
                    that.getOrgsData();
                    that.getEventsStatisData();
                    return user;
                });
        });
};

var githubApi = {
    /**
     * Get all events data by login name and token.
     *
     * @param {string} token .
     * @param {string} loginName .
     * @return {Object} promise
     */
    getAllEventsData: function (token, loginName) {
        var page = 1;
        var results = [];
        /**
         * concat array without create new array
         * but src array will become useless.
         * @param {Array} a target array.
         * @param {Array} b src array.
         */
        var concatArray = function (a, b) {
            b.unshift(0);
            b.unshift(a.length);
            Array.prototype.splice.apply(a, b);
        };

        // get all events data
        // github event api only can get 300 latest events.
        function getAllEvents() {
            var apiUrl = '/users/' + loginName + '/events';
            return Q.ninvoke(github.client(token), 'get', apiUrl, page)
                .spread(function (status, events, header) {
                    concatArray(results, events);

                    var link = header.link;
                    // if has next page
                    if (~link.indexOf('rel="next"')) {
                        page++;
                        return getAllEvents();
                    } else {
                        return results;
                    }
                });
        }

        return getAllEvents();
    },
    /**
     * Get user info by token
     *
     * @param {string} token .
     * @return {Object} promise .
     */
    getUserData: function (token) {
        return Q.ninvoke(github.client(token).me(), 'info');
    },
    /**
     * Get user's repo info by token
     *
     * @param {string} token .
     * @return {Object} promise .
     */
    getReposData: function (token) {
        return Q.ninvoke(github.client(token).me(), 'repos');
    },
    /**
     * Get user's orgs info by token
     *
     * @param {string} token .
     * @return {Object} promise .
     */
    getOrgsData: function (token) {
        return Q.ninvoke(github.client(token).me(), 'orgs');
    }
};

// cache all github api
// merge all request to one, if they are in the almost same time
// to save request resource and github api rate limit
// NOTE: all api method's first param must be token string
for (var method in githubApi) {
    githubApi[method] = (function (oldApi) {
        var promises = {};
        return function(token) {
            if (promises[token]) {
                // use processing request
                return promises[token];
            }

            // do request
            promises[token] = oldApi.apply(githubApi, arguments)
                .then(function (data) {
                    promises[token] = null;
                    return data;
                });
            return promises[token];
        };
    })(githubApi[method]);
}

/**
 * Get user info by login name.
 *
 * @param {string} loginName .
 * @return {Object} promise
 */
userSchema.statics.getUserData = function (loginName) {
    return this.findByLogin(loginName)
        .then(function (user) {
            var userData = user.userData;
            if (userData &&
                userData.saveTime &&
                (Date.now() < (userData.saveTime.getTime() + ttl))) {
                // use cache from mongodb
                return userData.data;
            }

            var promise = githubApi.getUserData(user.token)
                .then(function (data) {
                    user.userData = {
                        data: data,
                        saveTime: Date.now()
                    };
                    return Q.ninvoke(user, 'save');
                })
                .spread(function (user) {
                    return user.userData.data;
                });

            if (userData && userData.data && userData.saveTime) {
                // use old orgsData if exist
                return userData.data;
            } else {
                // no data, use promise
                return promise;
            }
        });
};

/**
 * Get repos info by login name.
 *
 * @param {string} loginName .
 * @return {Object} promise
 */
userSchema.statics.getReposData = function (loginName) {
    return this.findByLogin(loginName)
        .then(function (user) {
            var reposData = user.reposData;
            if (reposData &&
                reposData.saveTime &&
                (Date.now() < (reposData.saveTime.getTime() + ttl))) {
                // use cache from mongodb
                return reposData.data;
            }

            // if cache outof time
            // get the newest data
            var promise = githubApi.getReposData(user.token)
                .then(function (data) {
                    user.reposData = {
                        data: data,
                        saveTime: Date.now()
                    };
                    return Q.ninvoke(user, 'save');
                })
                .spread(function (user) {
                    return user.reposData.data;
                });

            if (reposData && reposData.data && reposData.saveTime) {
                // use old orgsData if exist
                return reposData.data;
            } else {
                // no data, use promise
                return promise;
            }
        });
};

/**
 * Get orgnizations info by login name.
 *
 * @param {string} loginName .
 * @return {Object} promise
 */
userSchema.statics.getOrgsData = function (loginName) {
    return this.findByLogin(loginName)
        .then(function (user) {
            var orgsData = user.orgsData;
            if (orgsData &&
                orgsData.saveTime &&
                (Date.now() < (orgsData.saveTime.getTime() + ttl))) {
                // use cache from mongodb
                return orgsData.data;
            }

            // if cache outof time
            // get the newest data
            var promise = githubApi.getOrgsData(user.token)
                .then(function (data) {
                    user.orgsData = {
                        data: data,
                        saveTime: Date.now()
                    };
                    return Q.ninvoke(user, 'save');
                })
                .spread(function (user) {
                    return user.orgsData.data;
                });

            if (orgsData && orgsData.data && orgsData.saveTime) {
                // use old orgsData if exist
                return orgsData.data;
            } else {
                // no data, use promise
                return promise;
            }
        });
};


/**
 * Get 300 latest events statistic info by login name.
 *
 * @param {string} loginName .
 * @return {Object} promise
 */
userSchema.statics.getEventsStatisData = function (loginName) {
    return this.findByLogin(loginName)
        .then(function (user) {
            var eventsStatisData = user.eventsStatisData;
            if (eventsStatisData &&
                eventsStatisData.saveTime &&
                (Date.now() < (eventsStatisData.saveTime.getTime() + ttl))) {
                // use cache from mongodb
                return eventsStatisData.data;
            }

            // if cache outof time
            // get the newest data
            var promise = githubApi.getAllEventsData(user.token, loginName)
                .then(function (events) {
                    // count statistic
                    var statisData = {};
                    events.forEach(function (event) {
                        var eventDate = new Date(event.created_at);
                        var dateStr = eventDate.toDateString();
                        if (statisData[dateStr]) {
                            statisData[dateStr].counter++;
                        } else {
                            // first counter
                            statisData[dateStr] = {
                                date: eventDate,
                                counter: 1
                            };
                        }
                    });

                    // change map to array
                    var statisDataArray = [];
                    for (var key in statisData) {
                        statisDataArray.push(statisData[key]);
                    }

                    user.eventsStatisData = {
                        data: statisDataArray,
                        saveTime: Date.now()
                    };
                    return Q.ninvoke(user, 'save');
                })
                .spread(function (user) {
                    return user.eventsStatisData.data;
                });

            if (eventsStatisData
                && eventsStatisData.data
                && eventsStatisData.saveTime) {
                // use old eventsStatisData if exist
                return eventsStatisData.data;
            } else {
                // no data, use promise
                return promise;
            }
        });
};


var User = module.exports = mongoose.model('User', userSchema);


