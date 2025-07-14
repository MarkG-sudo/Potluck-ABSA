import Joi from "joi";


export const addMealValidator = Joi.object({
    mealName: Joi.string().trim().required().label("Meal Name"),
    description: Joi.string().trim().required().label("Description"),
    price: Joi.number().min(0).required().label("Price (GHS)"),
    servings: Joi.number().integer().min(1).required().label("Servings"),

    category: Joi.string().trim().required().label("Category"),
    cuisine: Joi.string().trim().required().label("Cuisine"),

    spiceLevel: Joi.string()
        .valid("Mild", "Medium", "Hot", "Very Hot")
        .required()
        .label("Spice Level"),

    dietaryRestrictions: Joi.array()
        .items(
            Joi.string().valid(
                "Vegetarian",
                "Vegan",
                "Gluten-Free",
                "Halal",
                "Kosher",
                "Dairy-Free",
                "Nut-Free"
            )
        )
        .label("Dietary Restrictions"),

    mainIngredients: Joi.array()
        .items(Joi.string().trim())
        .min(1)
        .required()
        .label("Main Ingredients"),

    cookingTime: Joi.number().min(1).required().label("Cooking Time (minutes)"),

    pickupLocation: Joi.string().trim().required().label("Pickup Location"),

    availableFrom: Joi.date().iso().required().label("Available From"),
    availableTo: Joi.date().iso().required().label("Available To"),

    photos: Joi.array()
        .items(Joi.string().uri())
        .max(5)
        .label("Meal Photos"),

    createdBy: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .label("Created By")
});

// Update Meal Validator
export const updateMealValidator = Joi.object({
    mealName: Joi.string().trim().label("Meal Name"),
    description: Joi.string().trim().label("Description"),
    price: Joi.number().min(0).label("Price (GHS)"),
    servings: Joi.number().integer().min(1).label("Servings"),

    category: Joi.string().trim().label("Category"),
    cuisine: Joi.string().trim().label("Cuisine"),

    spiceLevel: Joi.string()
        .valid("Mild", "Medium", "Hot", "Very Hot")
        .label("Spice Level"),

    dietaryRestrictions: Joi.array()
        .items(
            Joi.string().valid(
                "Vegetarian",
                "Vegan",
                "Gluten-Free",
                "Halal",
                "Kosher",
                "Dairy-Free",
                "Nut-Free"
            )
        )
        .label("Dietary Restrictions"),

    mainIngredients: Joi.array()
        .items(Joi.string().trim())
        .label("Main Ingredients"),

    cookingTime: Joi.number().min(1).label("Cooking Time (minutes)"),

    pickupLocation: Joi.string().trim().label("Pickup Location"),

    availableFrom: Joi.date().iso().label("Available From"),
    availableTo: Joi.date().iso().label("Available To"),

    photos: Joi.array()
        .items(Joi.string().uri())
        .max(5)
        .label("Meal Photos")
});

export const mealQueryValidator = Joi.object({
    status: Joi.string().valid("Pending", "Approved", "Rejected", "Available", "Unavailable"),

    cuisine: Joi.string().trim(),
    category: Joi.string().trim(),
    spiceLevel: Joi.string().valid("Mild", "Medium", "Hot", "Very Hot"),

    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),

    search: Joi.string().trim(),

    sortBy: Joi.string()
        .valid("createdAt", "price", "mealName")
        .default("createdAt"),

    sortOrder: Joi.string().valid("asc", "desc").default("desc"),

    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
});