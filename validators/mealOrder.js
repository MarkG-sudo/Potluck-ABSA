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
    pickupTime: Joi.date().iso().required().label("Pickup Time")
        .custom((value, helpers) => {
            const now = new Date();
            const minPickupTime = new Date(now.getTime() + 30 * 60 * 1000);
            const maxPickupTime = new Date(now.getTime() + 60 * 60 * 1000);

            if (value <= now) return helpers.error("date.greater");
            if (value < minPickupTime) return helpers.error("date.tooEarly", { limit: 30 });
            if (value > maxPickupTime) return helpers.error("date.tooLate", { limit: 60 });
            return value;
        })
        .messages({
            "date.base": "Pickup time must be a valid date",
            "date.greater": "Pickup time must be in the future",
            "date.tooEarly": "Pickup time must be at least {#limit} minutes from now",
            "date.tooLate": "Pickup time cannot be more than {#limit} minutes from now"
        }),
    notes: Joi.string().max(300).optional().allow("").label("Notes"),
    paymentMethod: Joi.string().valid("card", "momo", "bank", "cash").required(),
    momo: Joi.when("paymentMethod", {
        is: "momo",
        then: Joi.object({
            phone: Joi.string().pattern(/^[0-9]{10}$/).required()
                .messages({ "string.pattern.base": "Phone must be 10 digits" }),
            provider: Joi.string().valid("mtn", "vod", "atl").required()
        }),
        otherwise: Joi.forbidden()
    })
});

// 🔹 Update order status + optional timestamps
export const updateOrderValidator = Joi.object({
    status: Joi.string()
        .valid("Pending", "Preparing", "Ready", "Delivering", "Delivered", "Cancelled")
        .required()
        .label("Order Status"),

    // Optional fields that might be set when status changes
    acceptedAt: Joi.date().iso(),
    readyAt: Joi.date().iso(),
    deliveringAt: Joi.date().iso(),
    deliveredAt: Joi.date().iso(),
    cancelledAt: Joi.date().iso(),
    paidAt: Joi.date().iso(),

    updatedBy: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .label("Updated By (User ID)")
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
