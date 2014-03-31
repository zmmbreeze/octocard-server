/*jshint laxbreak:true */

/**
 * User model.
 */

var Q = require('q');
var github = require('octonode');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var helper = require('../helper/helper');

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
    // repos in user's orgnization
    orgsReposData: {
        data: [Schema.Types.Mixed],
        saveTime: { type: Date, 'default': null}
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
                                + 'Please sign up Octocard.');
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
                .spread(function (data) {
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
     * @param {User} user .
     * @return {Object} promise
     */
    getAllEventsData: function (user) {
        var apiUrl = '/users/' + user.login + '/events';

        return helper.getAllGithubData(user.token, apiUrl)
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
    },
    /**
     * Get user info by token
     *
     * @param {User} user .
     * @return {Object} promise .
     */
    getUserData: function (user) {
        return Q.ninvoke(github.client(user.token).me(), 'info')
            .spread(function (data) {
                user.userData = {
                    data: data,
                    saveTime: Date.now()
                };
                return Q.ninvoke(user, 'save');
            })
            .spread(function (user) {
                return user.userData.data;
            });
    },
    /**
     * Get user's repo info by token
     *
     * @param {User} user .
     * @return {Object} promise .
     */
    getReposData: function (user) {
        var apiUrl = '/users/' + user.login + '/repos';

        return helper.getAllGithubData(user.token, apiUrl)
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
    },
    /**
     * Get user's orgs info by token
     *
     * @param {User} user .
     * @return {Object} promise .
     */
    getOrgsData: function (user) {
        return Q.ninvoke(github.client(user.token).me(), 'orgs')
            .spread(function (data) {
                user.orgsData = {
                    data: data,
                    saveTime: Date.now()
                };
                return Q.ninvoke(user, 'save');
            })
            .spread(function (user) {
                return user.orgsData.data;
            });
    },
    /**
     * Get user's org's repos, which he can push.
     *
     * @param {User} user .
     * @return {Object} promise .
     */
    getOrgsReposData: function (user) {
        // get all org's repos.
        function getOrgsRepos(orgs) {
            var promises = [];
            orgs.forEach(function (org) {
                promises.push(
                    helper.getAllGithubData(
                        user.token,
                        '/orgs/' + org.login + '/repos'
                    )
                );
            });

            return Q.all(promises)
                .then(function (orgsRepos) {
                    // put repos into one array.
                    var repos = [];
                    orgsRepos.forEach(function (orgRepos) {
                        orgRepos.forEach(function (repo) {
                            if (repo.permissions.push) {
                                repos.push(repo);
                            }
                        });
                    });

                    user.orgsReposData = {
                        data: repos,
                        saveTime: Date.now()
                    };

                    return Q.ninvoke(user, 'save');
                })
                .spread(function (user) {
                    return user.orgsReposData.data;
                });
        }

        if (!user.orgsData) {
            var orgs = user.orgsData.data;
            return getOrgsRepos(orgs);
        }
        else {
            return githubApi.getOrgsData(user)
                .then(getOrgsRepos);
        }
    }
};

// cache all github api
// merge all request to one, if they are in the almost same time
// to save request resource and github api rate limit
// NOTE: all api method's first param must be token string
for (var method in githubApi) {
    githubApi[method] = (function (oldApi) {
        var promises = {};
        return function(user) {
            var token = user.token;
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
            if (!helper.isOutofDate(userData)) {
                // use cache from mongodb
                return userData.data;
            }

            var promise = githubApi.getUserData(user);

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
            var promise;
            var promises = [];
            var reposData = user.reposData;
            if (!helper.isOutofDate(reposData)) {
                promises.push(
                    Q.fcall(function () {
                        // use cache from mongodb
                        return reposData.data;
                    })
                );
            }
            else {
                // get the newest data
                promise = githubApi.getReposData(user);

                if (reposData && reposData.data && reposData.saveTime) {
                    // still use cache if exist
                    promise = Q.fcall(function () {
                        return reposData.data;
                    });
                }
                promises.push(promise);
            }

            var orgsReposData = user.orgsReposData;
            if (!helper.isOutofDate(orgsReposData)) {
                promises.push(
                    Q.fcall(function () {
                        // use cache from mongodb
                        return orgsReposData.data;
                    })
                );
            }
            else {
                // get the newest data
                promise = githubApi.getOrgsReposData(user);

                if (orgsReposData
                    && orgsReposData.data
                    && orgsReposData.saveTime) {
                    // still use cache if exist
                    promise = Q.fcall(function () {
                        return orgsReposData.data;
                    });
                }
                promises.push(promise);
            }

            return Q.all(promises);
        })
        .spread(function (repos, orgRepos) {
            helper.concatArray(repos, orgRepos);
            return repos;
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
            if (!helper.isOutofDate(orgsData)) {
                // use cache from mongodb
                return orgsData.data;
            }

            // if cache outof time
            // get the newest data
            var promise = githubApi.getOrgsData(user);

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
            if (!helper.isOutofDate(eventsStatisData)) {
                // use cache from mongodb
                return eventsStatisData.data;
            }

            // if cache outof time
            // get the newest data
            var promise = githubApi.getAllEventsData(user);

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
User.githubApi = githubApi;


