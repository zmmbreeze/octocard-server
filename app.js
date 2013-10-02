#!/usr/bin/env node

/**
 * Module dependencies.
 */
var express = require('express');
var http = require('http');
var path = require('path');
var fs = require('fs');
var nconf = require('nconf');
var mongoose = require('mongoose');
var MongoStore = require('connect-mongo')(express);
var winston = require('winston');

/**
 * config
 */
nconf.argv()
    .env()
    .file({ file: __dirname + '/config.json' });
var port = nconf.get('port');

// database config
mongoose.connect(nconf.get('database:url'));
var db = mongoose.connection;

// logger config
winston.add(winston.transports.File, { filename: nconf.get('logfilename') });
winston.remove(winston.transports.Console);

/**
 * start
 */
var app = express();
app.configure(function () {
    app.set('port', port);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.favicon());
    app.use(express.logger({
        stream: {
            write: function (message, encoding) {
                winston.info(message);
            }
        }
    }));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser(nconf.get('session:secret')));
    app.use(express.session({
        secret: nconf.get('session:secret'),
        key: nconf.get('session:key'),
        store: new MongoStore({mongoose_connection: db}),
        cookie: {
            httpOnly: true,
            maxAge: nconf.get('session:maxAge')
        }
    }));
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
    app.use(express.errorHandler());
    // logger config
    winston.add(winston.transports.Console);
});

/**
 * Load Routes
 */
fs.readdirSync(__dirname + '/routes').forEach(function (filename){
    if (!/\.js$/.test(filename)) {
        return;
    }

    var name = path.basename(filename, '.js');
    var route = require('./routes/' + name);
    if (typeof route === 'function') {
        route(app);
    }
});

db.on('error', function () {
    winston.error('Mongodb connection error!');
});

db.on('open', function () {
    winston.info('Mongodb connected!');
    app.listen(app.get('port'), function () {
        winston.info('Github-card server listening on port ' + app.get('port'));
    });
});
