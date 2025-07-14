import Joi from "joi";

export const mealReviewValidator = Joi.object({
    rating: Joi.number()
        .required()
        .min(1)
        .max(5)
        .messages({
            "number.base": "Rating must be a number",
            "number.min": "Rating must be at least 1",
            "number.max": "Rating must be at most 5",
            "any.required": "Rating is required"
        }),

    comment: Joi.string()
        .allow("")
        .max(500)
        .messages({
            "string.max": "Comment must not exceed 500 characters"
        })
});
