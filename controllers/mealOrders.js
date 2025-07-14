import { Meal } from "../models/meals.js";
import { MealOrder } from "../models/mealOrder.js";
import { createOrderValidator, orderQueryValidator } from "../validators/mealOrder.js";

export const placeOrder = async (req, res, next) => {
    try {
        // ✅ Validate request body
        const { error, value } = createOrderValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const { meal, quantity, pickupTime, notes } = value;

        // ✅ Find meal
        const mealDoc = await Meal.findById(meal).populate("createdBy", "_id");
        if (!mealDoc) {
            return res.status(404).json({ error: "Meal not found" });
        }

        // ✅ Prevent ordering unavailable meals
        if (mealDoc.status !== "Available" && mealDoc.status !== "Approved") {
            return res.status(400).json({ error: "Meal is not available for ordering" });
        }

        const totalPrice = mealDoc.price * quantity;
        const chef = mealDoc.createdBy._id;

        const newOrder = await MealOrder.create({
            meal,
            buyer: req.auth.id,
            chef,
            quantity,
            pickupTime,
            totalPrice,
            notes
        });

        res.status(201).json({
            message: "Order placed successfully",
            order: newOrder
        });
    } catch (err) {
        next(err);
    }
};

export const getMyOrders = async (req, res, next) => {
    try {
        const { error, value } = orderQueryValidator.validate(req.query);
        if (error) return res.status(400).json({ error: error.details.map(d => d.message) });

        const { page, limit, sortBy, sortOrder, status, from, to } = value;
        const skip = (page - 1) * limit;

        const filter = { buyer: req.auth.id };
        if (status) filter.status = status;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const orders = await MealOrder.find(filter)
            .populate("meal", "title price photos")
            .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await MealOrder.countDocuments(filter);

        res.json({
            page,
            totalPages: Math.ceil(total / limit),
            total,
            orders
        });
    } catch (err) {
        next(err);
    }
};

export const cancelOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        const order = await MealOrder.findOne({
            _id: orderId,
            buyer: req.auth.id,
            status: "Pending"
        });

        if (!order) {
            return res.status(404).json({ error: "Cancellable order not found" });
        }

        order.status = "Cancelled";
        order.cancelledAt = new Date(); 
        await order.save();

        res.json({ message: "Order cancelled successfully", order });
    } catch (err) {
        next(err);
    }
};


// POTCHEF
export const getChefOrders = async (req, res, next) => {
    try {
        const { error, value } = orderQueryValidator.validate(req.query);
        if (error) return res.status(400).json({ error: error.details.map(d => d.message) });

        const { page, limit, sortBy, sortOrder, status, from, to } = value;
        const skip = (page - 1) * limit;

        const filter = { chef: req.auth.id };
        if (status) filter.status = status;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const orders = await MealOrder.find(filter)
            .populate("meal", "title price")
            .populate("buyer", "firstName lastName phone")
            .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await MealOrder.countDocuments(filter);

        res.json({
            page,
            totalPages: Math.ceil(total / limit),
            total,
            orders
        });
    } catch (err) {
        next(err);
    }
};


export const updateOrderStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const allowed = ["Accepted", "Rejected", "Delivered"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: "Invalid status update" });
        }

        const order = await MealOrder.findOne({
            _id: orderId,
            chef: req.auth.id
        });

        if (!order) {
            return res.status(404).json({ error: "Order not found or access denied" });
        }

        order.status = status;

        // ⏱ Optional timestamps
        if (status === "Accepted") order.acceptedAt = new Date();
        if (status === "Rejected") order.rejectedAt = new Date();
        if (status === "Delivered") order.deliveredAt = new Date();

        order.updatedBy = req.auth.id;

        await order.save();

        res.json({
            message: `Order has been ${status.toLowerCase()}`,
            order
        });
    } catch (err) {
        next(err);
    }
};
