import Joi from 'joi';

export const registerUserValidator = Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required(),

    lastName: Joi.string().trim().min(2).max(50).required(),

    email: Joi.string()
        .trim()
        .email({ tlds: { allow: false } })
        .required()
        .messages({ 'string.email': 'Email must be a valid address' }),

    phone: Joi.string()
        .pattern(/^0\d{9}$/)
        .allow('', null)
        .optional()
        .messages({
            "string.pattern.base": "Phone number must be a valid 10-digit Ghana number (e.g. 0559090182)"
        }),

    password: Joi.when('source', {
        is: 'local',
        then: Joi.string()
            .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"))
            .required()
            .messages({
                'string.pattern.base': 'Password must be at least 8 characters, including uppercase, lowercase, and a number.'
            }),
        otherwise: Joi.string().optional()
    }),

    avatar: Joi.string().uri().optional(),

    role: Joi.string()
        .valid('potchef', 'potlucky')
        .required()
        .messages({
            'any.only': 'Role must be either potchef or potlucky'
        }),

    source: Joi.string()
        .valid('local', 'google')
        .default('local'),

       // Updated validator - make payoutDetails optional for potchefs
    payoutDetails: Joi.when('role', {
        is: 'potchef',
        then: Joi.object({
            type: Joi.string().valid('bank', 'mobileMoney').optional(), // ← Change to optional
            bank: Joi.when('type', {
                is: 'bank',
                then: Joi.object({
                    bankCode: Joi.string().required(),
                    accountNumber: Joi.string().required(),
                    accountName: Joi.string().required()
                }).required(),
                otherwise: Joi.forbidden()
            }),
            mobileMoney: Joi.when('type', {
                is: 'mobileMoney',
                then: Joi.object({
                    provider: Joi.string().valid('mtn', 'vodafone', 'airteltigo').required(),
                    number: Joi.string().required()
                }).required(),
                otherwise: Joi.forbidden()
            })
        }).optional(), 
        otherwise: Joi.forbidden()
    })

}).messages({
    'any.required': 'All fields marked * are required',
});

export const googleAuthValidator = Joi.object({
    token: Joi.string().required(),
    role: Joi.string().valid('potlucky').default('potlucky').messages({
        'any.only': 'Google signup is only available for potlucky users'
    })
});

export const updateUserValidator = Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    phone: Joi.string()
        .pattern(/^0\d{9}$/)
        .allow('', null)
        .messages({
            "string.pattern.base": "Phone must start with 0 and be 10 digits"
        }),
    avatar: Joi.string().uri(),
    password: Joi.string().min(8).optional(),

    // Update payout details (for potchefs only)
    payoutDetails: Joi.object({
        type: Joi.string().valid('bank', 'mobileMoney'),
        bank: Joi.object({
            bankCode: Joi.string(),
            accountNumber: Joi.string(),
            accountName: Joi.string()
        }),
        mobileMoney: Joi.object({
            provider: Joi.string().valid('mtn', 'vodafone', 'airteltigo'),
            number: Joi.string()
        })
    }).optional()
});

export const adminUpdateUserValidator = Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    phone: Joi.string().pattern(/^0\d{9}$/).messages({
        "string.pattern.base": "Phone must start with 0 and be 10 digits"
    }),
    avatar: Joi.string().uri(),
    role: Joi.string().valid('potchef', 'potlucky', 'admin'),
    status: Joi.string().valid('pending', 'approved', 'rejected', 'active'),
    approvedAt: Joi.date(),
    profileCompleted: Joi.boolean(),

    // Admin can update paystack details
    paystack: Joi.object({
        subaccountCode: Joi.string(),
        subaccountId: Joi.string(),
        settlementBank: Joi.string(),
        accountNumber: Joi.string(),
        percentageCharge: Joi.number().min(0).max(100)
    }).optional()
});

export const createSubaccountValidator = Joi.object({
    userId: Joi.string().required(),
    businessName: Joi.string().required(),
    settlementBank: Joi.string().required(),
    accountNumber: Joi.string().required(),
    percentageCharge: Joi.number().min(0).max(100).default(0)
});

export const approveUserValidator = Joi.object({
    userId: Joi.string().required(),
    status: Joi.string().valid('approved', 'rejected').required(),
    notes: Joi.string().optional()
});

export const loginUserValidator = Joi.object({
    email: Joi.string().trim().email().required(),
    password: Joi.string().min(8).required()
});

export const changePasswordValidator = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
        .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"))
        .required()
        .messages({
            'string.pattern.base': 'New password must be at least 8 characters, including uppercase, lowercase, and a number.'
        })
});

export const forgotPasswordValidator = Joi.object({
    email: Joi.string().email().required()
});

export const resetPasswordValidator = Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string()
        .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"))
        .required()
        .messages({
            'string.pattern.base': 'New password must be at least 8 characters, including uppercase, lowercase, and a number.'
        })
});

export const updatePayoutDetailsValidator = Joi.object({
    type: Joi.string().valid('bank', 'mobileMoney').required(),
    bank: Joi.when('type', {
        is: 'bank',
        then: Joi.object({
            bankCode: Joi.string().required(),
            accountNumber: Joi.string().required(),
            accountName: Joi.string().required()
        }).required(),
        otherwise: Joi.forbidden()
    }),
    mobileMoney: Joi.when('type', {
        is: 'mobileMoney',
        then: Joi.object({
            provider: Joi.string().valid('mtn', 'vodafone', 'airteltigo').required(),
            number: Joi.string().required()
        }).required(),
        otherwise: Joi.forbidden()
    })
});