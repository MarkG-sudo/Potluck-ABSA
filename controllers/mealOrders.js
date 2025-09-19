import axios from "axios";
import { Meal } from "../models/meals.js";
import { MealOrder } from "../models/mealOrder.js";
import { createOrderValidator, orderQueryValidator } from "../validators/mealOrder.js";
import { initiatePayment } from "../utils/paystack.js"; // 
import { sendUserNotification } from "../utils/push.js";
import { NotificationModel } from "../models/notifications.js";
import mongoose from "mongoose";



// POtlucky


// Helper: generate unique Paystack reference
const generateReference = (prefix = "ORD") => {
    return `${prefix}_${crypto.randomBytes(8).toString("hex")}_${Date.now()}`;
};

export const placeOrder = async (req, res, next) => {
    try {
        // ✅ Validate request body
        const { error, value } = createOrderValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const { meal, quantity, pickupTime, notes, paymentMethod, momo } = value;

        // ✅ Find meal
        const mealDoc = await Meal.findById(meal).populate("createdBy", "_id");
        if (!mealDoc) {
            return res.status(404).json({ error: "Meal not found" });
        }

        // ✅ Prevent ordering unavailable meals
        if (mealDoc.status !== "Available" && mealDoc.status !== "Approved") {
            return res.status(400).json({ error: "Meal is not available for ordering" });
        }

        // 💰 Calculate price & commission
        const mealPrice = mealDoc.price * quantity;
        const commission = mealPrice * 0.15;
        const vendorEarnings = mealPrice - commission;
        const chef = mealDoc.createdBy._id;

        // ✅ Generate unique payment reference (before hitting Paystack)
        const paymentReference = generateReference("ORD");

        // ✅ Create order first (status pending)
        const newOrder = await MealOrder.create({
            meal,
            buyer: req.auth.id,
            chef,
            quantity,
            pickupTime,
            totalPrice: mealPrice,
            commission,
            vendorEarnings,
            platformEarnings: commission,
            notes,
            payment: {
                method: paymentMethod,
                status: "pending",
                reference: paymentReference
            }
        });

        let paystackResponse = null;

        // ✅ Handle online payments
        if (paymentMethod !== "cash") {
            try {
                const customerEmail = req.auth.email || `${req.auth.id}@yourapp.com`; // fallback

                paystackResponse = await initiatePayment({
                    email: customerEmail,
                    amount: mealPrice * 100,
                    reference: paymentReference, // 🔑 use our generated reference
                    metadata: {
                        orderId: newOrder._id.toString(),
                        buyerId: req.auth.id,
                        chefId: chef,
                        paymentMethod
                    },
                    momo
                });

                // Save reference in case Paystack overrides it
                newOrder.payment.reference = paystackResponse.data.reference;
                await newOrder.save();
            } catch (err) {
                return res.status(500).json({
                    error: "Payment initialization failed",
                    details: err.message
                });
            }
        }

        // ✅ Auto-populate meal, chef, buyer
        const populatedOrder = await MealOrder.findById(newOrder._id)
            .populate("buyer", "firstName lastName email")
            .populate("chef", "firstName lastName email")
            .populate("meal", "mealName price");

        // 🔔 1. Send PUSH notification to chef
        await sendUserNotification(chef, {
            title: "🍽️ New Order Received",
            body: `A customer just ordered ${quantity}x ${mealDoc.mealName}.`,
            url: "/dashboard/orders"
        });

        // 📬 2. Save NOTIFICATION to database
        await NotificationModel.create({
            user: chef,
            title: "🍽️ New Order",
            body: `You have a new order for ${quantity}x ${mealDoc.mealName}.`,
            url: `/dashboard/orders/${newOrder._id}`,
            type: "order"
        });

        res.status(201).json({
            message: "Order placed successfully",
            order: populatedOrder,
            payment: paystackResponse ? paystackResponse.data : null
        });
    } catch (err) {
        next(err);
    }
};

// export const placeOrder = async (req, res, next) => {
//     try {
//         // ✅ Validate request body
//         const { error, value } = createOrderValidator.validate(req.body);
//         if (error) {
//             return res.status(422).json({ error: error.details.map(d => d.message) });
//         }

//         const { meal, quantity, pickupTime, notes, paymentMethod } = value;

//         // ✅ Find meal
//         const mealDoc = await Meal.findById(meal).populate("createdBy", "_id");
//         if (!mealDoc) {
//             return res.status(404).json({ error: "Meal not found" });
//         }

//         // ✅ Prevent ordering unavailable meals
//         if (mealDoc.status !== "Available" && mealDoc.status !== "Approved") {
//             return res.status(400).json({ error: "Meal is not available for ordering" });
//         }

       
//         // 💰 Calculate price & commission
//         const mealPrice = mealDoc.price * quantity;
//         const commission = mealPrice * 0.15;
//         const vendorEarnings = mealPrice - commission;

//         const chef = mealDoc.createdBy._id;

//         const newOrder = await MealOrder.create({
//             meal,
//             buyer: req.auth.id,
//             chef,
//             quantity,
//             pickupTime,
//             totalPrice: mealPrice,
//             commission,
//             vendorEarnings,
//             notes,
//             payment: { method: paymentMethod, status: "pending" }
//         });

//         let paystackResponse = null;

//         if (paymentMethod !== "cash") {
//             try {
//                 if (paymentMethod === "momo") {
//                     paystackResponse = await axios.post(
//                         "https://api.paystack.co/charge",
//                         {
//                             email: req.auth.email,
//                             amount: mealPrice * 100, // in pesewa
//                             currency: "GHS",
//                             mobile_money: {
//                                 phone: req.auth.phone,
//                                 provider: "mtn" // TODO: dynamic based on user input
//                             }
//                         },
//                         { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
//                     );
//                 } else {
//                     paystackResponse = await axios.post(
//                         "https://api.paystack.co/transaction/initialize",
//                         {
//                             email: req.auth.email,
//                             amount: mealPrice * 100,
//                             currency: "GHS",
//                             channels: paymentMethod === "bank" ? ["bank"] : ["card"]
//                         },
//                         { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
//                     );
//                 }

//                 newOrder.payment.reference = paystackResponse.data.data.reference;
//                 await newOrder.save();
//             } catch (err) {
//                 return res.status(500).json({ error: "Payment initialization failed", details: err.message });
//             }
//         }

//         // ✅ Auto-populate meal, chef, buyer
//         const populatedOrder = await MealOrder.findById(newOrder._id);
//         // 🔔 Notify chef of new order
//         await sendUserNotification(chef, {
//             title: "🍽️ New Order Received",
//             body: `A customer just ordered ${quantity}x ${mealDoc.mealName}.`,
//             url: "/dashboard/orders"
//         });

//         res.status(201).json({
//             message: "Order placed successfully",
//             order: populatedOrder,
//             payment: paystackResponse ? paystackResponse.data.data : null
//         });
//     } catch (err) {
//         next(err);
//     }
// };

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


// export const updateOrderStatus = async (req, res, next) => {
//     try {
//         const { orderId } = req.params;
//         const { status } = req.body;

//         const allowed = ["Preparing", "Ready", "Delivering", "Delivered", "Cancelled"];
//         if (!allowed.includes(status)) {
//             return res.status(400).json({ error: "Invalid status update" });
//         }

//         const order = await MealOrder.findOne({
//             _id: orderId,
//             chef: req.auth.id
//         }).populate("meal buyer");

//         if (!order) {
//             return res.status(404).json({ error: "Order not found or access denied" });
//         }

//         order.status = status;
//         if (status === "Preparing") order.acceptedAt = new Date();
//         if (status === "Ready") order.readyAt = new Date();
//         if (status === "Delivering") order.deliveringAt = new Date();
//         if (status === "Delivered") order.deliveredAt = new Date();
//         if (status === "Cancelled") order.cancelledAt = new Date();

//         order.updatedBy = req.auth.id;
//         await order.save();

//         // 🔔 Notify buyer of order update
//         const mealName = order.meal?.mealName || "your meal";
//         await sendUserNotification(order.buyer._id, {
//             title: "📦 Order Update",
//             body: `Your order for ${mealName} is now ${status}.`,
//             url: "/orders"
//         });

//         res.json({
//             message: `Order has been ${status.toLowerCase()}`,
//             order
//         });
//     } catch (err) {
//         next(err);
//     }
// };


// ✅ Define status constants and transitions (can be exported from a constants file later)

const ORDER_STATUS = {
    PENDING: 'Pending',
    PREPARING: 'Preparing',
    READY: 'Ready',
    DELIVERING: 'Delivering',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled'
};

// Define a state machine for logical status transitions
const statusTransitions = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.READY]: [ORDER_STATUS.DELIVERING],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.DELIVERED]: [], // Final state
    [ORDER_STATUS.CANCELLED]: []  // Final state
};

export const updateOrderStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        // ✅ Use the constants for validation
        const allowedStatuses = Object.values(ORDER_STATUS);
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status value" });
        }

        const order = await MealOrder.findOne({
            _id: orderId,
            chef: req.auth.id
        }).populate("meal buyer");

        if (!order) {
            return res.status(404).json({ error: "Order not found or access denied" });
        }

        // ✅ Check for logical status transition
        if (!statusTransitions[order.status].includes(status)) {
            return res.status(400).json({
                error: `Cannot change status from '${order.status}' to '${status}'.`
            });
        }

        // ✅ Update status and timestamps
        order.status = status;
        if (status === ORDER_STATUS.PREPARING) order.acceptedAt = new Date();
        if (status === ORDER_STATUS.READY) order.readyAt = new Date();
        if (status === ORDER_STATUS.DELIVERING) order.deliveringAt = new Date();
        if (status === ORDER_STATUS.DELIVERED) order.deliveredAt = new Date();
        if (status === ORDER_STATUS.CANCELLED) order.cancelledAt = new Date();

        order.updatedBy = req.auth.id;
        await order.save();

        // ✅ Create a context-aware notification
        const mealName = order.meal?.mealName || "your meal";
        let notificationTitle;
        let notificationBody = `Your order for ${mealName} is now ${status}.`;

        // Tailor the title and body based on the new status
        switch (status) {
            case ORDER_STATUS.PREPARING:
                notificationTitle = "👨‍🍳 Order Accepted!";
                notificationBody = `Chef has started preparing your order for ${mealName}.`;
                break;
            case ORDER_STATUS.READY:
                notificationTitle = "✅ Order Ready for Pickup!";
                break;
            case ORDER_STATUS.DELIVERING:
                notificationTitle = "🚗 Order On The Way!";
                break;
            case ORDER_STATUS.DELIVERED:
                notificationTitle = "🎉 Order Delivered!";
                notificationBody = `Your order for ${mealName} has been delivered. Enjoy!`;
                break;
            case ORDER_STATUS.CANCELLED:
                notificationTitle = "❌ Order Cancelled";
                notificationBody = `Your order for ${mealName} has been cancelled.`;
                break;
            default:
                notificationTitle = "📦 Order Updated";
        }

        // 🔔 Notify buyer of the order update
        console.log("DEBUG: [1] About to call sendUserNotification");
        console.log("DEBUG: [2] Buyer ID:", order.buyer._id.toString());
        console.log("DEBUG: [3] Notification Payload:", { title: notificationTitle, body: notificationBody, url: "/orders" });

        // 🔔 Notify buyer of the order update (push notification)
        await sendUserNotification(order.buyer._id, {
            title: notificationTitle,
            body: notificationBody,
            url: "/orders"
        });

        console.log("DEBUG: [4] Successfully called sendUserNotification");

        // 📝 Store notification in database
        try {
            const notification = new NotificationModel({
                user: order.buyer._id,
                title: notificationTitle,
                body: notificationBody,
                url: "/orders",
                type: 'order', // Using 'order' type as per your schema enum
                isRead: false
            });

            await notification.save();
            console.log("DEBUG: [5] Notification stored in database:", notification._id);
        } catch (dbError) {
            console.error("DEBUG: [6] Error storing notification in database:", dbError);
            // Don't throw error here to avoid breaking the main flow
            // You might want to log this to a monitoring service
        }

        res.json({
            message: `Order status updated to '${status}' successfully.`,
            order
        });
    } catch (err) {
        console.error("DEBUG: [7] Error in updateOrderStatus controller:", err);
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