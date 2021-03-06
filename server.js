const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cors = require('cors');
const fileUpload = require('express-fileupload');
const morgan = require('morgan');
const db = require('./db/database');
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
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');

const corsOptions = {
    origin: 'https://imagerepo.brandonlove.ca',
    optionsSuccessStatus: 200
  }

app.use(cors(corsOptions));

function matchRuleShort(str, rule) {
    let escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
  }

app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
        skip: (req, res) => matchRuleShort(req.url, "/images/*")
      })
);

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
        return 'image/jpeg'
    }
    if (ext === 'gif') {
        return 'image/gif'
    }
    if (ext === 'png') {
        return 'image/png'
    }
    return undefined;
};

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

app.get('/signup', function (req, res) {
    if (req.user === undefined) {
        res.render('pages/signup', {
            user: undefined,
            query: req.query
        });
    } else {
        res.redirect(`/user/${req.user.username}`);
    }
});

app.post('/signup', async (req, res) => {
    if (req.user) {
        res.redirect(`/user/${req.body.username}`);
    } else {
        try {
            const { username, email, password } = req.body;
            await validate.signUp(username, email, password);
            await db.signUp(username, email, password);
            res.redirect('/login');
        } catch (err) {
            if (err.name && err.name === 'ValidationError') {
                res.status(400).send('400 BAD REQUEST');
            } else {
                res.redirect('/signup?error=uniqueconstraint');
            }
        }
    }
});


app.get('/login', function (req, res) {
    doIfLoggedIn(req, res, () => {
        res.redirect(`/users/${req.user.username}`);
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

app.get('/changepassword', function (req, res) {
    if (req.user === undefined) {
        res.redirect('/');
    } else {
        res.render('pages/changepassword', {
            user: req.user
        });
    }
});

app.post('/changepassword', function (req, res) {
    doIfLoggedIn(req, res, async () => {
        try {
            const { password } = req.body;
            await validate.changePassword(password);
            const username = req.user.username;
            await db.changePassword(username, password);
            res.redirect(`/user/${username}?info=passwordupdated`);
        } catch (err) {
            if (err.name && err.name === 'ValidationError') {
                res.status(400).send('400 BAD REQUEST');
            } else {
                console.log(err);
                res.status(500).send('500 INTERNAL SERVER ERROR');
            }
        }
    });
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
        res.render('pages/profilenotfound', {
            user: req.user,
            targetUser: req.params.targetUser
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
            : await db.getImage(req.params.imageId, extToMimetype(req.params.ext));
        if (image && image.image) {
            res.set({ 'Content-Type': image.mimetype }).send(image.image);
        } else {
            res.status(404).send('404 IMAGE NOT FOUND');
        }
    }
    catch (err) {
        console.log(err)
        res.status(500).send('500 INTERNAL SERVER ERROR')
    }
});

app.get('/upload', function (req, res) {
    doIfLoggedIn(req, res, () => res.render('pages/upload', {
        message: undefined,
        user: req.user,
        status: []
    }));
});

app.post('/upload', function (req, res) {
    doIfLoggedIn(req, res, async () => {
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
                            }));
                    } catch (err) {
                        status.push({
                            status: false,
                            message: err.message
                        });
                    }
                });
                res.render('pages/upload', {
                    message: undefined,
                    user: req.user,
                    status: status
                });
            }
        } catch (err) {
            console.log(err);
            res.status(500).send('500 INTERNAL SERVER ERROR');
        }
    });
});

app.post('/delete', function (req, res) {
    doIfLoggedIn(req, res, async () => {
        let deletionIdArray = Array.isArray(req.body.imageId) ? req.body.imageId : [req.body.imageId];
        try {
            await validate.delete(deletionIdArray);
            deletionIdArray.forEach(async (imageId) => {
                await db.deleteImage(req.user, imageId);
            });
            res.redirect(`/user/${req.user.username}`);
        } catch (err) {
            if (err.name && err.name === 'ValidationError') {
                res.status(400).send('400 BAD REQUEST');
            } else {
                res.status(500).send('500 INTERNAL SERVER ERROR');
            }
        }
    });
});

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.listen(PORT, () => console.log('App listening on port ' + PORT));
