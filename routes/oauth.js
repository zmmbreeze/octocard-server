
/*
 * GET login / auth page.
 */

var nconf = require('nconf');
var github = require('octonode');
var User = require('../models/User');
var winston = require('winston');

var oauth = {};

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
    }).login(['user', 'public_repo']);
    // Store info to verify against CSRF
    req.session.authState = authUrl.match(/&state=([0-9a-z]{32})/i)[1];
    res.redirect(302, authUrl);
};

oauth.callback = function(req, res) {
    var values = req.query;
    var state = req.session.authState;

    // Check against CSRF attacks
    if (!state || state != values.state) {
        res.status(403);
        res.type('text/plain');
        res.send('');
    } else {
        github.auth.login(values.code, function (err, token) {
            res.status(200);
            res.type('text/plain');
            if (err) {
                winston.error(err.message);
                res.render('error', { err: 'err.message' });
                return;
            }

            // create user
            User.createByToken(token, function (err, user) {
                if (err) {
                    res.render('error', { err: 'err.message' });
                    return;
                }
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

