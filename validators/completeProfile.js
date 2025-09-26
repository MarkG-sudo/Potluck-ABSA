import Joi from "joi";

export const completePotchefProfileValidator = Joi.object({
    
    phone: Joi.string()
        .pattern(/^0\d{9}$/)
        .optional()
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
