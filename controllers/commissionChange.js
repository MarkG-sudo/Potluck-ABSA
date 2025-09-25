// controllers/commissionController.js
import { MealModel } from "../models/meals.js";
import { UserModel } from "../models/users.js";
import { CommissionModel } from "../models/commissionChange.js";
import { updateMealCommissionValidator, updateChefCommissionValidator } from "../validators/commissionChange.js";
import { sendUserNotification } from "../utils/push.js";

// ✅ Update commission for a specific meal
export const updateMealCommission = async (req, res, next) => {
    try {
        const { mealId } = req.params;

        // Validate admin permissions
        if (!req.auth || req.auth.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        // Validate request body
        const { error, value } = updateMealCommissionValidator.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: error.details.map(d => d.message)
            });
        }

        const { commissionRate, reason } = value;

        const meal = await MealModel.findById(mealId)
            .populate("createdBy", "firstName lastName email");

        if (!meal) {
            return res.status(404).json({ message: "Meal not found" });
        }

        // Store old rate for audit
        const oldCommissionRate = meal.commissionRate;

        // Update commission
        meal.commissionRate = commissionRate;
        await meal.save();

        // Create audit record
        await CommissionModel.create({
            admin: req.auth.id,
            meal: mealId,
            chef: meal.createdBy._id,
            oldRate: oldCommissionRate,
            newRate: commissionRate,
            reason: reason,
            changeType: "manual",
            mealsAffected: 1
        });

        // Notify chef
        await sendUserNotification(meal.createdBy._id, {
            title: "📊 Commission Rate Updated",
            body: `Commission rate for "${meal.mealName}" changed from ${(oldCommissionRate * 100).toFixed(1)}% to ${(commissionRate * 100).toFixed(1)}%`,
            url: `/chef/meals/${mealId}`
        });

        res.json({
            message: "Commission rate updated successfully",
            data: {
                meal: {
                    id: meal._id,
                    mealName: meal.mealName,
                    oldCommissionRate: oldCommissionRate,
                    newCommissionRate: commissionRate,
                    oldCommissionRatePercent: `${(oldCommissionRate * 100).toFixed(1)}%`,
                    newCommissionRatePercent: `${(commissionRate * 100).toFixed(1)}%`
                },
                chef: {
                    id: meal.createdBy._id,
                    name: `${meal.createdBy.firstName} ${meal.createdBy.lastName}`
                },
                audit: {
                    reason: reason,
                    changeType: "manual"
                }
            }
        });

    } catch (error) {
        console.error("Commission update error:", error);
        next(error);
    }
};

// ✅ Bulk update commissions for chef's all meals
export const updateChefCommission = async (req, res, next) => {
    try {
        const { chefId } = req.params;

        // Validate admin permissions
        if (!req.auth || req.auth.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        // Validate request body
        const { error, value } = updateChefCommissionValidator.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: error.details.map(d => d.message)
            });
        }

        const { commissionRate, reason, applyToFutureMeals } = value;

        const chef = await UserModel.findById(chefId);
        if (!chef || chef.role !== 'chef') {
            return res.status(404).json({ message: "Chef not found" });
        }

        // Get current meals count for audit
        const currentMealsCount = await MealModel.countDocuments({
            createdBy: chefId,
            status: "Available"
        });

        // Update all current meals
        const result = await MealModel.updateMany(
            { createdBy: chefId, status: "Available" },
            { commissionRate: commissionRate }
        );

        // Optional: Set default for future meals
        if (applyToFutureMeals) {
            await UserModel.findByIdAndUpdate(chefId, {
                defaultCommissionRate: commissionRate
            });
        }

        // Create audit record
        await CommissionModel.create({
            admin: req.auth.id,
            chef: chefId,
            oldRate: chef.defaultCommissionRate || 0.15,
            newRate: commissionRate,
            reason: reason,
            changeType: "bulk",
            mealsAffected: result.modifiedCount
        });

        // Notify chef about bulk update
        await sendUserNotification(chefId, {
            title: "📊 Commission Rates Updated",
            body: `Commission rates updated for ${result.modifiedCount} of your meals to ${(commissionRate * 100).toFixed(1)}%`,
            url: `/chef/meals`
        });

        res.json({
            message: `Commission updated for ${result.modifiedCount} meals`,
            data: {
                chef: {
                    id: chef._id,
                    name: `${chef.firstName} ${chef.lastName}`,
                    email: chef.email
                },
                updateSummary: {
                    mealsUpdated: result.modifiedCount,
                    totalAvailableMeals: currentMealsCount,
                    applyToFutureMeals: applyToFutureMeals
                },
                commission: {
                    oldRate: chef.defaultCommissionRate || 0.15,
                    newRate: commissionRate,
                    oldRatePercent: `${((chef.defaultCommissionRate || 0.15) * 100).toFixed(1)}%`,
                    newRatePercent: `${(commissionRate * 100).toFixed(1)}%`
                },
                audit: {
                    reason: reason,
                    changeType: "bulk"
                }
            }
        });

    } catch (error) {
        console.error("Bulk commission update error:", error);
        next(error);
    }
};

// ✅ Get commission audit history
export const getCommissionAudit = async (req, res, next) => {
    try {
        const { chefId, mealId } = req.query;

        let filter = {};
        if (chefId) filter.chef = chefId;
        if (mealId) filter.meal = mealId;

        const audits = await CommissionModel.find(filter)
            .populate("admin", "firstName lastName email")
            .populate("meal", "mealName")
            .populate("chef", "firstName lastName")
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            message: "Commission audit history retrieved",
            data: audits
        });

    } catch (error) {
        console.error("Get commission audit error:", error);
        next(error);
    }
};