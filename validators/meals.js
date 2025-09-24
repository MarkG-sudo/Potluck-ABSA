import Joi from "joi";


export const addMealValidator = Joi.object({
    mealName: Joi.string().trim().required().label("Meal Name"),
    description: Joi.string().trim().required().label("Description"),
    price: Joi.number().min(0).required().label("Price (GHS)"),
    servings: Joi.number().integer().min(1).required().label("Servings"),
    category: Joi.string().trim().required().label("Category"),
    cuisine: Joi.string().trim().required().label("Cuisine"),
    spiceLevel: Joi.string().valid("Mild", "Medium", "Hot", "Very Hot").required(),
    dietaryRestrictions: Joi.array().items(Joi.string().valid(
        "Vegetarian", "Vegan", "Gluten-Free", "Halal", "Kosher", "Dairy-Free", "Nut-Free"
    )),
    mainIngredients: Joi.array().items(Joi.string().trim()).min(1).required(),
    cookingTime: Joi.number().min(1).required().label("Cooking Time (minutes)"),
    pickupLocation: Joi.string().trim().required(),
    availableFrom: Joi.date().iso().required(),
    availableTo: Joi.date().iso().required(),
    photos: Joi.array().items(Joi.string().uri()).max(5),
    createdBy: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    status: Joi.string().valid("Available", "Unavailable", "Pending", "Approved", "Rejected"),
    commissionRate: Joi.number().min(0).max(1).default(0.15) // new
});


// Update Meal Validator
export const updateMealValidator = Joi.object({
    mealName: Joi.string().trim(),
    description: Joi.string().trim(),
    price: Joi.number().min(0),
    servings: Joi.number().integer().min(1),
    category: Joi.string().trim(),
    cuisine: Joi.string().trim(),
    spiceLevel: Joi.string().valid("Mild", "Medium", "Hot", "Very Hot"),
    dietaryRestrictions: Joi.array().items(Joi.string().valid(
        "Vegetarian", "Vegan", "Gluten-Free", "Halal", "Kosher", "Dairy-Free", "Nut-Free"
    )),
    mainIngredients: Joi.array().items(Joi.string().trim()),
    cookingTime: Joi.number().min(1),
    pickupLocation: Joi.string().trim(),
    availableFrom: Joi.date().iso(),
    availableTo: Joi.date().iso(),
    photos: Joi.array().items(Joi.string().uri()).max(5),
    status: Joi.string().valid("Available", "Unavailable", "Pending", "Approved", "Rejected"),
    commissionRate: Joi.number().min(0).max(1) // new
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