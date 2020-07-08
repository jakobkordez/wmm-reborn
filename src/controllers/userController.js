const db = require('../database');
const auth = require('../helpers/auth');
const bcrypt = require('bcrypt');

module.exports = {

    register: function (req, res, next) {
        const username = req.body.username;
        const name = req.body.name;
        const email = req.body.email;
        const password = req.body.password;
        if (!username || !name || !email || !password) {
            return res.status(400).json('Empty field(s): username, name, email and password required');
        }

        if (!/^[\w.]{5,20}$/.test(username)) {
            return res.status(400).json('Invalid username');
        }
        if (!/^[a-zA-Z]+( [a-zA-Z]+)*$/.test(name)) {
            return res.status(400).json('Invalid name');
        }
        if (!/^((?!.*\.\.)(?!\.)(?!.*\.@)([a-zA-Z\d\.\+\_$#!&%?-]+)@(((?!-)(?!.*-\.)([a-zA-Z\d-]+)\.([a-z]{2,8})(\.[a-z]{2,8})?)|(\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\])))$/.test(email)) {
            return res.status(400).json('Invalid email');
        }
        if (!/^[\w.#$%&@\- ]{6,}$/.test(password)) {
            return res.status(400).json('Invalid password');
        }

        const query = 'SELECT id FROM Users WHERE username = ?';
        const inserts = [username];

        db.query(query, inserts, (err, /** @type {Array} */ results) => {
            if (err) return next(err);

            if (results.length > 0) {
                return res.status(400).json('Username taken')
            }

            bcrypt.hash(password, 10, (err, pw_hash) => {
                if (err) return next(err);

                const query = 'INSERT INTO Users (username, name, email, password) VALUES (?,?,?,?)';
                const inserts = [username, name, email, pw_hash];

                db.query(query, inserts, (err) => {
                    if (err) return next(err);
                
                    return res.status(201).json('Account created');
                })
            });
        });
    },

    login: function (req, res, next) {
        const username = req.body.username;
        const password = req.body.password;
        if (!username || !password) {
            return res.status(400).json('Empty field(s): username and password required');
        }

        const query = 'SELECT id, username, password FROM Users WHERE username = ?';
        const inserts = [username];

        db.query(query, inserts, (err, /** @type {Array} */ results) => {
            if (err) return next(err);

            if (results.length === 0) return res.status(400).json('Login data invalid');

            const userId = results[0].id;
            const username = results[0].username;
            const userPass = results[0].password;

            bcrypt.compare(password, userPass, (err, succ) => {
                if (err) return next(err);

                if (!succ) return res.status(400).json('Login data invalid');

                auth.generateRefreshToken(userId, username, (err, token) => {
                    if (err) return next(err);

                    const query = 'INSERT INTO Tokens (user_id, token) VALUES (?,?)';
                    const inserts = [userId, token];
            
                    db.query(query, inserts, (err) => {
                        if (err) return next(err);

                        return res.status(200).json({
                            refresh_token: token
                        });
                    });
                });
            });
        });
    },

    getAccessToken: function (req, res, next) {
        const refresh_token = req.body.refresh_token;
        if (!refresh_token) {
            return res.status(400).json('Refresh token required');
        }

        auth.validateRefreshToken(refresh_token, (err, data) => {
            if (err) return next(err);

            const query = 'SELECT user_id FROM Tokens WHERE token = ?';
            const inserts = [refresh_token];

            db.query(query, inserts, (err, /** @type {Array} */ results) => {
                if (err) return next(err);

                if (results.length == 0 || results[0].user_id != data.userId) {
                    return res.status(400).json('Token is no longer valid');
                }

                auth.generateAccessToken(data.userId, data.username, (err, token) => {
                    if (err) return next(err);
    
                    return res.status(200).json({
                        access_token: token
                    });
                });
            });

        });
    },

    deleteRefreshToken: function (req, res, next) {
        const refresh_token = req.body.refresh_token;
        if (!refresh_token) {
            return res.status(400).json('Refresh token missing');
        }

        auth.validateRefreshToken(refresh_token, (err, data) => {
            if (err) return next(err);

            if (data.userId !== req.user.id) return res.status(403).json('You do not own this token');

            const query = 'DELETE FROM Tokens WHERE token = ?';
            const inserts = [refresh_token];

            db.query(query, inserts, (err) => {
                if (err) return next(err);

                return res.status(200).json('Token deleted');
            });
        });
    },

    profile: function (req, res, next) {
        const username = req.params.username;
        if (!username) {
            return res.status(400).json('Username missing');
        }

        const query = 'SELECT username, name, total_lent, total_borrowed, current_lent, current_borrowed FROM Users WHERE username = ?';
        const inserts = [username];

        db.query(query, inserts, (err, /** @type {Array} */ results) => {
            if (err) return next(err);

            if (results.length === 0) return res.status(404).json('User not found');

            return res.status(200).json(results[0]);
        });
    },

    profileSelf: function (req, res, next) {
        const userId = req.user.id;

        const query = 'SELECT username, name, email, total_lent, total_borrowed, current_lent, current_borrowed FROM Users WHERE id = ?';
        const inserts = [userId];

        db.query(query, inserts, (err, /** @type {Array} */ results) => {
            if (err) return next(err);

            if (results.length === 0) {
                return next(new Error('User not found with ID'));
            }

            return res.status(200).json(results[0]);
        });
    },

    relation: function (req, res, next) {
        const selfUsername = req.user.username;
        const username = req.params.username;
        if (!username) {
            return res.status(400).json('Username missing');
        }

        if (selfUsername == username) {
            return res.status(400).json('Cannot get relation with yourself');
        }

        const query = 'SELECT IFNULL(IF(user1=?, amount, -amount), 0) AS amount FROM PopulatedRelations WHERE (user1=? AND user2=?) OR (user1=? AND user2=?)';
        const inserts = [selfUsername, selfUsername, username, username, selfUsername];

        db.query(query, inserts, (err, /** @type {Array} */ results) => {
            if (err) return next(err);

            return res.status(200).json({
                amount: results[0].amount
            });
        });
    }

}