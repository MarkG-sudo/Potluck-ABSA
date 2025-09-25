import Joi from 'joi';

export const registerUserValidator = Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required()
        .messages({ 'string.min': 'First name must be at least 2 characters' }),

    lastName: Joi.string().trim().min(2).max(50).required()
        .messages({ 'string.min': 'Last name must be at least 2 characters' }),

    email: Joi.string().trim().email({ tlds: { allow: false } }).required()
        .messages({ 'string.email': 'Email must be a valid address' }),

    // ✅ PHONE IS NOW REQUIRED FOR BOTH ROLES
    phone: Joi.string()
        .pattern(/^0\d{9}$/)
        .required()
        .messages({
            "string.pattern.base": "Phone number must be a valid 10-digit Ghana number (e.g. 0559090182)",
            "any.required": "Phone number is required"
        }),

    // ✅ PASSWORD REQUIRED (LOCAL REGISTRATION ONLY)
    password: Joi.string()
        .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"))
        .required()
        .messages({
            'string.pattern.base': 'Password must be at least 8 characters, including uppercase, lowercase, and a number.',
            'any.required': 'Password is required'
        }),

    avatar: Joi.string().uri().optional(),

    role: Joi.string()
        .valid('potchef', 'potlucky')
        .required()
        .messages({
            'any.only': 'Role must be either potchef or potlucky'
        }),

    // ✅ ONLY LOCAL REGISTRATION ALLOWED
    source: Joi.string().valid('local').default('local'),

    // ✅ PAYOUTDETAILS NOT ALLOWED DURING REGISTRATION
    payoutDetails: Joi.forbidden().messages({
        'any.unknown': 'payoutDetails should not be provided during registration'
    })

}).messages({
    'any.required': 'This field is required',
});

// ✅ REMOVE GOOGLE OAUTH VALIDATOR (NOT USED IN MVP)
// export const googleAuthValidator = Joi.object({ ... });

export const updateUserValidator = Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),

    // ✅ PHONE REQUIRED FOR PROFILE UPDATES TOO
    phone: Joi.string()
        .pattern(/^0\d{9}$/)
        .required()
        .messages({
            "string.pattern.base": "Phone must be a valid 10-digit Ghana number starting with 0"
        }),

    avatar: Joi.string().uri().optional(),
    password: Joi.string().min(8).optional(),

    // Update payout details (for potchefs only during profile completion)
    payoutDetails: Joi.object({
        type: Joi.string().valid('bank').required(),
        bank: Joi.object({
            bankCode: Joi.string().required(),
            accountNumber: Joi.string().required(),
            accountName: Joi.string().required()
        }).required()
    }).optional()
});

export const adminUpdateUserValidator = Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),

    // ✅ PHONE REQUIRED FOR ADMIN UPDATES TOO
    phone: Joi.string()
        .pattern(/^0\d{9}$/)
        .required()
        .messages({
            "string.pattern.base": "Phone must be a valid 10-digit Ghana number starting with 0"
        }),

    avatar: Joi.string().uri(),
    role: Joi.string().valid('potchef', 'potlucky', 'admin'),
    status: Joi.string().valid('pending', 'approved', 'rejected', 'active'),
    approvedAt: Joi.date(),
    profileCompleted: Joi.boolean(),

    // Admin can update paystack details
    paystack: Joi.object({
        subaccountCode: Joi.string(),
        settlementBank: Joi.string(),
        accountNumber: Joi.string(),
        percentageCharge: Joi.number().min(0).max(100)
    }).optional()
});

// ✅ NEW VALIDATOR FOR POTCHEF PROFILE COMPLETION
export const completePotchefProfileValidator = Joi.object({
    // ✅ PHONE REQUIRED (SAME AS REGISTRATION)
    phone: Joi.string()
        .pattern(/^0\d{9}$/)
        .required()
        .messages({
            "string.pattern.base": "Phone must be a valid 10-digit Ghana number starting with 0"
        }),

    // ✅ PAYOUT DETAILS REQUIRED FOR POTCHEF PROFILE COMPLETION
    payoutDetails: Joi.object({
        type: Joi.string().valid('bank').required(),
        bank: Joi.object({
            bankCode: Joi.string().required(),
            accountNumber: Joi.string().required(),
            accountName: Joi.string().required()
        }).required()
    }).required()
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
    type: Joi.string().valid("bank").required(),
    bank: Joi.object({
        bankCode: Joi.string().required(),
        accountNumber: Joi.string().required(),
        accountName: Joi.string().required()
    }).required()
});