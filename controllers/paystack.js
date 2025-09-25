import crypto from "crypto";
import { initiatePayment, verifyPayment } from "../utils/paystack.js";
import { MealOrder } from "../models/mealOrder.js";
import { UserModel } from "../models/users.js";
import { NotificationModel } from "../models/notifications.js";
import { mailtransporter } from "../utils/mail.js";
import { sendUserNotification } from "../utils/push.js";

export const paystackWebhook = async (req, res, next) => {
    try {
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const signature = req.headers["x-paystack-signature"];

        // ✅ Validate webhook signature
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
        if (hash !== signature) {
            console.error("❌ Invalid webhook signature! Potential fraud.");
            await NotificationModel.create({
                user: null,
                title: "⚠ Security Alert",
                body: "Potential fraudulent webhook signature detected in Paystack webhook.",
                url: "/admin/security",
                type: "security",
                priority: "high",
            });
            return res.sendStatus(400);
        }

        const event = typeof rawBody === "string" ? JSON.parse(rawBody) : req.body;
        const reference = event.data?.reference;

        console.log(`🔔 Webhook received: ${event.event} for reference: ${reference}`);

        // 🔹 Handle successful payment
        if (event.event === "charge.success" && event.data.status === "success") {
            const ps = event.data;
            const order = await MealOrder.findOne({ "payment.reference": reference })
                .populate("buyer", "firstName lastName email")
                .populate("chef", "firstName lastName email paystack")
                .populate("meal", "mealName price");

            if (order && order.payment.status !== "paid") {
                // ✅ Security checks
                const expectedAmount = Math.round(order.totalPrice * 100);
                if (ps.amount !== expectedAmount) {
                    console.error(`⚠ Payment amount mismatch for order ${order._id}`);
                    await handlePaymentMismatch(order, ps, reference);
                    return res.sendStatus(400);
                }

                if (ps.customer.email !== order.buyer.email) {
                    console.error(`⚠ Email mismatch for order ${order._id}`);
                    await handleEmailMismatch(order, ps, reference);
                    return res.sendStatus(400);
                }

                // ✅ Update order to PAID
                await updateOrderToPaid(order, ps);
                console.log(`✅ Order ${order._id} marked as PAID via webhook.`);

                // ✅ Notify chef and buyer
                await sendPaymentSuccessNotifications(order);
            }
        }

        // 🔹 Handle FAILED payment
        else if (event.event === "charge.failed" || (event.event === "charge.success" && event.data.status !== "success")) {
            const ps = event.data;
            const order = await MealOrder.findOne({ "payment.reference": reference })
                .populate("buyer", "firstName lastName email")
                .populate("chef", "email") // Only need chef email for notification
                .populate("meal", "mealName price");

            if (order && order.payment.status === "pending") {
                // ✅ Update order to FAILED
                await updateOrderToFailed(order, ps);
                console.log(`❌ Order ${order._id} marked as FAILED via webhook.`);

                // ✅ Notify buyer about failed payment
                await sendPaymentFailedNotifications(order, ps);
            }
        }

        // 🔹 Handle transfer success
        else if (event.event === "transfer.success") {
            await NotificationModel.create({
                user: null,
                title: "✅ Transfer Successful",
                body: `Transfer ${event.data.reference} to chef completed. Amount: GHS ${(event.data.amount / 100).toFixed(2)}`,
                url: "/admin/transfers",
                type: "transfer",
            });
        }

        // 🔹 Handle transfer failure
        else if (event.event === "transfer.failed") {
            await NotificationModel.create({
                user: null,
                title: "❌ Transfer Failed",
                body: `Transfer ${event.data.reference} failed. Reason: ${event.data.reason || "Unknown"}`,
                url: "/admin/transfers",
                type: "transfer",
                priority: "high",
            });
        }

        // 🔹 Handle unknown events
        else {
            console.log(`ℹ️ Unhandled webhook event: ${event.event}`);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook processing error:", err.message);
        await NotificationModel.create({
            user: null,
            title: "⚠ Webhook Processing Error",
            body: `Error processing Paystack webhook: ${err.message}`,
            url: "/admin/system",
            type: "system",
            priority: "high",
        });
        res.sendStatus(500);
    }
};

// =======================
// HELPER FUNCTIONS
// =======================

const updateOrderToPaid = async (order, ps) => {
    order.payment.status = "paid";
    order.payment.reference = ps.reference;
    order.payment.transactionId = ps.id;
    order.payment.channel = ps.channel;
    order.payment.failureReason = null; // Clear any previous failure
    order.paidAt = new Date(ps.paid_at || Date.now());

    const commission = order.totalPrice * 0.15;
    order.commission = commission;
    order.vendorEarnings = order.totalPrice - commission;

    await order.save();
};

const updateOrderToFailed = async (order, ps) => {
    order.payment.status = "failed";
    order.payment.failureReason = ps.gateway_response || "Payment failed";
    order.payment.failedAt = new Date();
    await order.save();
};

const sendPaymentSuccessNotifications = async (order) => {
    try {
        const shortId = order._id.toString().slice(-6);
        const pickupTime = new Date(order.pickupTime).toLocaleString("en-GH", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        // 🔔 Push notifications
        await sendUserNotification(order.chef._id, {
            title: "💰 New Paid Order",
            body: `New order for ${order.meal.mealName} has been paid. Amount: GHS ${order.totalPrice}`,
            url: `/dashboard/orders/${order._id}`,
        });

        await sendUserNotification(order.buyer._id, {
            title: "✅ Payment Confirmed",
            body: `Your payment for ${order.meal.mealName} was successful. Order #${shortId}`,
            url: `/dashboard/my-orders/${order._id}`,
        });

        // 📧 Email to Buyer
        await mailtransporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: order.buyer.email,
            subject: `✅ Payment Receipt - Order #${shortId}`,
            html: `
                <p>Hi ${order.buyer.firstName},</p>
                <p>Thank you for your order! Your payment for <strong>${order.quantity}x ${order.meal.mealName}</strong> has been confirmed.</p>
                <p><strong>Order Summary:</strong></p>
                <ul>
                    <li><strong>Order ID:</strong> ${shortId}</li>
                    <li><strong>Chef:</strong> ${order.chef.firstName} ${order.chef.lastName}</li>
                    <li><strong>Total Paid:</strong> GHS ${order.totalPrice.toFixed(2)}</li>
                    <li><strong>Pickup Time:</strong> ${pickupTime}</li>
                </ul>
                <p>You can track your order status in your dashboard.</p>
                <p>— PotChef Team</p>
            `,
        });

        // 📧 Email to Chef
        await mailtransporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: order.chef.email,
            subject: `💰 New Paid Order - #${shortId}`,
            html: `
                <p>Hi ${order.chef.firstName},</p>
                <pYou’ve received a new paid order for <strong>${order.meal.mealName}</strong>.</p>
                <p><strong>Order Details:</strong></p>
                <ul>
                    <li><strong>Order ID:</strong> ${shortId}</li>
                    <li><strong>Customer:</strong> ${order.buyer.firstName} ${order.buyer.lastName}</li>
                    <li><strong>Quantity:</strong> ${order.quantity}</li>
                    <li><strong>Total Paid:</strong> GHS ${order.totalPrice.toFixed(2)}</li>
                    <li><strong>Your Earnings:</strong> GHS ${order.vendorEarnings.toFixed(2)}</li>
                    <li><strong>Pickup Time:</strong> ${pickupTime}</li>
                </ul>
                <p>Please prepare the meal and have it ready by the pickup time.</p>
                <p>— PotChef Team</p>
            `,
        });

        // 🗂️ Admin record
        await NotificationModel.create({
            user: null,
            title: "💰 New Payment Received",
            body: `Order #${shortId} paid successfully. Amount: GHS ${order.totalPrice}`,
            url: `/admin/orders/${order._id}`,
            type: "payment",
        });

    } catch (error) {
        console.warn("Notification sending failed:", error?.message || error);
    }
};


const sendPaymentFailedNotifications = async (order, ps) => {
    try {
        // 🔔 Push notification to buyer
        await sendUserNotification(order.buyer._id, {
            title: "❌ Payment Failed",
            body: `Payment for order ${order._id.toString().slice(-6)} failed. Please try again.`,
            url: `/dashboard/my-orders/${order._id}`,
        });

        // 📧 Email to buyer
        await mailtransporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: order.buyer.email,
            subject: "Payment Failed - Order On Hold",
            html: `
                <p>Hi ${order.buyer.firstName},</p>
                <p>Your payment for <strong>${order.meal.mealName}</strong> failed.</p>
                <p><strong>Reason:</strong> ${ps.gateway_response || "Payment declined"}</p>
                <p>Please try again to complete your order.</p>
            `,
        });

        // Admin record
        await NotificationModel.create({
            user: null,
            title: "❌ Payment Failed",
            body: `Payment failed for Order #${order._id.toString().slice(-6)}. Reason: ${ps.gateway_response}`,
            url: `/admin/orders/${order._id}`,
            type: "payment",
            priority: "high",
        });

    } catch (error) {
        console.warn("Failed payment notification error:", error?.message || error);
    }
};

const handlePaymentMismatch = async (order, ps, reference) => {
    await NotificationModel.create({
        user: null,
        title: "⚠ Payment Mismatch",
        body: `Reference ${reference} attempted with mismatched amount. Expected ${order.totalPrice} GHS, got ${ps.amount / 100} GHS`,
        url: `/admin/orders/${order._id}`,
        type: "payment",
        priority: "high",
    });
};

const handleEmailMismatch = async (order, ps, reference) => {
    await NotificationModel.create({
        user: null,
        title: "⚠ Payment Email Mismatch",
        body: `Reference ${reference} email mismatch. Paystack: ${ps.customer.email}, Expected: ${order.buyer.email}`,
        url: `/admin/orders/${order._id}`,
        type: "payment",
        priority: "high",
    });
};

// =======================
// CREATE PAYMENT
// =======================
export const createPaymentController = async (req, res, next) => {
    try {
        const { orderId, method, momo } = req.body;

        // ✅ Fetch user and order
        const user = await UserModel.findById(req.auth.id).select("email firstName lastName");
        if (!user) return res.status(404).json({ message: "User not found" });

        const mealOrder = await MealOrder.findById(orderId)
            .populate("buyer", "email")
            .populate("chef", "email paystack")
            .populate("meal", "mealName price");

        if (!mealOrder) return res.status(404).json({ message: "Order not found" });

        console.log("💡 Meal Order fetched. Total Price:", mealOrder.totalPrice);

        // ✅ Validate momo data if method is momo
        if (method === "momo") {
            if (!momo?.phone || !momo?.provider) {
                return res.status(400).json({
                    message: "Mobile money payment requires phone number and provider"
                });
            }
        }

        // ✅ SIMPLIFIED: Remove the timeout wrapper
        const paymentResponse = await initiatePayment({
            amount: mealOrder.totalPrice,
            email: user.email,
            method,
            momo,
            currency: "GHS",
            subaccount: mealOrder.chef?.paystack?.subaccountCode,
            metadata: {
                orderId: mealOrder._id.toString(),
                buyerId: user._id.toString(),
                mealName: mealOrder.meal.mealName,
            },
        });

        // ✅ Handle the payment response
        console.log("💡 Paystack initiate response:", paymentResponse);

        if (!paymentResponse?.data?.reference) {
            return res.status(500).json({ message: "Payment initiation failed - no reference received" });
        }

        const reference = paymentResponse.data.reference;
        const authorizationUrl = paymentResponse.data.authorization_url;

        // ✅ Save payment reference in order
        mealOrder.payment = mealOrder.payment || {};
        mealOrder.payment.method = method;
        mealOrder.payment.status = "pending";
        mealOrder.payment.reference = reference;
        await mealOrder.save();

        console.log("✅ Payment reference saved in order:", mealOrder.payment);

        // ✅ Send response back to client
        res.status(200).json({
            message: "Payment initiated successfully",
            order: mealOrder,
            paymentReference: reference,
            authorizationUrl: authorizationUrl,
        });

    } catch (err) {
        console.error("❌ Error in createPaymentController:", err);
        next(err);
    }
};




// =======================
// VERIFY PAYMENT
// =======================

export const verifyPaymentController = async (req, res, next) => {
    try {
        const { paymentReference } = req.params;
        if (!paymentReference) return res.status(400).json({ message: "paymentReference is required" });

        console.log("🔹 Verifying payment for reference:", paymentReference);

        const order = await MealOrder.findOne({ "payment.reference": paymentReference })
            .populate("buyer", "email firstName lastName")
            .populate("chef", "email paystack firstName lastName")
            .populate("meal", "mealName price");

        if (!order) return res.status(404).json({ message: "Order not found for this reference" });

        console.log("🔹 Order fetched for verification:", order);

        // ✅ Verify payment with Paystack
        const verified = await verifyPayment(paymentReference);
        console.log("🔹 Paystack verification response:", verified);

        // ✅ Handle PAYMENT SUCCESS
        if (verified?.status && verified.data.status === "success") {
            // ✅ Amount validation
            const expectedAmount = Math.round(order.totalPrice * 100);
            const receivedAmount = verified.data.amount;

            if (receivedAmount !== expectedAmount) {
                return res.status(400).json({
                    message: `Payment amount mismatch. Expected: GHS ${expectedAmount / 100} Received: GHS ${receivedAmount / 100}`,
                });
            }

            // ✅ Update order to PAID
            order.payment.status = "paid";
            order.payment.transactionId = verified.data.id;
            order.payment.channel = verified.data.channel;
            order.payment.failureReason = null; // Clear any previous failure
            order.paidAt = new Date(verified.data.paid_at || Date.now());
            await order.save();

            console.log("✅ Order updated after successful payment:", order);

            // ✅ Send notifications (optional - same as webhook)
            await sendPaymentSuccessNotifications(order);

            return res.status(200).json({
                message: "Payment verified successfully",
                order,
                payment: order.payment,
            });
        }

        // ✅ Handle PAYMENT FAILED
        else if (verified?.data?.status === "failed" || verified?.data?.status === "abandoned") {
            // ✅ Update order to FAILED
            order.payment.status = "failed";
            order.payment.failureReason = verified.data.gateway_response || "Payment failed";
            order.payment.failedAt = new Date();
            await order.save();

            console.log("❌ Order marked as failed:", order);

            // ✅ Send failure notifications (optional)
            await sendPaymentFailedNotifications(order, verified.data);

            return res.status(400).json({
                message: "Payment verification failed",
                failureReason: verified.data.gateway_response,
                data: verified.data,
            });
        }

        // ✅ Handle STILL PENDING payments
        else {
            return res.status(200).json({
                message: "Payment still processing",
                status: verified.data.status,
                order: {
                    ...order.toObject(),
                    payment: {
                        ...order.payment,
                        status: "pending" // Keep as pending
                    }
                }
            });
        }

    } catch (err) {
        console.error("❌ Error in verifyPaymentController:", err);
        next(err);
    }
};



