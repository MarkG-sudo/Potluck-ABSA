import Joi from 'joi';

export const registerUserValidator = Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required(),

    lastName: Joi.string().trim().min(2).max(50).required(),

    email: Joi.string()
        .trim()
        .email({ tlds: { allow: false } })
        .required()
        .messages({ 'string.email': 'Email must be a valid address' }),

    phone: Joi.string().pattern(/^0\d{9}$/).label("Phone").messages({
        "string.pattern.base": "Phone number must be a valid 10-digit Ghana number (e.g. 0559090182)"
    }),

    password: Joi.string()
        .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"))
        .required()
        .messages({
            'string.pattern.base': 'Password must be at least 8 characters, including uppercase, lowercase, and a number.'
        }),

    avatar: Joi.string().uri().optional(),

    // 👇 Excludes 'admin' and 'pending' from public signup
    role: Joi.string()
        .valid('potchef', 'potlucky', 'pending')
        .required(),
        
    payoutDetails: Joi.when("role", {
        is: "potchef",
        then: Joi.object({
            type: Joi.string().valid("bank", "momo").required(),
            bankCode: Joi.when("type", { is: "bank", then: Joi.string().required() }),
            accountNumber: Joi.string().required(),
            momoProvider: Joi.when("type", { is: "momo", then: Joi.string().valid("mtn", "vodafone", "airteltigo").required() })
        }).required(),
        otherwise: Joi.forbidden()
    })
})
    .messages({
        'any.required': 'All fields marked * are required',
    });


export const loginUserValidator = Joi.object({
    email: Joi.string().trim().email().required(),
    password: Joi.string().min(8).required()
});

export const updateUserValidator = Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    phone: Joi.string().pattern(/^0\d{9}$/).message("Phone must start with 0 and be 10 digits"),
    avatar: Joi.string().uri(),
    password: Joi.string().min(8)
});
