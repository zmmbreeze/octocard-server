
/*
 * GET api url.
 */

var User = require('../models/User');
var winston = require('winston');

var getUserStatus = function (req, res) {
    var loginName = req.session.loginName;
    User.getUserData(loginName, function (err, data) {
        if (err) {
            return;
        }
        res.json(data);
    });
};

module.exports = function (app) {
    app.get('/api/status', getUserStatus);
};
