const sqlite3 = require('sqlite3').verbose()
const DBSOURCE = "db.sqlite"
const pwdHash = require('./pwdHash')

const testpwd = pwdHash.saltHashPassword('abc123');
const testpwd2 = pwdHash.saltHashPassword('123abc');

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
            password NOT NULL TEXT,
            salt NOT NULL TEXT,
            CONSTRAINT username_unique UNIQUE (username),
            CONSTRAINT email_unique UNIQUE (email)
            )`,
            (err) => {
                if (err) {
                    console.log(err)
                } else {
                    // Table just created, creating some rows
                    let insert = 'INSERT INTO users (username, email, password, salt) VALUES (?,?,?,?)'
                    db.run(insert, ["admin", "admin@example.com", testpwd.passwordHash, testpwd.salt])
                    db.run(insert, ["user", "user@example.com", testpwd2.passwordHash, testpwd2.salt])
                }
            });

        db.run(`CREATE TABLE images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                description TEXT,
                image TEXT,
                private TEXT,
                image_owner TEXT,
                FOREIGN KEY(image_owner) REFERENCES users(username)
                )`,
            (err) => {
                if (err) {
                    console.log(err)
                } else {
                    // Table just created, creating some rows
                    let insert = 'INSERT INTO images (name, description, image, private, username) VALUES (?,?,?,?,?)'
                    db.run(insert, ["image1", "ITS A PIC", "the pic", "PUBLIC", "blove239"])
                    db.run(insert, ["image3", "second pic", "the pic!", "PUBLIC", "blove239"])
                    db.run(insert, ["image3", "second pic", "the pic!", "PUBLIC", "FUCKFACEMAGOO"])
                }
            });
    }
});

const dal = {};
dal.unsafeDb = db;

dal.signUp = (username, email, password) => {
    let sql = 'INSERT INTO users (username, email, password, salt) VALUES (?,?,?,?)'
    let value = pwdHash.saltHashPassword(password);
    let hashedPass = value.passwordHash;
    let salt = value.salt;
    return new Promise((res, rej) => {
        db.run(sql, [username, email, hashedPass, salt], (err) => {
            if (err) {
                rej(err);
            } else {
                res();
            }
        });
    });
}


db.all('SELECT * FROM users', function (err, row) {
    console.log(row);
})

db.all('SELECT * FROM images', function (err, row) {
    console.log(row);
})

module.exports = dal;