
import Joi from "joi";

export const updateMealCommissionValidator = Joi.object({
    commissionRate: Joi.number()
        .min(0)
        .max(0.5)
        .required()
        .label("Commission Rate")
        .messages({
            'number.min': 'Commission rate cannot be negative',
            'number.max': 'Commission rate cannot exceed 50%',
            'any.required': 'Commission rate is required'
        }),
    reason: Joi.string()
        .trim()
        .max(500)
        .required()
        .label("Reason for Change")
        .messages({
            'string.max': 'Reason cannot exceed 500 characters',
            'any.required': 'Reason for change is required'
        })
});

export const updateChefCommissionValidator = Joi.object({
    commissionRate: Joi.number()
        .min(0)
        .max(0.5)
        .required()
        .label("Commission Rate"),
    reason: Joi.string()
        .trim()
        .max(500)
        .required()
        .label("Reason for Change"),
    applyToFutureMeals: Joi.boolean()
        .default(false)
        .label("Apply to Future Meals")
});