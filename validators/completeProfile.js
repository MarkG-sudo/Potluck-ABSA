import Joi from "joi";

export const completeProfileValidator = Joi.object({
    role: Joi.string().valid("potchef", "potlucky", "franchisee").required(),
    phone: Joi.string().pattern(/^0\d{9}$/).required(),
    password: Joi.string().min(8).optional()
});
