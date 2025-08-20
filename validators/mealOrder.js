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
    quantity: Joi.number().min(1).max(10).required().label("Quantity"),
    pickupTime: Joi.date()
        .iso()
        .required()
        .label("Pickup Time")
        .custom((value, helpers) => {
            const now = new Date();
            const minPickupTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes buffer
            const maxPickupTime = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes buffer

            if (value <= now) {
                return helpers.error("date.greater");
            }
            if (value < minPickupTime) {
                return helpers.error("date.tooEarly", { limit: 30 });
            }
            if (value > maxPickupTime) {
                return helpers.error("date.tooLate", { limit: 60 });
            }
            return value;
        })
        .messages({
            "date.base": "Pickup time must be a valid date",
            "date.greater": "Pickup time must be in the future",
            "date.tooEarly": "Pickup time must be at least {#limit} minutes from now to allow for preparation",
            "date.tooLate": "Pickup time cannot be more than {#limit} minutes from now" // New error message
        }),
    notes: Joi.string().max(300).optional().allow("").label("Notes"),
    paymentMethod: Joi.string().valid("paystack", "momo", "bank", "cash").required(),
    // ✅ Only required if paymentMethod === "momo"
    momo: Joi.when("paymentMethod", {
        is: "momo",
        then: Joi.object({
            phone: Joi.string()
                .pattern(/^[0-9]{10}$/) // Ghana phone format (10 digits)
                .required()
                .messages({ "string.pattern.base": "Phone must be 10 digits" }),
            provider: Joi.string()
                .valid("mtn", "vodafone", "airteltigo")
                .required()
        }),
        otherwise: Joi.forbidden()
    })
});


export const orderQueryValidator = Joi.object({
    status: Joi.string()
        .valid("Pending", "Preparing", "Ready", "Delivering", "Delivered", "Cancelled")
        .optional(),

    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),

    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid("createdAt", "pickupTime", "deliveredAt", "cancelledAt", "paidAt", "status").default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc")
});
