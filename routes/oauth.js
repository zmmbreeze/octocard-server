/*jshint laxbreak:true */

/*
 * GET login / auth page.
 */

var Q = require('q');
var nconf = require('nconf');
var github = require('octonode');
var User = require('../models/User');
var winston = require('winston');

var oauth = {};
var redirectUri = nconf.get('redirect_uri');
if (redirectUri) {
    redirectUri = encodeURIComponent(redirectUri);
}

oauth.login = function(req, res) {
    if (req.session.loginName) {
        // if has session.loginName, logined
        res.redirect(302, '/');
        return;
    }
    // oauth login url
    var authUrl = github.auth.config({
            id: nconf.get('github:clientId'),
            secret: nconf.get('github:clientSecret')
        })
        .login(['user', 'public_repo'])
        + (redirectUri ? ('&redirect_uri=' + redirectUri) : '');
    // Store info to verify against CSRF
    req.session.authState = authUrl.match(/&state=([0-9a-z]{32})/i)[1];
    res.redirect(302, authUrl);
};

oauth.callback = function(req, res) {
    var values = req.query;
    if (values.error) {
        winston.error(values.error);
        res.render('error', { error: values.error });
        return;
    }

    var state = req.session.authState;

    // Check against CSRF attacks
    if (!state || state != values.state) {
        res.status(403);
        res.type('text/plain');
        res.send('');
    } else {
        Q.ninvoke(github.auth, 'login', values.code)
            .fail(function (err) {
                winston.error(err.message);
                res.render('error', { error: err.message });
            })
            .done(function (token) {
                // create user
                User.createByToken(token)
                    .fail(function (err) {
                        winston.error(err.message);
                        res.render('error', { error: err.message });
                    })
                    .done(function (user) {
                        req.session.authState = null;
                        req.session.loginName = user.login;
                        res.redirect(302, '/');
                    });
            });
    }
};

module.exports = function (app) {
    app.get('/login', oauth.login);
    app.get('/auth', oauth.callback);
};

