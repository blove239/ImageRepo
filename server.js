const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cors = require('cors');
const ejs = require('ejs');
const fileUpload = require('express-fileupload');
const db = require('./db/database');
const pwdHash = require('./db/pwdHash');
const validate = require('./utils/validate');
require('dotenv').config()
const { FIVE_HUNDRED_KILOBYTES } = require('./utils/constants')
const PORT = process.env.PORT || 8001;
const app = express();

app.use(fileUpload({
    limits: {
        fileSize: FIVE_HUNDRED_KILOBYTES,
        files: 96
    }
}));

app.use(express.static(__dirname));
const bodyParser = require('body-parser');
const expressSession = require('express-session')({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressSession);
app.use(cors());
app.use(passport.initialize());
app.use(passport.session());
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

const doIfLoggedIn = (req, res, cb) => {
    if (!req.user) {
        res.render('pages/login', {
            user: undefined,
            info: undefined
        });
    } else {
        if (typeof cb === 'function') {
            cb();
        }
    }
};

const extToMimetype = (ext) => {
    if (ext === 'jpg') {
        return "image/jpeg"
    }
    if (ext === 'gif') {
        return "image/gif"
    }
    if (ext === 'png') {
        return "image/png"
    }
    return undefined;
};

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

app.get('/', async function (req, res) {
    let imageIDs = req.user ?
        await db.getImageIDs(
            req.user.username,
            req.user.role)
        : await db.getImageIDs();

    res.render('pages/index', {
        user: req.user,
        imageIDs: imageIDs
    });
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

app.get('/user/:targetUser', async function (req, res) {
    try {
        let userData = await db.findByUser(req.params.targetUser);
        
        let imageIDs = req.user ? await db.getImagesByUser(
            req.params.targetUser,
            req.user.username,
            req.user.role)
            : await db.getImagesByUser(req.params.targetUser);

        res.render('pages/userprofile', {
            user: req.user,
            username: userData.username,
            imageIDs: imageIDs,
            query: req.query
        });
    } catch (err) {
        console.log(err)
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

app.get('/images/:imageId.:ext', async function (req, res) {
    try {
        let image = req.user ?
            await db.getImage(
                req.params.imageId,
                extToMimetype(req.params.ext),
                req.user.username,
                req.user.role)
            : await db.getImage(req.params.imageId, extToMimetype(req.params.ext))
        if (image && image.image) {
            res.set({ 'Content-Type': image.mimetype }).send(image.image)
        } else {
            res.status(404).send("404 IMAGE NOT FOUND")
        }
    }
    catch (err) {
        console.log(err)
        res.status(500).send("500 INTERNAL SERVER ERROR")
    }
})

app.get('/user/:targetUser/images', async function (req, res) {
    let username = undefined;
    let role = undefined;
    if (req.user) {
        username = req.user.username
        role = req.user.role
    };
    try {
        let imageIDs = req.user ? await db.getImagesByUser(
            req.params.targetUser,
            req.user.username,
            req.user.role)
            : await db.getImagesByUser(req.params.targetUser);
        res.send(imageIDs)
    }
    catch (err) {
        console.log(err)
        res.status(500).send("500 INTERNAL SERVER ERROR")
    }
});

app.get('/upload', function (req, res) {
    doIfLoggedIn(req, res, () => res.render('pages/upload', {
        message: undefined,
        user: req.user,
        status: []
    }))
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
                    message: 'No file uploaded',
                    user: req.user,
                    status: []
                });
            } else {
                let status = [];
                let private = true;
                if (req.body.permission === undefined) { private = false; }
                const imageList = req.files.images.length === undefined ? [req.files.images] : req.files.images;
                imageList.forEach(async (image) => {
                    try {
                        validate.verifyImage(image.name, image.mimetype, image.size)
                        await db.insertImage(req.user.username, image.data, private, image.mimetype)
                            .then(status.push({
                                status: true,
                                message: `${image.name} uploaded successfully`
                            }))
                    } catch (err) {
                        status.push({
                            status: false,
                            message: err.message
                        })
                    }
                });
                res.render('pages/upload', {
                    message: undefined,
                    user: req.user,
                    status: status
                });
            }
        } catch (err) {
            console.log(err)
            res.status(500).send("500 INTERNAL SERVER ERROR");
        }
    }
});

app.post('/delete', function (req, res) {
    if (req.user === undefined) {
        res.render('pages/login', {
            user: req.user,
            info: undefined
        });
    } else {
        if(!req.body.imageId){res.send("No Images Selected")}
        !req.body.imageId.length ? req.body.imageId: [req.body.imageId]
        req.body.imageId.forEach(async (imageId) => {
            await db.deleteImage(req.user, imageId);
        })
    }
});

app.listen(PORT, () => console.log('App listening on port ' + PORT));
