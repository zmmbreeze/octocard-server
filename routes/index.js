/*jshint laxbreak:true */

/*
 * GET home page.
 */

var index = function (req, res) {
    res.render('index', {
        title: 'Octocard',
        loginName: req.session.loginName || 'your github username'
    });
};

module.exports = function (app) {
    app.get('/', index);
};
