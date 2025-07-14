
import express from "express";
import { createMealReview, getMealReviews, toggleFavoriteMeal, getMyFavorites, updateMealReview, deleteMealReview  } from "../controllers/mealReview.js"; 
import { isAuthenticated, hasPermission } from "../middlewares/auth.js";

const reviewMealRouter = express.Router();


reviewMealRouter.post("/meals/:mealId/review", isAuthenticated, hasPermission("review_meal"), createMealReview);
reviewMealRouter.get("/meals/:mealId/reviews", getMealReviews);

reviewMealRouter.patch("/meals/:mealId/review", isAuthenticated, updateMealReview);
reviewMealRouter.delete("/meals/:mealId/review", isAuthenticated, deleteMealReview);

// Favorites
reviewMealRouter.post("/meals/:mealId/favorite", isAuthenticated, toggleFavoriteMeal);
reviewMealRouter.get("/meals/favorites", isAuthenticated, getMyFavorites);

export default reviewMealRouter;