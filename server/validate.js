const Joi = require("joi");

const validate = {};

const signupSchema = Joi.object({
    username: Joi.string().min(4).max(20).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(5).max(32).required()
});

validate.signUp = (username, email, password) => {
    const input = { username, email, password };
    signupSchema.validate(input);
};

module.exports = validate;