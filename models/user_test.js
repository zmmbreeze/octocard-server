var nconf = require('nconf');
var mongoose = require('mongoose');
var User = require('./User');
var helper = require('../helper/helper');

/**
 * config
 */
nconf.argv()
    .env()
    .file({ file: __dirname + '/../config.json' });
var port = nconf.get('port');

// database config
mongoose.connect(nconf.get('database:url'));
var db = mongoose.connection;

db.on('error', function () {
    console.log('Mongodb connection error!');
});

db.on('open', function () {
    console.log('Mongodb connected!');

    User.findByLogin('zmmbreeze')
        /*
        .then(function (user) {
            helper.getAllGithubData(
                    user.token,
                    '/orgs/ecomfe/repos'
                ).then(function (data) {
                    data.forEach(function (d) {
                        if (d.permissions.push || d.permissions.admin) {
                            console.log(d.full_name);
                        }
                    });
                    return data;
                });
        });
        */
        .then(function (user) {
            return User.githubApi.getUserOrgReposData(user);
        })
        .then(function (data) {
            data.forEach(function (d) {
                console.log(d.full_name);
            });
            console.log(data.length);
            // console.log(data[0]);
            process.exit(0);
        });
});
