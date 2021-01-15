const Joi = require('joi');
const { FIVE_HUNDRED_KILOBYTES } = require('./constants')
const validate = {};

validate.verifyImage = (name, mimetype, size) => {
    if (mimetype === 'image/jpeg' ||
        mimetype === 'image/gif' ||
        mimetype === 'image/png') {
    } else {
        throw new Error(`${name} must be of type jpg, gif OR png`)
    }
    if (size > FIVE_HUNDRED_KILOBYTES) {
        throw new Error(`${name} must be less than 512KB`)
    }
}

const changePasswordSchema = Joi.object({
    password: Joi.string().min(5).max(32).required()
})

validate.changePassword = async (password) => {
    const input = { password };
    await changePasswordSchema.validateAsync(input);
};

const signupSchema = Joi.object({
    username: Joi.string().min(4).max(20).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(5).max(32).required()
});

validate.signUp = async (username, email, password) => {
    const input = { username, email, password };
    await signupSchema.validateAsync(input);
};

const deleteSchema = Joi.object({
    imageId: Joi.array().items(Joi.number().integer().required())
})

validate.delete = async (imageId) => {
    const input = { imageId }
    await deleteSchema.validateAsync(input);
}

module.exports = validate;