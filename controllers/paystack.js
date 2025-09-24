import crypto from "crypto";
import { initiatePayment, verifyPayment } from "../utils/paystack.js";
import { MealOrder } from "../models/mealOrder.js";
import { UserModel } from "../models/users.js";
import { NotificationModel } from "../models/notifications.js";
import { mailtransporter } from "../utils/mail.js";
import { sendUserNotification } from "../utils/push.js";


// export const paystackWebhook = async (req, res, next) => {
//     try {
//         const rawBody = req.rawBody || JSON.stringify(req.body);
//         const signature = req.headers["x-paystack-signature"];

//         // ✅ Validate webhook signature
//         const secret = process.env.PAYSTACK_SECRET_KEY;
//         const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
//         if (hash !== signature) {
//             console.error("❌ Invalid webhook signature! Potential fraud.");
//             await NotificationModel.create({
//                 user: null,
//                 title: "⚠ Security Alert",
//                 body: "Potential fraudulent webhook signature detected in Paystack webhook.",
//                 url: "/admin/security",
//                 type: "security",
//                 priority: "high",
//             });
//             return res.sendStatus(400);
//         }

//         const event = typeof rawBody === "string" ? JSON.parse(rawBody) : req.body;

//         // 🔹 Handle charge success
//         if (event.event === "charge.success" && event.data.status === "success") {
//             const reference = event.data.reference;
//             const verified = await verifyPayment(reference);
//             const ps = verified?.data;

//             if (ps && ps.status === "success") {
//                 const order = await MealOrder.findOne({ "payment.reference": reference })
//                     .populate("buyer", "firstName lastName email")
//                     .populate("chef", "firstName lastName email paystack")
//                     .populate("meal", "mealName price");

//                 if (order && order.payment.status !== "paid") {
//                     // ✅ Double-check amount
//                     if (ps.amount !== order.totalPrice * 100) {
//                         console.error(`⚠ Payment amount mismatch for order ${order._id}`);
//                         await NotificationModel.create({
//                             user: null,
//                             title: "⚠ Payment Mismatch",
//                             body: `Reference ${reference} attempted with mismatched amount. Expected ${order.totalPrice}, got ${ps.amount / 100}`,
//                             url: `/admin/orders/${order._id}`,
//                             type: "payment",
//                             priority: "high",
//                         });
//                         return res.sendStatus(400);
//                     }

//                     // ✅ Double-check email
//                     if (ps.customer.email !== order.buyer.email) {
//                         console.error(`⚠ Email mismatch for order ${order._id}`);
//                         await NotificationModel.create({
//                             user: null,
//                             title: "⚠ Payment Email Mismatch",
//                             body: `Reference ${reference} email mismatch. Paystack: ${ps.customer.email}, Expected: ${order.buyer.email}`,
//                             url: `/admin/orders/${order._id}`,
//                             type: "payment",
//                             priority: "high",
//                         });
//                         return res.sendStatus(400);
//                     }

//                     // ✅ Update order
//                     order.payment.status = "paid";
//                     order.payment.reference = reference;
//                     order.payment.transactionId = ps.id;
//                     order.payment.channel = ps.channel;
//                     order.paidAt = new Date();

//                     const commission = order.totalPrice * 0.15;
//                     order.commission = commission;
//                     order.vendorEarnings = order.totalPrice - commission;

//                     await order.save();

//                     console.log(`✅ Order ${order._id} marked as paid via webhook.`);

//                     // 🔔 Push notifications
//                     try {
//                         await sendUserNotification(order.chef._id, {
//                             title: "💰 New Paid Order",
//                             body: `Order ${order._id} has been paid.`,
//                             url: `/dashboard/orders/${order._id}`,
//                         });
//                         await sendUserNotification(order.buyer._id, {
//                             title: "✅ Payment Confirmed",
//                             body: `Your payment for Order ${order._id} was successful.`,
//                             url: `/dashboard/my-orders/${order._id}`,
//                         });
//                     } catch (pushErr) {
//                         console.warn("Push notification failed:", pushErr?.message || pushErr);
//                     }

//                     // 📧 Emails
//                     try {
//                         await mailtransporter.sendMail({
//                             from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
//                             to: order.buyer.email,
//                             subject: "Payment Receipt",
//                             html: `<p>Hi ${order.buyer.firstName}, your payment for order ${order._id} was successful.</p>`,
//                         });
//                         await mailtransporter.sendMail({
//                             from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
//                             to: order.chef.email,
//                             subject: "New Order Payment Received",
//                             html: `<p>Hi ${order.chef.firstName}, you just received a new paid order #${order._id}.</p>`,
//                         });
//                     } catch (mailErr) {
//                         console.warn("Email sending failed:", mailErr?.message || mailErr);
//                     }

//                     // Admin record
//                     await NotificationModel.create({
//                         user: null,
//                         title: "💰 New Payment Received",
//                         body: `Order #${order._id} paid successfully. Amount: GHS ${order.totalPrice}, Commission: GHS ${commission}`,
//                         url: `/admin/orders/${order._id}`,
//                         type: "payment",
//                     });
//                 }
//             }
//         }

//         // 🔹 Handle transfer success
//         if (event.event === "transfer.success") {
//             await NotificationModel.create({
//                 user: null,
//                 title: "✅ Transfer Successful",
//                 body: `Transfer ${event.data.reference} to chef completed. Amount: GHS ${(event.data.amount / 100).toFixed(2)}`,
//                 url: "/admin/transfers",
//                 type: "transfer",
//             });
//         }

//         // 🔹 Handle transfer failure
//         if (event.event === "transfer.failed") {
//             await NotificationModel.create({
//                 user: null,
//                 title: "❌ Transfer Failed",
//                 body: `Transfer ${event.data.reference} failed. Reason: ${event.data.reason || "Unknown"}`,
//                 url: "/admin/transfers",
//                 type: "transfer",
//                 priority: "high",
//             });
//         }

//         res.sendStatus(200);
//     } catch (err) {
//         console.error("Webhook processing error:", err.message);
//         await NotificationModel.create({
//             user: null,
//             title: "⚠ Webhook Processing Error",
//             body: `Error processing Paystack webhook: ${err.message}`,
//             url: "/admin/system",
//             type: "system",
//             priority: "high",
//         });
//         res.sendStatus(500);
//     }
// };

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

        // 🔹 Handle charge success
        if (event.event === "charge.success" && event.data.status === "success") {
            const reference = event.data.reference;
            const verified = await verifyPayment(reference);
            const ps = verified?.data;

            if (ps && ps.status === "success") {
                const order = await MealOrder.findOne({ "payment.reference": reference })
                    .populate("buyer", "firstName lastName email")
                    .populate("chef", "firstName lastName email paystack")
                    .populate("meal", "mealName price");

                if (order && order.payment.status !== "paid") {
                    // ✅ Amount check (GHS → pesewa)
                    const expectedAmount = Math.round(order.totalPrice * 100);
                    if (ps.amount !== expectedAmount) {
                        console.error(`⚠ Payment amount mismatch for order ${order._id}`);
                        await NotificationModel.create({
                            user: null,
                            title: "⚠ Payment Mismatch",
                            body: `Reference ${reference} attempted with mismatched amount. Expected ${order.totalPrice} GHS, got ${ps.amount / 100} GHS`,
                            url: `/admin/orders/${order._id}`,
                            type: "payment",
                            priority: "high",
                        });
                        return res.sendStatus(400);
                    }

                    // ✅ Email check
                    if (ps.customer.email !== order.buyer.email) {
                        console.error(`⚠ Email mismatch for order ${order._id}`);
                        await NotificationModel.create({
                            user: null,
                            title: "⚠ Payment Email Mismatch",
                            body: `Reference ${reference} email mismatch. Paystack: ${ps.customer.email}, Expected: ${order.buyer.email}`,
                            url: `/admin/orders/${order._id}`,
                            type: "payment",
                            priority: "high",
                        });
                        return res.sendStatus(400);
                    }

                    // ✅ Update order
                    order.payment.status = "paid";
                    order.payment.reference = reference;
                    order.payment.transactionId = ps.id;
                    order.payment.channel = ps.channel;
                    order.paidAt = new Date();

                    const commission = order.totalPrice * 0.15;
                    order.commission = commission;
                    order.vendorEarnings = order.totalPrice - commission;

                    await order.save();

                    console.log(`✅ Order ${order._id} marked as paid via webhook.`);

                    // 🔔 Push notifications
                    try {
                        await sendUserNotification(order.chef._id, {
                            title: "💰 New Paid Order",
                            body: `Order ${order._id} has been paid.`,
                            url: `/dashboard/orders/${order._id}`,
                        });
                        await sendUserNotification(order.buyer._id, {
                            title: "✅ Payment Confirmed",
                            body: `Your payment for Order ${order._id} was successful.`,
                            url: `/dashboard/my-orders/${order._id}`,
                        });
                    } catch (pushErr) {
                        console.warn("Push notification failed:", pushErr?.message || pushErr);
                    }

                    // 📧 Emails
                    try {
                        await mailtransporter.sendMail({
                            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
                            to: order.buyer.email,
                            subject: "Payment Receipt",
                            html: `<p>Hi ${order.buyer.firstName}, your payment for order ${order._id} was successful.</p>`,
                        });
                        await mailtransporter.sendMail({
                            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
                            to: order.chef.email,
                            subject: "New Order Payment Received",
                            html: `<p>Hi ${order.chef.firstName}, you just received a new paid order #${order._id}.</p>`,
                        });
                    } catch (mailErr) {
                        console.warn("Email sending failed:", mailErr?.message || mailErr);
                    }

                    // Admin record
                    await NotificationModel.create({
                        user: null,
                        title: "💰 New Payment Received",
                        body: `Order #${order._id} paid successfully. Amount: GHS ${order.totalPrice}, Commission: GHS ${commission}`,
                        url: `/admin/orders/${order._id}`,
                        type: "payment",
                    });
                }
            }
        }

        // 🔹 Handle transfer success
        if (event.event === "transfer.success") {
            await NotificationModel.create({
                user: null,
                title: "✅ Transfer Successful",
                body: `Transfer ${event.data.reference} to chef completed. Amount: GHS ${(event.data.amount / 100).toFixed(2)}`,
                url: "/admin/transfers",
                type: "transfer",
            });
        }

        // 🔹 Handle transfer failure
        if (event.event === "transfer.failed") {
            await NotificationModel.create({
                user: null,
                title: "❌ Transfer Failed",
                body: `Transfer ${event.data.reference} failed. Reason: ${event.data.reason || "Unknown"}`,
                url: "/admin/transfers",
                type: "transfer",
                priority: "high",
            });
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
// CREATE PAYMENT
// =======================
export const createPaymentController = async (req, res, next) => {
    try {
        const { orderId, method, momo } = req.body;

        // ✅ Fetch user and order (existing code is fine)
        const user = await UserModel.findById(req.auth.id).select("email firstName lastName");
        if (!user) return res.status(404).json({ message: "User not found" });

        const mealOrder = await MealOrder.findById(orderId)
            .populate("buyer", "firstName lastName email")
            .populate("chef", "firstName lastName email paystack")
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

        // ✅ FIXED: Remove the amount conversion here
        const paymentResponse = await initiatePayment({
            amount: mealOrder.totalPrice, // Send GHS amount, NOT converted
            email: user.email,
            method,
            momo, // Pass the momo object directly
            currency: "GHS",
            metadata: {
                orderId: mealOrder._id.toString(),
                buyerId: user._id.toString(),
                mealName: mealOrder.meal.mealName,
            },
        });

        // ... rest of your code remains the same
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
            .populate("buyer", "firstName lastName email")
            .populate("chef", "firstName lastName email paystack")
            .populate("meal", "mealName price");

        if (!order) return res.status(404).json({ message: "Order not found for this reference" });

        console.log("🔹 Order fetched for verification:", order);

        // ✅ Verify payment with Paystack
        const verified = await verifyPayment(paymentReference);
        console.log("🔹 Paystack verification response:", verified);

        if (!verified?.status || verified.data.status !== "success") {
            return res.status(400).json({ message: "Payment verification failed", data: verified });
        }

        // ✅ Convert Paystack amount to GHS
        const expectedAmount = Math.round(order.totalPrice * 100); // in pesewas
        const receivedAmount = verified.data.amount; // Paystack amount is already in pesewas

        if (receivedAmount !== expectedAmount) {
            return res.status(400).json({
                message: `Payment amount mismatch. Expected: GHS ${expectedAmount / 100} Received: GHS ${receivedAmount / 100}`,
            });
        }

        // ✅ Update order payment status
        order.payment.status = "paid";
        order.payment.transactionId = verified.data.id;
        order.paidAt = new Date(verified.data.paidAt || Date.now());
        await order.save();

        console.log("✅ Order updated after successful payment:", order);

        res.status(200).json({
            message: "Payment verified successfully",
            order,
            payment: order.payment,
        });

    } catch (err) {
        console.error("❌ Error in verifyPaymentController:", err);
        next(err);
    }
};



