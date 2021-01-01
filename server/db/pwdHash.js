const crypto = require('crypto');

function genRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

function sha256(password, salt) {
    let hash = crypto.createHmac('sha256', salt);
    hash.update(password);
    let value = hash.digest('hex');
    return {
        salt: salt,
        passwordHash: value
    };
};

function saltHashPassword(userpassword) {
    let salt = genRandomString(16);
    let passwordData = sha256(userpassword, salt);
    return passwordData;
}

module.exports = {
    genRandomString,
    sha256,
    saltHashPassword
}