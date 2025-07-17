import { Router } from "express";
import {
    createMeal, getAllMeals, getMyMeals, updateMeal, deleteMeal, getMealById, updateMealStatusByChef, moderateMealStatusByAdmin, getMyMealById } from "../controllers/meals.js";
import { mealImageUpload } from "../middlewares/cloudinary.js"; 
import { isAuthenticated, hasPermission } from "../middlewares/auth.js";


const mealRouter = Router();

// Create a new meal (Potchef only)
mealRouter.post(
    "/meals",
    isAuthenticated,
    hasPermission("upload_meal"),
    mealImageUpload.array("photos", 5),
    createMeal
);

// Get all meals (Admin / public feed)
mealRouter.get("/meals", isAuthenticated, hasPermission("view_all_meals"), getAllMeals);

// Get only the logged-in chef’s meals
mealRouter.get("/meals/mine", isAuthenticated, hasPermission("view_my_meals"), getMyMeals);

mealRouter.get("/meals/mine/:id", isAuthenticated, hasPermission("view_my_meals"), getMyMealById);

// Update meal
mealRouter.patch(
    "/meals/:id",
    isAuthenticated,
    hasPermission("update_meal"),
    mealImageUpload.array("photos", 5),
    updateMeal
);

// Delete meal
mealRouter.delete(
    "/meals/:id",
    isAuthenticated,
    hasPermission("delete_meal"),
    deleteMeal
);

// view one meal by all
mealRouter.get("/meals/:id", isAuthenticated, getMealById);




// Potchef sets Available/Unavailable
mealRouter.patch(
    "/meals/:id/status",
    isAuthenticated,
    hasPermission("update_meal_status"),
    updateMealStatusByChef
);

// Admin/Operator approves or rejects
mealRouter.patch(
    "/meals/:id/moderate",
    isAuthenticated,
    hasPermission("moderate_meal_status"),
    moderateMealStatusByAdmin
);

export default mealRouter;
