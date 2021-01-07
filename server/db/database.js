const sqlite3 = require('sqlite3').verbose()
const DBSOURCE = "db.sqlite"
const pwdHash = require('./pwdHash')

const testpwd = pwdHash.saltHashPassword('123');
const testpwd2 = pwdHash.saltHashPassword('123');

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message)
        throw err
    } else {
        console.log('Connected to the SQLite database.')
        db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE, 
            password TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT,
            CONSTRAINT username_unique UNIQUE (username),
            CONSTRAINT email_unique UNIQUE (email)
            )`,
            (err) => {
                if (err) {
                    console.log(err)
                } else {
                    // Table just created, creating some rows
                    let insert = 'INSERT INTO users (username, email, password, salt, role) VALUES (?,?,?,?,?)'
                    db.run(insert, ["admin", "admin@example.com", testpwd.passwordHash, testpwd.salt, "admin"])
                    db.run(insert, ["user", "user@example.com", testpwd2.passwordHash, testpwd2.salt])
                }
            });

        db.run(`CREATE TABLE images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                description TEXT,
                image BLOB NOT NULL,
                private INTEGER NOT NULL,
                username TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
                )`,
            (err) => {
                if (err) {
                    console.log(err)
                } else {
                    // Table just created, creating some rows
                    let insert = 'INSERT INTO images (name, description, image, private, username) VALUES (?,?,?,?,?)'
                    db.run(insert, ["image1", "ITS A PIC", "the pic", 0, "blove239"])
                    db.run(insert, ["image2", "second pic", "the pic!", 1, "blove239"])
                    db.run(insert, ["image3", "second pic", "the pic!", 0, "admin"])
                    db.run(insert, ["image4", "second pic", "the pic!", 0, "admin"])
                    db.run(insert, ["image5", "second pic", "the pic!", 0, "user"])
                    db.run(insert, ["image6", "second pic", "the pic!", 0, "user"])

                }
            });
    }
});

const dal = {};
// delete me
dal.unsafeDb = db;

const asyncRun = (sql, data) => {
    return new Promise((res, rej) => {
        db.run(sql, data, (err) => {
            if (err) {
                rej(err);
            } else {
                res();
            }
        });
    })
};

const asyncGet = (sql, data) => {
    return new Promise((res, rej) => {
        db.get(sql, data, (err, row) => {
            if (!row || err) {
                console.log("async get", row)
                rej(err);
            } else {
                res(row);
            }
        });
    })
};

const asyncAll = (sql, data) => {
    return new Promise((res, rej) => {
        db.all(sql, data, (err, row) => {
            if (!row || err) {
                rej(err);
            } else {
                res(row);
            }
        });
    })
};

dal.authUser = (username, password, done) => {
    let sql = 'SELECT salt FROM users WHERE username = ?';
    db.get(sql, username, function (err, row) {
        if (!row) return done(null, false);
        let hash = pwdHash.sha256(password, row.salt).passwordHash;
        let sql2 = 'SELECT username, id, role FROM users WHERE username = ? AND password = ?'
        db.get(sql2, username, hash, function (err, row) {
            console.log(row)
            if (!row) return done(null, false);
            return done(null, row);
        });
    })
}
dal.findById = (id, done) => {
    let sql = 'SELECT username, id, role FROM users WHERE id = ?';
    db.get(sql, id, function (err, row) {
        if (!row) return done(null, false);
        return done(null, row);
    });
}

dal.signUp = (username, email, password) => {
    let sql = 'INSERT INTO users (username, email, password, salt) VALUES (?,?,?,?)'
    let value = pwdHash.saltHashPassword(password);
    let hashedPass = value.passwordHash;
    let salt = value.salt;
    return asyncRun(sql, [username, email, hashedPass, salt])
}

dal.changePassword = (username, password) => {
    let sql = `UPDATE users
    SET password = ?,
    salt = ?
    WHERE username = ?`;
    let value = pwdHash.saltHashPassword(password);
    let hashedPass = value.passwordHash;
    let salt = value.salt;
    return asyncRun(sql, [hashedPass, salt, username]);
}

dal.findByUser = (username) => {
    let sql = 'SELECT username, email, role FROM users WHERE username = ?';
    return asyncGet(sql, username);
};

dal.getImageIDs = async (username, role) => {
    let publicSql = 'SELECT id FROM images WHERE private = 0;'
    let privateSql = 'SELECT id FROM images'
    try {
        if (!username) {
            return asyncAll(publicSql);
        }
        let userData = await dal.findByUser(username);
        if (role === 'admin') {
            return asyncAll(privateSql)
        } else {
            return asyncAll(publicSql);
        }
    } catch (err) {
        return err;
    }
};

dal.getImage = async (username, imageId, role) => {
    let publicSql = 'SELECT image FROM images WHERE id = ? AND private = 0;'
    let privateSql = 'SELECT image FROM images WHERE id = ?;'
    try {
        if (!username) {
            let image = await asyncGet(publicSql, imageId)
            return image;
        }
        if (role === 'admin') {
            let image = await asyncGet(publicSql, imageId)
            return image;
        } if (userData.username === targetUser) {
            let image = await asyncGet(publicSql, imageId)
            return image;
        }
        else {
            let image = await asyncGet(publicSql, imageId)
            return image;
        }
    } catch (err) {
        console.log("err", err)
        return err;
    }
};

dal.getImagesByUser = async (username, targetUser, role) => {
    let publicImagesSql = `SELECT name, description, image, private, username 
    FROM images 
    WHERE private = 0 AND
    username = ?;`
    let privateImagesSql = `SELECT name, description, image, private, username 
    FROM images 
    WHERE username = ?;`
    try {
        if (!username) {
            return asyncAll(publicImagesSql, targetUser);
        }
        if (role === 'admin') {
            return asyncAll(privateImagesSql, targetUser);
        } if (userData.username === targetUser) {
            return asyncAll(privateImagesSql, targetUser);
        } else {
            return asyncAll(publiceImagesSql, targetUser);
        }
    } catch (err) {
        return err;
    }
}

dal.insertImage = async (username, image, private) => {
    let sql = 'INSERT INTO images (username, image, private) VALUES (?,?,?)'
    try {
        await asyncRun(sql, [username, image, private]);
    } catch (err) {
        console.log(err);
        return err;
    }
}

db.all('SELECT * FROM users', function (err, row) {
    console.log(row);
})

db.all('SELECT * FROM images', function (err, row) {
    console.log(row);
})

module.exports = dal;