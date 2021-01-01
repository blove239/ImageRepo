const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cors = require('cors');
const ejs = require('ejs');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const db = require('./db/database');
const pwdHash = require('./db/pwdHash');
const validate = require('./validate');

const PORT = process.env.PORT || 8001;
const app = express();

app.use(express.static(__dirname));
const bodyParser = require('body-parser');
const expressSession = require('express-session')({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressSession);
app.use(cors());
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser('secret'));
app.use(flash());
app.set('view engine', 'ejs');

passport.use(new LocalStrategy(function (username, password, done) {
    let sql = 'SELECT salt FROM users WHERE username = ?';
    db.unsafeDb.get(sql, username, function (err, row) {
        if (!row) return done(null, false);
        let hash = pwdHash.sha256(password, row.salt).passwordHash;
        let sql2 = 'SELECT username, id FROM users WHERE username = ? AND password = ?'
        db.unsafeDb.get(sql2, username, hash, function (err, row) {
            if (!row) return done(null, false);
            return done(null, row);
        });
    });
}));

passport.serializeUser(function (user, done) {
    return done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    let sql = 'SELECT id, username FROM users WHERE id = ?';
    db.unsafeDb.get(sql, id, function (err, row) {
        if (!row) return done(null, false);
        return done(null, row);
    });
});

app.post('/login', (req, res, next) => {
    passport.authenticate('local',
        (err, user, info) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.render('pages/login', {
                    user: req.user,
                    info: 'userNotFound'
                });
            }
            req.logIn(user, function (err) {
                if (err) {
                    return next(err);
                }
                return res.redirect(`/user/${user.username}`);
            });
        })(req, res, next);
});



app.post('/signup', async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        validate.signUp(username, email, password);
        await db.signUp(username, email, password);
        res.redirect("/login")
    } catch (err) {
        next(err);
    }
});

app.post('/changepassword', async function (req, res) {
    if (req.user === undefined) {
        res.redirect('/');
    } else {
        let sql = `UPDATE users
        SET password = ?,
        salt = ?
        WHERE username = ?`;
        let username = req.user.username;
        let value = pwdHash.saltHashPassword(req.body.password);
        let hashedPass = value.passwordHash;
        let salt = value.salt;
        let data = [hashedPass, salt, username];

        const redirect = () => {
            res.redirect(`/user/${username}?info=passwordupdated`)
        }

        await new Promise((res, rej) => {
            db.unsafeDb.get.run(sql, data, function (err) {
                if (err) {
                    rej(err);
                    console.log(err)
                } else {
                    res(redirect());
                }
            });
        });
    }
});

app.get('/', function (req, res) {
    res.render('pages/index', { user: req.user });
});

app.get('/login', function (req, res) {
    if (req.user === undefined) {
        res.render('pages/login', {
            user: req.user,
            info: 'undefined'
        });
    } else {
        res.redirect(`/users/${req.user.username}`)
    }
});

app.get('/signup', function (req, res) {
    if (req.user === undefined) {
        res.render('pages/signup', { user: req.user });
    } else {
        res.redirect(`/users/${req.user.username}`)
    }
});

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/user/:username', async function (req, res) {
    let sql = 'SELECT username, email FROM users WHERE username = ?';
    let rowData = null;
    let userFound = false;

    await new Promise((res, rej) => {
        db.unsafeDb.get(sql, req.params.username,
            function (err, row) {
                if (!row || err) {
                    res(userFound = false);
                } else {
                    userFound = true;
                    //
                    res(rowData = row);
                }
            });
    })

    if (userFound) {
        const query = req.query;
        console.log(req.query);
        res.render('pages/userprofile', {
            user: req.user,
            username: rowData.username,
            email: rowData.email,
            query: query
        });
    } else {
        res.render('pages/profilenotfound', { user: req.user })
    }
});

app.get('/changepassword', function (req, res) {
    if (req.user === undefined) {
        res.redirect('/');
    } else {
        res.render('pages/changepassword', {
            user: req.user
        });
    }
});

app.listen(PORT, () => console.log('App listening on port ' + PORT));
