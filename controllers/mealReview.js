import { UserModel } from "../models/users.js";
import { MealReview } from "../models/mealReview.js";
import { mealReviewValidator } from "../validators/mealReview.js"

export const createMealReview = async (req, res, next) => {
    const { mealId } = req.params;
    const { error, value } = mealReviewValidator.validate(req.body);

    if (error) {
        return res.status(422).json({ error: error.details.map(d => d.message) });
    }

    try {
        const review = await MealReview.create({
            meal: mealId,
            reviewer: req.auth.id,
            rating: value.rating,
            comment: value.comment
        });

        res.status(201).json({ message: "Review submitted", review });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "You've already reviewed this meal." });
        }
        next(err);
    }
};


// Get all reviews for a meal
export const getMealReviews = async (req, res, next) => {
    try {
        const reviews = await MealReview.find({ meal: req.params.mealId })
            .populate("reviewer", "firstName lastName")
            .sort("-createdAt");

        res.json(reviews);
    } catch (err) {
        next(err);
    }
};

export const updateMealReview = async (req, res, next) => {
    const { mealId } = req.params;
    const { error, value } = mealReviewValidator.validate(req.body);

    if (error) {
        return res.status(422).json({ error: error.details.map(d => d.message) });
    }

    try {
        const updated = await MealReview.findOneAndUpdate(
            { meal: mealId, reviewer: req.auth.id },
            {
                rating: value.rating,
                comment: value.comment
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updated) {
            return res.status(404).json({ error: "Review not found or not yours." });
        }

        res.json({
            message: "Review updated successfully",
            review: updated
        });
    } catch (err) {
        next(err);
    }
};

export const deleteMealReview = async (req, res, next) => {
    try {
        const { mealId } = req.params;

        const deleted = await MealReview.findOneAndDelete({
            meal: mealId,
            reviewer: req.auth.id
        });

        if (!deleted) {
            return res.status(404).json({ error: "Review not found or not yours." });
        }

        res.json({ message: "Review deleted successfully" });
    } catch (err) {
        next(err);
    }
};


// Toggle favorite
export const toggleFavoriteMeal = async (req, res, next) => {
    try {
        const { mealId } = req.params;
        const user = await UserModel.findById(req.auth.id);

        const alreadyFavorited = user.favorites.includes(mealId);

        if (alreadyFavorited) {
            user.favorites.pull(mealId);
        } else {
            user.favorites.push(mealId);
        }

        await user.save();

        res.json({
            message: alreadyFavorited ? "Removed from favorites" : "Added to favorites",
            favorites: user.favorites
        });
    } catch (err) {
        next(err);
    }
};

// Get all favorites
export const getMyFavorites = async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.auth.id).populate("favorites");
        res.json(user.favorites);
    } catch (err) {
        next(err);
    }
};

