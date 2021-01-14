const { valid } = require("joi");
const Joi = require("joi");
const { FIVE_HUNDRED_KILOBYTES } = require("./constants")
const validate = {};

validate.verifyImage = (name, mimetype, size) => {
    if (mimetype === "image/jpeg" ||
        mimetype === "image/gif" ||
        mimetype === "image/png") {
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

validate.changePassword = (password) => {
    const input = { password };
    changePasswordSchema.validate(input);
};

const signupSchema = Joi.object({
    username: Joi.string().min(4).max(20).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(5).max(32).required()
});

validate.signUp = (username, email, password) => {
    const input = { username, email, password };
    signupSchema.validate(input);
};

const deleteSchema = Joi.object({
    imageId: Joi.number().integer().required()
})

validate.delete = (imageId) => {
    const input = { imageId };
    deleteSchema.validate(input);
}

module.exports = validate;