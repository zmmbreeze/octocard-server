/*jshint laxbreak:true */

/*
 * GET home page.
 */

var index = function (req, res) {
    res.render('index', {
        title: 'Octocard',
        loginName: req.session.loginName || 'your github username',
        usableLoginName: req.session.loginName || 'zmmbreeze',
        logined: !!req.session.loginName
    });
};

module.exports = function (app) {
    app.get('/', index);
};
