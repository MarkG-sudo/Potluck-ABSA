import axios from "axios";
import { MealModel } from "../models/meals.js";
import { MealOrder } from "../models/mealOrder.js";
import { sendUserNotification } from "../utils/push.js";
import { NotificationModel } from "../models/notifications.js";
import { updateOrderValidator } from "../validators/mealOrder.js";
import { createOrderValidator } from "../validators/mealOrder.js";
import crypto from "crypto";

// 🔑 Helper: generate unique Paystack reference
const generateReference = (prefix = "ORD") => {
    return `${prefix}_${crypto.randomBytes(8).toString("hex")}_${Date.now()}`;
};


export const placeOrder = async (req, res, next) => {
    try {
        // 1️⃣ Validate request
        const { error, value } = createOrderValidator.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { meal: mealId, quantity, pickupTime, notes, paymentMethod } = value;

        // 2️⃣ Fetch meal and check availability
        const meal = await MealModel.findById(mealId).populate("createdBy", "firstName lastName email");
        if (!meal) return res.status(404).json({ error: "Meal not found" });
        if (meal.status !== "Available") return res.status(400).json({ error: "Meal is not available for ordering" });

        // 3️⃣ Calculate totals
        const totalPrice = meal.price * quantity;
        const commissionRate = 0.15;
        const commission = totalPrice * commissionRate;
        const vendorEarnings = totalPrice - commission;

        // 4️⃣ Generate Paystack reference only if needed
        let paystackReference = null;
        if (paymentMethod === "card" || paymentMethod === "momo") {
            paystackReference = generateReference();
        }

        // 5️⃣ Create order
        const order = await MealOrder.create({
            meal: meal._id,
            buyer: req.auth.id,
            chef: meal.createdBy._id,
            quantity,
            totalPrice,
            status: "Pending",
            pickupTime,
            notes,
            commission,
            vendorEarnings,
            platformEarnings: commission,
            payment: {
                method: paymentMethod || "cash",
                status: "pending",
                reference: paystackReference // pre-store reference if needed
            }
        });

        // 6️⃣ Notify Chef
        await NotificationModel.create({
            user: meal.createdBy._id,
            title: "🍲 New Order",
            body: `You have a new order for ${quantity}x ${meal.mealName}.`,
            url: `/dashboard/orders/${order._id}`,
            type: "order"
        });

        // 7️⃣ Notify Buyer
        await NotificationModel.create({
            user: req.auth.id,
            title: "📦 Order Placed",
            body: `Your order for ${quantity}x ${meal.mealName} has been placed.`,
            url: `/dashboard/my-orders/${order._id}`,
            type: "order"
        });

        // 8️⃣ Respond
        res.status(201).json({
            message: "Order placed successfully",
            order,
            paymentReference: paystackReference // front-end can pick this up for /create-payment
        });

    } catch (error) {
        console.error("Place Order Error:", error);
        next(error);
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

// export const cancelOrder = async (req, res, next) => {
//     try {
//         const { orderId } = req.params;

//         const order = await MealOrder.findOne({
//             _id: orderId,
//             buyer: req.auth.id,
//             status: "Pending"
//         });

//         if (!order) {
//             return res.status(404).json({ error: "Cancellable order not found" });
//         }

//         order.status = "Cancelled";
//         order.cancelledAt = new Date(); 
//         await order.save();

//         res.json({ message: "Order cancelled successfully", order });
//     } catch (err) {
//         next(err);
//     }
// };


export const cancelOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        // 1. Find the cancellable order and populate relevant data
        const order = await MealOrder.findOne({
            _id: orderId,
            status: "Pending"
        })
            .populate('meal', 'mealName')
            .populate('buyer', 'firstName lastName role')
            .populate('chef', 'firstName lastName role');

        if (!order) {
            return res.status(404).json({ error: "Order not found or not in a cancellable state ('Pending')." });
        }

        // 2. ✅ SECURITY & VALIDATION: Explicitly check if the current user is the buyer OR the chef for this order.
        const isBuyer = req.auth.id === order.buyer._id.toString();
        const isChef = req.auth.id === order.chef._id.toString();

        if (!isBuyer && !isChef) {
            return res.status(403).json({ error: "Access denied. You can only cancel your own orders." });
        }

        // 3. Update the order status and timestamp
        order.status = "Cancelled";
        order.cancelledAt = new Date();
        await order.save();

        // 4. Determine actor and target based on ROLE + ID
        let notificationTargetId;
        let notificationTitle;
        let notificationBody;
        let actorName = `${req.auth.firstName} ${req.auth.lastName}`;

        if (isChef) {
            // Actor is the Chef -> Notify the Buyer
            notificationTargetId = order.buyer._id;
            notificationTitle = "🍳 Order Cancelled by Chef";
            notificationBody = `Chef ${actorName} has cancelled your order for ${order.quantity}x ${order.meal.mealName}.`;
        } else if (isBuyer) {
            // Actor is the Buyer -> Notify the Chef
            notificationTargetId = order.chef._id;
            notificationTitle = "❌ Order Cancelled by Customer";
            notificationBody = `${actorName} (Customer) cancelled their order for ${order.quantity}x ${order.meal.mealName}.`;
        }

        // 🔔 1. Send PUSH notification (for immediate alert)
        await sendUserNotification(notificationTargetId, {
            title: notificationTitle,
            body: notificationBody,
            url: "/orders" // Send user to their orders page
        });

        // 📬 2. Save NOTIFICATION to database (for the target's bell icon inbox)
        await NotificationModel.create({
            user: notificationTargetId, // Save it for the person who was notified
            title: notificationTitle,
            body: notificationBody,
            url: `/orders/${order._id}`, // Deep link to the specific cancelled order
            type: 'order'
        });

        // 5. Send response
        res.json({
            message: "Order cancelled successfully",
            order
        });

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

export const getOneOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        // Validate orderId
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: "Invalid order ID" });
        }

        const order = await MealOrder.findOne({
            _id: orderId,
            chef: req.auth.id 
        })
            .populate("meal", "title price photos category") // Added more meal fields
            .populate("buyer", "firstName lastName phone email") // Added email for contact
            .populate("chef", "firstName lastName phone email") // Populate chef info too
            .lean();

        if (!order) {
            return res.status(404).json({ error: "Order not found or access denied" });
        }

        res.json(order);
    } catch (err) {
        next(err);
    }
};


// ✅ Define status constants and transitions (can be exported from a constants file later)

const ORDER_STATUS = {
    PENDING: "Pending",
    PREPARING: "Preparing",
    READY: "Ready",
    DELIVERING: "Delivering",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled"
};

// Allowed transitions (state machine)
const statusTransitions = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.READY]: [ORDER_STATUS.DELIVERING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: []
};

export const updateOrderStatus = async (req, res, next) => {
    try {
        // ✅ Joi validation
        const { error, value } = updateOrderValidator.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const { status } = value;
        const { orderId } = req.params;

        // ✅ Find order (only the chef can update)
        const order = await MealOrder.findOne({ _id: orderId, chef: req.auth.id });
        if (!order) {
            return res.status(404).json({ error: "Order not found or unauthorized" });
        }

        // ✅ Check transition rules
        const validNextStatuses = statusTransitions[order.status] || [];
        if (!validNextStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status transition from '${order.status}' to '${status}'`
            });
        }

        // ✅ Apply status + timestamps
        order.status = status;
        if (status === ORDER_STATUS.PREPARING) order.acceptedAt = new Date();
        if (status === ORDER_STATUS.READY) order.readyAt = new Date();
        if (status === ORDER_STATUS.DELIVERING) order.deliveringAt = new Date();
        if (status === ORDER_STATUS.DELIVERED) order.deliveredAt = new Date();
        if (status === ORDER_STATUS.CANCELLED) order.cancelledAt = new Date();

        order.updatedBy = req.auth.id;
        await order.save();

        // ✅ Send notification to buyer
        let notificationTitle, notificationBody;
        switch (status) {
            case ORDER_STATUS.PREPARING:
                notificationTitle = "Order Accepted";
                notificationBody = "Your order is now being prepared.";
                break;
            case ORDER_STATUS.READY:
                notificationTitle = "Order Ready";
                notificationBody = "Your order is ready for pickup.";
                break;
            case ORDER_STATUS.DELIVERING:
                notificationTitle = "Order Out for Delivery";
                notificationBody = "Your order is on the way.";
                break;
            case ORDER_STATUS.DELIVERED:
                notificationTitle = "Order Delivered";
                notificationBody = "Your order has been delivered.";
                break;
            case ORDER_STATUS.CANCELLED:
                notificationTitle = "Order Cancelled";
                notificationBody = "Your order has been cancelled.";
                break;
            default:
                notificationTitle = "Order Updated";
                notificationBody = `Your order status changed to ${status}.`;
        }

        // Push + DB notification
        await sendUserNotification(order.buyer._id, {
            title: notificationTitle,
            body: notificationBody
        });

        await NotificationModel.create({
            user: order.buyer._id,
            title: notificationTitle,
            body: notificationBody,
            order: order._id
        });

        // ✅ Return populated order
        const populatedOrder = await order.populate("meal buyer");
        res.json({
            message: `Order status updated to '${status}' successfully.`,
            order: populatedOrder
        });

    } catch (err) {
        next(err);
    }
};


// saved

// export const placeOrder = async (req, res, next) => {
//     try {
//         // ✅ Validate request body
//         const { error, value } = createOrderValidator.validate(req.body);
//         if (error) {
//             return res.status(422).json({ error: error.details.map(d => d.message) });
//         }

//         const { meal, quantity, pickupTime, notes } = value;

//         // ✅ Find meal
//         const mealDoc = await Meal.findById(meal).populate("createdBy", "_id");
//         if (!mealDoc) {
//             return res.status(404).json({ error: "Meal not found" });
//         }

//         // ✅ Prevent ordering unavailable meals
//         if (mealDoc.status !== "Available" && mealDoc.status !== "Approved") {
//             return res.status(400).json({ error: "Meal is not available for ordering" });
//         }

//         const totalPrice = mealDoc.price * quantity;
//         const chef = mealDoc.createdBy._id;

//         const newOrder = await MealOrder.create({
//             meal,
//             buyer: req.auth.id,
//             chef,
//             quantity,
//             pickupTime,
//             totalPrice,
//             notes
//         });

//         res.status(201).json({
//             message: "Order placed successfully",
//             order: newOrder
//         });
//     } catch (err) {
//         next(err);
//     }
// };