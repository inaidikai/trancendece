const Joi = require('joi');

// Validation schemas
const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(128).required(),
    full_name: Joi.string().max(100),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    full_name: Joi.string().max(100),
    bio: Joi.string().max(500),
  }),

  addFriend: Joi.object({
    friend_id: Joi.string().uuid().required(),
  }),

  acceptFriend: Joi.object({
    friend_id: Joi.string().uuid().required(),
  }),

  passwordReset: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(6).max(128).required(),
  }),

  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(6).max(128).required(),
  }),

  enable2FA: Joi.object({
    code: Joi.string().length(6),
  }),

  verify2FA: Joi.object({
    code: Joi.string().length(6).required(),
  }),
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const messages = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details: messages });
    }

    req.body = value;
    next();
  };
};

module.exports = {
  schemas,
  validate,
};
