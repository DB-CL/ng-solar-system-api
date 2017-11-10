require('dotenv').config()

const express = require('express');
const app = express();
const moment = require('moment');
moment.locale('en');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

const OrbitersType = [0, 1, 2, 3, 4];

app.listen(3000);

// Get orbiters
app.get('/orbiters/:codes?', function(req, res, next) {
    console.log('Get /orbiters/:codes?');
    
    const codes = req.params.codes;
    if (codes !== undefined) {
        if (!codes.match('^(([0-9]+)(,(?=[0-9]))?)+$')) {
            const error = new Error('/orbiters/:codes?type=0 ; :codes should be given in this format : integer,...,integer');
            error.status = 400;
            throw error;
        }
    }

    let type = Number.parseInt(req.query.type, 10);
    if (type !== undefined && !Number.isNaN(type)) {
        if (OrbitersType.indexOf(type) === -1) {
            const error = new Error('/orbiters/:codes?type=0 ; type should be 0, 1, 2, 3 or 4');
            error.status = 400;
            throw error;
        }
    } else {
        type = undefined;
    }

    let query = 'SELECT * FROM orbitables ';
    if (codes !== undefined && type == undefined) {
        query += ' WHERE horizon_code IN (' + codes + ') ';
    } else if (codes === undefined && type !== undefined) {
        query += ' WHERE type = ' + type + ' ';
    } else if (codes !== undefined && type !== undefined) {
        query += ' WHERE horizon_code IN (' + codes + ') AND type = ' + type + ' ';
    }
    query += ' ORDER BY horizon_code ASC;';

    return pool.query(query)
        .then(response => {
            console.log('Response from DB');
            res.setHeader('Content-Type', 'application/json');
            res.send({
                status: 'success',
                data: toNumeric(response.rows)
            })
            res.end();
        })
        .catch(e => {
            console.log('Error from DB');
            next(e);
        });
});

// Get orbiters positions
app.get('/orbiters/:codes/positions/:date?', function(req, res, next) {
    console.log('/orbiters/:codes/positions/:date?');
    const codes = req.params.codes;
    if (!codes.match('^(([0-9]+)(,(?=[0-9]))?)+$')) {
        const error = new Error('/orbiters/:codes/positions/:date; :codes should be given in this format : integer,...,integer ');
        error.status = 400;
        throw error;
    }

    let date = req.params.date;
    if (date !== undefined) {
        date = moment(date, 'YYYYMMDDZ', true);
        if (!date.isValid()) {
            const error = new Error('/orbiters/:codes/positions/:date ; date should be given in this format : YYYYMMDDZ');
            error.status = 400;
            throw error;
        }    
    } else {
        date = moment();
    }

    
    const query = 'SELECT horizon_code, date, eccentricity, inclination, ascending_node, argument, semi_major_axis, x, y, z FROM positions WHERE horizon_code IN (' + codes + ') AND date >= $1 AND date < $1 + interval \'1 day\' ORDER BY horizon_code, date ASC;';
    return pool.query(query, [date.format()])
        .then(response => {
            console.log('Response from DB');
            const positions = response.rows;

            res.setHeader('Content-Type', 'application/json');
            res.send({
                status: 'success',
                data: toNumeric(positions)
            })
            res.end();
        })
        .catch(e => {
            console.log('Error from DB');
            next(e);
        });
});


// 404
app.use(function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    res.status(404);
    res.send({
        status: 'failed',
        error: '404',
        reason: 'Route or object not found'
    });
    res.end();
});


// errors handling
app.use(function(err, req, res, next) {
    console.error(err.stack);
    next(err);
});
app.use(function(err, req, res, next) {
    const status = err.status || 500;
    res.setHeader('Content-Type', 'application/json');
    res.status(status);
    res.send({
        status: 'failed',
        code: status,
        reason: err.message
    });
    res.end();
});

// helpers
function toNumeric(object) {
    const numericalKeys = ['equatorial_radius', 'mean_radius', 'mass', 'density', 'sideral_rotation_period', 'sideral_orbit_period', 'magnitude', 'geometric_albedo', 'equatorial_gravity', 'escape_velocity', 'eccentricity', 'inclination', 'ascending_node', 'argument', 'semi_major_axis'];

    if (Array.isArray(object)) {
        object.forEach(function(value) {
            toNumeric(value);
        });
    } else {
        for (const key in object) {
            if (numericalKeys.indexOf(key) !== -1) {
                if (object[key] !== undefined && object[key] !== null) {
                    object[key] = Number(object[key]);
                }
            }
        }
    }

    return object;
}