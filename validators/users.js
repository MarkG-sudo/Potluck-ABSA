import Joi from 'joi';

export const registerUserSchema = Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),

    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({ 'string.email': 'Email must be a valid address' }),

    phone: Joi.string()
        .pattern(/^[0-9]{9,15}$/)
        .optional()
        .messages({ 'string.pattern.base': 'Phone must be 9–15 digits' }),

    password: Joi.string()
        .min(8)
        .required()
        .messages({ 'string.min': 'Password must be at least 8 characters' }),

    avatar: Joi.string().uri().optional(),

    role: Joi.string()
        .valid('potchef', 'potlucky', 'operator', 'admin')
        .required()
})
    .messages({
        'any.required': 'All fields marked * are required',
    });


export const loginUserValidator = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required()
      });