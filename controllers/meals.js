import { addMealValidator, updateMealValidator, mealQueryValidator } from "../validators/meals.js";
import { Meal } from "../models/meals.js";
import mongoose from "mongoose";

// Create a new Meal
export const createMeal = async (req, res, next) => {
    try {
        const { error, value } = addMealValidator.validate(req.body);
        if (error) {
            return res.status(422).json({
                error: error.details.map(detail => detail.message),
            });
        }

        const photoUrls = req.files?.photos?.map(file => file.path) || [];
        if (photoUrls.length > 5) {
            return res.status(400).json({ error: "Maximum of 5 photos allowed" });
        }

        const meal = await Meal.create({
            ...value,
            photos: photoUrls,
            createdBy: req.auth.id,
        });

        res.status(201).json({
            message: `Meal "${meal.mealName}" created successfully.`,
            meal,
        });
    } catch (error) {
        next(error);
    }
};

// Get all meals (Admin/General view)
export const getAllMeals = async (req, res, next) => {
    try {
        const { error, value } = mealQueryValidator.validate(req.query);
        if (error) {
            return res.status(422).json({
                error: error.details.map(detail => detail.message),
            });
        }

        const {
            status,
            cuisine,
            category,
            spiceLevel,
            minPrice,
            maxPrice,
            search,
            sortBy,
            sortOrder,
            page,
            limit
        } = value;

        const filter = {};

        if (status) filter.status = status;
        if (cuisine) filter.cuisine = new RegExp(cuisine, "i");
        if (category) filter.category = new RegExp(category, "i");
        if (spiceLevel) filter.spiceLevel = spiceLevel;

        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = minPrice;
            if (maxPrice) filter.price.$lte = maxPrice;
        }

        if (search) {
            const regex = new RegExp(search, "i");
            filter.$or = [
                { mealName: regex },
                { description: regex },
                { cuisine: regex },
                { category: regex }
            ];
        }

        const sort = {
            [sortBy]: sortOrder === "asc" ? 1 : -1,
            _id: -1
        };

        const skip = (page - 1) * limit;

        const total = await Meal.countDocuments(filter);
        const meals = await Meal.find(filter)
            .populate("createdBy", "firstName lastName email")
            .sort(sort)
            .skip(skip)
            .limit(limit);

        res.json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            meals
        });
    } catch (error) {
        next(error);
    }
};
// Get meals by Potchef (authenticated)
export const getMyMeals = async (req, res, next) => {
    try {
        const meals = await Meal.find({ createdBy: req.auth.id });
        res.json(meals);
    } catch (error) {
        next(error);
    }
};
// Get one of meals by Potchef (authenticated)
export const getMyMealById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid meal ID" });
        }

        const meal = await Meal.findOne({
            _id: id,
            createdBy: req.auth.id
        });

        if (!meal) {
            return res.status(404).json({ error: "Meal not found or access denied" });
        }

        res.json(meal);
    } catch (err) {
        next(err);
    }
};
// Update meal by ID
export const updateMeal = async (req, res, next) => {
    try {
        const mealId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(mealId)) {
            return res.status(400).json({ error: "Invalid meal ID" });
        }

        const updateData = req.body;

        // Validate request body using Joi
        const { error, value } = updateMealValidator.validate(updateData);
        if (error) {
            return res.status(422).json({
                error: error.details.map(detail => detail.message),
            });
        }

        // Attach Cloudinary photo URLs if new photos were uploaded
        if (req.files?.photos?.length > 0) {
            value.photos = req.files.photos.map(file => file.path);
        }

        const updatedMeal = await Meal.findOneAndUpdate(
            { _id: mealId, createdBy: req.auth.id },
            value,
            { new: true, runValidators: true }
        );

        if (!updatedMeal) {
            return res.status(404).json({ error: "Meal not found or access denied" });
        }

        res.json({
            message: "Meal updated successfully.",
            meal: updatedMeal,
        });
    } catch (error) {
        next(error);
    }
};

// Delete meal by ID
export const deleteMeal = async (req, res, next) => {
    try {
        const mealId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(mealId)) {
            return res.status(400).json({ error: "Invalid meal ID" });
        }

        const deleted = await Meal.findOneAndDelete({
            _id: mealId,
            createdBy: req.auth.id
        });

        if (!deleted) {
            return res.status(404).json({ error: "Meal not found or access denied" });
        }

        res.json({ message: "Meal deleted successfully." });
    } catch (error) {
        next(error);
    }
};

export const updateMealStatusByChef = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["Available", "Unavailable"].includes(status)) {
            return res.status(400).json({ error: "Invalid status for Potchef" });
        }

        const updated = await Meal.findOneAndUpdate(
            { _id: id, createdBy: req.auth.id },
            { status },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Meal not found or access denied" });
        }

        res.json({
            message: `Meal marked as ${status}`,
            meal: updated
        });
    } catch (error) {
        next(error);
    }
};


export const moderateMealStatusByAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ error: "Only Approved or Rejected allowed for admin moderation" });
        }

        const updated = await Meal.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Meal not found" });
        }

        res.json({
            message: `Meal ${status.toLowerCase()}`,
            meal: updated
        });
    } catch (error) {
        next(error);
    }
};

export const getMealById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid meal ID" });
        }

        const meal = await Meal.findById(id).populate("createdBy", "firstName lastName avatar");

        if (!meal) {
            return res.status(404).json({ error: "Meal not found" });
        }

        res.json(meal);
    } catch (err) {
        next(err);
    }
};