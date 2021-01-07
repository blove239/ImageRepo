const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cors = require('cors');
const ejs = require('ejs');
// delete flash too
const flash = require('connect-flash');
const fileUpload = require('express-fileupload');
// delete this
const cookieParser = require('cookie-parser');
const db = require('./db/database');
const pwdHash = require('./db/pwdHash');
const validate = require('./validate');

const PORT = process.env.PORT || 8001;
const app = express();

app.use(fileUpload({
    // add constants js , add filesize as constant
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 25
    }
}));

app.use(express.static(__dirname));
const bodyParser = require('body-parser');
const expressSession = require('express-session')({
    // PROCESS ENV SECRET THIS 
    secret: 'secret',
    resave: false,
    saveUninitialized: false
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
    db.authUser(username, password, done);
}));

passport.serializeUser(function (user, done) {
    return done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    db.findById(id, done);
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
    if (req.user !== undefined) {
        res.redirect(`/user/${req.body.username}`);
    } else {
        try {
            const { username, email, password } = req.body;
            validate.signUp(username, email, password);
            await db.signUp(username, email, password);
            res.redirect("/login")
        } catch (err) {
            // IMPLEMENT THIS ON THE FRONT END
            res.redirect("/signup?error=uniqueconstraint");
        }
    }
});

app.post('/changepassword', async function (req, res) {
    if (req.user === undefined) {
        res.redirect('/');
    } else {
        try {
            const username = req.user.username;
            const password = req.body.password;
            await db.changePassword(username, password);
            res.redirect(`/user/${username}?info=passwordupdated`)
        } catch (err) {
            // implement in front end
            res.redirect(`/user/${username}?info=passwordupdatefailed`)
        }
    }
});

app.get('/', function (req, res) {
    console.log(req.user)

    res.render('pages/index', { user: req.user });
});

app.get('/login', function (req, res) {
    if (req.user === undefined) {
        res.render('pages/login', {
            user: req.user,
            info: undefined
        });
    } else {
        res.redirect(`/users/${req.user.username}`)
    }
});

app.get('/signup', function (req, res) {
    if (req.user === undefined) {
        res.render('pages/signup', {
            user: req.user,
            query: req.query
        });
    } else {
        res.redirect(`/user/${req.user.username}`)
    }
});

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/user/:username', async function (req, res) {
    try {
        let userData = await db.findByUser(req.params.username);
        res.render('pages/userprofile', {
            user: req.user,
            username: userData.username,
            email: userData.email,
            role: userData.role,
            query: req.query
        });
    } catch (err) {
        // implement naming the unfound profile
        // on the front end
        res.render('pages/profilenotfound', {
            user: req.user,
            targetUser: req.params.username
        })
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

//get unique URLs
// /images/:id -> returns actual image file
app.get('/images', async function (req, res) {
    let username = undefined;
    let role = undefined;
    if (req.user) {
        username = req.user.username
        role = req.user.role
    };
    try {
        let imageIDs = await db.getImageIDs(username, role);
        res.send(imageIDs)
    }
    catch (err) {
        return err;
    }
});

app.get('/images/:imageId', async function (req, res) {
    let username = undefined;
    let role = undefined;
    console.log("userreq", req.user)
    if (req.user) {
        username = req.user.username
        role = req.user.role
    };
    try {
        let image = await db.getImage(username, req.params.imageId, role)
        res.send(image.image)
    }
    catch (err) {
        console.log(err)
        return err;
    }
})

// should return IDs for that users particular images
app.get('/user/:targetUser/images', async function (req, res) {
    let username = undefined;
    let role = undefined;
    if (req.user) {
        username = req.user.username
        role = req.user.role
    };
    try {
        let images = await db.getImagesByUser(username, req.params.targetUser, role);
        res.send(images)
    }
    catch (err) {
        return err;
    }
});

app.get('/upload', function (req, res) {
    if (req.user === undefined) {
        res.render('pages/login', {
            user: req.user,
            info: undefined
        });
    } else {
        res.render('pages/upload', {
            status: undefined,
            message: undefined,
            user: req.user
        });
    }
})

app.post('/upload', async function (req, res) {
    if (req.user === undefined) {
        res.render('pages/login', {
            user: req.user,
            info: undefined
        });
    } else {
        try {
            if (!req.files) {
                res.render('pages/upload', {
                    status: false,
                    message: 'No file uploaded',
                    user: req.user
                });
            } else {
                let data = [];

                if (req.files.images.length === undefined) {

                    let private = 0;
                    await db.insertImage(req.user.username, req.files.images.data, private)
                    data.push({
                        name: req.files.images.name,
                        mimetype: req.files.images.mimetype,
                        size: req.files.images.size
                    })
                } else {
                    for (image in req.files.images) {
                        let private = 0;
                        await db.insertImage(req.user.username, image.data, private)
                        data.push({
                            name: image.name,
                            mimetype: image.mimetype,
                            size: image.size
                        })
                    }
                }
                res.send({
                    status: true,
                    message: 'File is uploaded',
                    data: data
                });
            }
        } catch (err) {
            console.log(err)
            res.status(500).send(err);
        }

    }
})

app.listen(PORT, () => console.log('App listening on port ' + PORT));
