import Joi from "joi";

// Custom ObjectId checker (optional)
const objectIdValidator = (value, helpers) => {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
        return helpers.error("any.invalid");
    }
    return value;
};

export const createOrderValidator = Joi.object({
    meal: Joi.string().custom(objectIdValidator).required().label("Meal ID"),
    quantity: Joi.number().min(1).required().label("Quantity"),
    pickupTime: Joi.date().iso().greater("now").required().label("Pickup Time").messages({
        "date.base": "Pickup time must be a valid date",
        "date.greater": "Pickup time must be in the future"
    }), 
    notes: Joi.string().max(300).optional().allow("").label("Notes")
});


export const orderQueryValidator = Joi.object({
    status: Joi.string()
        .valid("Pending", "Accepted", "Rejected", "Cancelled", "Delivered")
        .optional(),

    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),

    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid("createdAt", "pickupTime", "status").default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc")
});
