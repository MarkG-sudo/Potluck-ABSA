import Joi from "joi";

export const addMealValidator = Joi.object({
    mealName: Joi.string().trim().required().label("Meal Name"),
    description: Joi.string().trim().required().label("Description"),
    price: Joi.number().min(1).required().label("Price (GHS)"), // Updated min to 1
    servings: Joi.number().integer().min(1).required().label("Servings"),

    // Inventory management - new
    initialServings: Joi.number().integer().min(1).required().label("Initial Servings"),
    availableServings: Joi.number().integer().min(0).default(Joi.ref('initialServings')),

    category: Joi.string().trim().required().label("Category"),
    cuisine: Joi.string().trim().required().label("Cuisine"),
    spiceLevel: Joi.string().valid("Mild", "Medium", "Hot", "Very Hot").required(),

    // Enhanced dietary restrictions - new
    dietaryRestrictions: Joi.array().items(Joi.string().valid(
        "Vegetarian", "Vegan", "Gluten-Free", "Halal", "Kosher", "Dairy-Free", "Nut-Free",
        "Pescatarian", "Low-Sodium", "Low-Sugar", "No-Pork", "No-Beef", "No-Shellfish", "Other"
    )),
    customDietaryRestrictions: Joi.array().items(Joi.string().trim()), // new

    mainIngredients: Joi.array().items(Joi.string().trim()).min(1).required(),
    cookingTime: Joi.number().min(1).required().label("Cooking Time (minutes)"),
    pickupLocation: Joi.string().trim().required(),

    // Enhanced availability - new
    availabilityPattern: Joi.string().valid('One-time', 'Daily', 'Weekly', 'Custom').default('One-time'),
    availableFrom: Joi.date().iso().required(),
    availableTo: Joi.date().iso().required(),
    recurringDays: Joi.array().items(Joi.string().valid(
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    )), // new
    cutoffTime: Joi.number().integer().min(0).max(24).default(2), // new

    photos: Joi.array().items(Joi.string().uri()).max(5),
    createdBy: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    status: Joi.string().valid("Available", "Unavailable").default("Available"),
    commissionRate: Joi.number().min(0).max(0.5).default(0.15), // Updated max to 0.5

    // Food safety and compliance - new
    preparationFacility: Joi.string().valid('Home Kitchen', 'Commercial Kitchen', 'Cloud Kitchen').default('Home Kitchen'),
    foodSafetyCertified: Joi.boolean().default(false),
    certificationNumber: Joi.string().trim().allow(''),
    allergyWarnings: Joi.array().items(Joi.string().trim()),
    storageInstructions: Joi.string().trim().allow(''),
    reheatingInstructions: Joi.string().trim().allow('')
});

// Update Meal Validator
export const updateMealValidator = Joi.object({
    mealName: Joi.string().trim(),
    description: Joi.string().trim(),
    price: Joi.number().min(1), // Updated min to 1
    servings: Joi.number().integer().min(1),

    // Inventory management - new
    initialServings: Joi.number().integer().min(1),
    availableServings: Joi.number().integer().min(0),
    soldCount: Joi.number().integer().min(0),
    isSoldOut: Joi.boolean(),

    category: Joi.string().trim(),
    cuisine: Joi.string().trim(),
    spiceLevel: Joi.string().valid("Mild", "Medium", "Hot", "Very Hot"),

    // Enhanced dietary restrictions - new
    dietaryRestrictions: Joi.array().items(Joi.string().valid(
        "Vegetarian", "Vegan", "Gluten-Free", "Halal", "Kosher", "Dairy-Free", "Nut-Free",
        "Pescatarian", "Low-Sodium", "Low-Sugar", "No-Pork", "No-Beef", "No-Shellfish", "Other"
    )),
    customDietaryRestrictions: Joi.array().items(Joi.string().trim()), // new

    mainIngredients: Joi.array().items(Joi.string().trim()),
    cookingTime: Joi.number().min(1),
    pickupLocation: Joi.string().trim(),

    // Enhanced availability - new
    availabilityPattern: Joi.string().valid('One-time', 'Daily', 'Weekly', 'Custom'),
    availableFrom: Joi.date().iso(),
    availableTo: Joi.date().iso(),
    recurringDays: Joi.array().items(Joi.string().valid(
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    )),
    cutoffTime: Joi.number().integer().min(0).max(24),

    photos: Joi.array().items(Joi.string().uri()).max(5),
    status: Joi.string().valid("Available", "Unavailable"),
    commissionRate: Joi.number().min(0).max(0.5), // Updated max to 0.5

    // Food safety and compliance - new
    preparationFacility: Joi.string().valid('Home Kitchen', 'Commercial Kitchen', 'Cloud Kitchen'),
    foodSafetyCertified: Joi.boolean(),
    certificationNumber: Joi.string().trim().allow(''),
    allergyWarnings: Joi.array().items(Joi.string().trim()),
    storageInstructions: Joi.string().trim().allow(''),
    reheatingInstructions: Joi.string().trim().allow('')
});

export const mealQueryValidator = Joi.object({
    status: Joi.string().valid("Available", "Unavailable"),
    cuisine: Joi.string().trim(),
    category: Joi.string().trim(),
    spiceLevel: Joi.string().valid("Mild", "Medium", "Hot", "Very Hot"),

    // Enhanced price filtering - new
    minPrice: Joi.number().min(1), // Updated min to 1
    maxPrice: Joi.number().min(1), // Updated min to 1

    // Inventory filtering - new
    inStock: Joi.boolean(), // Filter by isSoldOut
    availableServings: Joi.number().integer().min(0),

    // Preparation facility filtering - new
    preparationFacility: Joi.string().valid('Home Kitchen', 'Commercial Kitchen', 'Cloud Kitchen'),
    foodSafetyCertified: Joi.boolean(),

    search: Joi.string().trim(),

    // Enhanced sorting - new
    sortBy: Joi.string()
        .valid("createdAt", "price", "mealName", "averageRating", "cookingTime", "availableServings")
        .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),

    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
});