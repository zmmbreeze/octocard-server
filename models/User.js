
/**
 * User model.
 */

var github = require('octonode');
var mongoose = require('mongoose');
var winston = require('winston');
var nconf = require('nconf');
var Schema = mongoose.Schema;

var ttl = nconf.get('dataTTL');

var userSchema = new Schema({
    login: { type: String, index: true},
    token: { type: String, index: true},
    userData: {
        data: Schema.Types.Mixed,
        saveTime: { type: Date, 'default': Date.now }
    },
    reposData: {
        data: [Schema.Types.Mixed],
        saveTime: { type: Date, 'default': Date.now }
    },
    orgsData: {
        data: [Schema.Types.Mixed],
        saveTime: { type: Date, 'default': Date.now }
    },
    eventsData: {
        latest: [Schema.Types.Mixed],
        statistics: [{ date: Date, count: Number }],
        saveTime: { type: Date, 'default': Date.now }
    }
});

/**
 * find user instance by loginname.
 *
 * @param {string} loginName .
 * @param {Function} cb callback .
 */
userSchema.statics.findByLogin = function (loginName, cb) {
    this.findOne({login: loginName}, function (err, user) {
        if (err) {
            winston.error(err.message);
            cb(err);
            return;
        }

        cb(err, user);
    });
};

/**
 * create user instance by github token, if not existed.
 *
 * @param {string} token .
 * @param {Function} cb callback .
 */
userSchema.statics.createByToken = function (token, cb) {
    this.findOne({token: token}, function (err, user) {
        if (err) {
            winston.error(err.message);
            cb(err);
            return;
        }

        if (user) {
            // already existed
            cb(err, user);
            return;
        }

        // not exist, get new user info from github
        var client = github.client(token);
        client.me().info(function (err, data) {
            if (err) {
                winston.error(err.message);
                cb(err);
                return;
            }

            var user = new User({
                login: data.login,
                token: token,
                userData: {
                    data: data
                }
            });
            user.save(function (err) {
                if (err) {
                    winston.error(err.message);
                }
                cb(err, user);
            });
        });
    });
};

/**
 * Get user info by login name.
 *
 * @param {string} loginName .
 * @param {Function} cb callback .
 */
userSchema.statics.getUserData = function (loginName, cb) {
    var that = this;
    this.findOne({login: loginName}, function (err, user) {
        if (err) {
            winston.error(err.message);
            cb(err);
            return;
        }

        var userData = user.userData;
        if (userData &&
            userData.saveTime &&
            (Date.now() - ttl > userData.saveTime)) {
            // use cache from mongodb
            cb(null, userData.data);
        }

        // update data
        updateUserData(user, function (err, user) {
            if (err) {
                // if has userData when get error
                // use cache
                if (userData && userData.data) {
                    cb(null, userData.data);
                } else {
                    cb(err);
                }
                return;
            }
            cb(null, user.userData.data);
        });
    });
};

/**
 * Update user info by login name.
 *
 * @param {User} user.
 * @param {Function} cb callback .
 */
var updateUserData = function (user, cb) {
    var client = github.client(user.token);
    client.me().info(function (err, data) {
        if (err) {
            winston.error(err.message);
            cb(err);
            return;
        }

        user.userData = {
            data: data,
            saveTime: Date.now()
        };
        user.save(function (err) {
            if (err) {
                winston.error(err.message);
                cb(err);
                return;
            }
            cb(err, user);
        });
    });
};


var User = module.exports = mongoose.model('User', userSchema);
