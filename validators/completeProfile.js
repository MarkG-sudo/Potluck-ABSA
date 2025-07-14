
import Joi from "joi";

export const completeProfileValidator = Joi.object({
    role: Joi.string().valid("potchef", "potlucky", "operator", "admin").required(),
    phone: Joi.string().pattern(/^[0-9]{9,15}$/).required().messages({
        "string.pattern.base": "Phone must be 9–15 digits"
    })
});
