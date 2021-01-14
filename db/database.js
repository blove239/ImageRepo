const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "db.sqlite";
const pwdHash = require('./pwdHash');
require('dotenv').config();

const adminPwd = pwdHash.saltHashPassword(process.env.ADMIN_PWD);

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
                    db.run(insert, ["admin", "admin@example.com", adminPwd.passwordHash, adminPwd.salt, "admin"])
                }
            });

        db.run(`CREATE TABLE images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image BLOB NOT NULL,
                mimetype TEXT,
                private INTEGER NOT NULL,
                username TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
                )`,
            (err) => {
                if (err) {
                    console.log(err)
                }
            });
    }
});

const dal = {};

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
            if (err) {
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
            if (err) {
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
        if (!row) { return done(null, false) };
        let hash = pwdHash.sha256(password, row.salt).passwordHash;
        let sql2 = 'SELECT username, id, role FROM users WHERE username = ? AND password = ?'
        db.get(sql2, username, hash, function (err, row) {
            return done(null, row || false);
        });
    })
}
dal.findById = (id, done) => {
    let sql = 'SELECT username, id, role FROM users WHERE id = ?';
    db.get(sql, id, function (err, row) {
        return done(null, row || false);
    });
};

dal.signUp = (username, email, password) => {
    let sql = 'INSERT INTO users (username, email, password, salt) VALUES (?,?,?,?)'
    let value = pwdHash.saltHashPassword(password);
    let hashedPass = value.passwordHash;
    let salt = value.salt;
    return asyncRun(sql, [username, email, hashedPass, salt])
};

dal.changePassword = (username, password) => {
    let sql = `UPDATE users
    SET password = ?,
    salt = ?
    WHERE username = ?`;
    let value = pwdHash.saltHashPassword(password);
    let hashedPass = value.passwordHash;
    let salt = value.salt;
    return asyncRun(sql, [hashedPass, salt, username]);
};

dal.findByUser = (username) => {
    let sql = 'SELECT username, email, role FROM users WHERE username = ?';
    return asyncGet(sql, username);
};

dal.getImageIDs = async (username = undefined, role = undefined) => {
    let publicSql = 'SELECT id, mimetype FROM images WHERE private = 0;'
    let privateSql = 'SELECT id, mimetype FROM images'
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

dal.getImage = async (imageId, mimetype, username = undefined, role = undefined) => {
    let sql = `SELECT image FROM images WHERE id = ? AND mimetype = ? AND
    (
        (private = 0)
        OR
        (? = 'admin' OR username = ?)    
    )`
    try {
        return await asyncGet(sql, [imageId, mimetype, role, username])
    } catch (err) {
        return err;
    }
};

dal.getImagesByUser = async (targetUser, username = undefined, role = undefined) => {
    let publicImagesSql = `SELECT id, mimetype 
    FROM images 
    WHERE private = 0 AND
    username = ?;`
    let privateImagesSql = `SELECT id, mimetype 
    FROM images 
    WHERE username = ?;`
    try {
        if (role === 'admin' || username === targetUser) {
            return asyncAll(privateImagesSql, targetUser);
        } else {
            return asyncAll(publicImagesSql, targetUser);
        }
    } catch (err) {
        return err;
    }
};

dal.insertImage = async (username, image, private, mimetype) => {
    let sql = 'INSERT INTO images (username, image, private, mimetype) VALUES (?,?,?,?)'
    let sqlliteBool = private ? 1 : 0;
    try {
        await asyncRun(sql, [username, image, sqlliteBool, mimetype]);
    } catch (err) {
        return err;
    }
};

dal.deleteImage = async (username, imageId) => {
    let adminSql = 'DELETE FROM images WHERE id = ?'
    let sql = 'DELETE FROM images WHERE username = ? AND id = ?'

    try {
        username.role === 'admin' ? await asyncRun(adminSql, imageId)
            : await asyncRun(sql, [username, imageId])

    } catch (err) {
        return err;
    }
}

module.exports = dal;