import crypto from "crypto";
import { initiatePayment, verifyPayment, submitOtp } from "../utils/paystack.js";
import { MealOrder } from "../models/mealOrder.js";
import { UserModel } from "../models/users.js";
import { NotificationModel } from "../models/notifications.js";
import { sendEmail } from "../utils/mail.js";
import { sendUserNotification } from "../utils/push.js";
import { WebhookLogModel } from "../models/webhookLog.js";



// export const paystackWebhook = async (req, res, next) => {
//     try {
//         const rawBody = req.rawBody || JSON.stringify(req.body);
//         const signature = req.headers["x-paystack-signature"];

//         // ✅ 1. Validate webhook signature
//         const secret = process.env.PAYSTACK_SECRET_KEY;
//         const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
//         if (hash !== signature) {
//             console.error("❌ Invalid webhook signature! Potential fraud.");

//             await WebhookLogModel.create({
//                 event: "invalid_signature",
//                 reference: null,
//                 payload: req.body,
//                 verified: false,
//                 notes: "Signature mismatch detected"
//             });

//             await NotificationModel.create({
//                 scope: 'admin',
//                 title: "⚠ Security Alert",
//                 body: "Potential fraudulent webhook signature detected in Paystack webhook.",
//                 url: "/admin/security",
//                 type: "security",
//                 priority: "high",
//             });
//             return res.sendStatus(400);
//         }

//         // ✅ 2. Parse event BEFORE responding
//         const event = typeof rawBody === "string" ? JSON.parse(rawBody) : req.body;

//         // ✅ 3. Acknowledge receipt immediately
//         res.sendStatus(200);

//         // ✅ 4. Log verified webhook event
//         await WebhookLogModel.create({
//             event: event.event,
//             reference: event.data?.reference,
//             payload: event,
//             verified: true,
//             notes: `Webhook received and verified for ${event.event}`
//         });


//         // ✅ 5. Process event asynchronously
//         const reference = event.data?.reference;
//         console.log(`🔔 Webhook received: ${event.event} for reference: ${reference}`);

//         if (!reference) return;

//         const ps = event.data;

//         // 🔹 Handle successful charge
//         if (event.event === "charge.success" && ps.status === "success") {
//             const order = await MealOrder.findOne({ "payment.reference": reference })
//                 .populate("buyer", "firstName lastName email")
//                 .populate("chef", "firstName lastName email paystack")
//                 .populate("meal", "mealName price");

//             if (order && order.payment.status !== "paid") {
//                 // ✅ Security checks
//                 const expectedAmount = Math.round(order.totalPrice * 100);
//                 if (ps.amount !== expectedAmount) {
//                     console.error(`⚠ Payment amount mismatch for order ${order._id}`);
//                     await handlePaymentMismatch(order, ps, reference);
//                     return;
//                 }

//                 if (ps.customer.email !== order.buyer.email) {
//                     console.error(`⚠ Email mismatch for order ${order._id}`);
//                     await handleEmailMismatch(order, ps, reference);
//                     return;
//                 }

//                 // 🕒 Vodafone voucher expiry check
//                 if (
//                     order.payment.authorizationType === "voucher" &&
//                     order.payment.expiresAt &&
//                     new Date() > order.payment.expiresAt
//                 ) {
//                     console.warn(`⚠ Voucher expired before webhook arrived for ${reference}`);
//                     order.payment.status = "expired";
//                     order.payment.failureReason = "Voucher not submitted in time";
//                     await order.save();
//                     return;
//                 }

//                 // ✅ Update order to PAID using your utility function
//                 await updateOrderToPaid(order, ps);

//                 // Only send notifications if the order was actually updated to paid
//                 if (order.payment.status === "paid") {
//                     // ✅  Check notification flag
//                     if (order.notifiedPaid) {
//                         console.log("🔁 Notification already sent for this order. Skipping.");
//                         return;
//                     }

//                     // ✅ IMPROVEMENT #2: Wrap in try-catch
//                     try {
//                         await sendPaymentSuccessNotifications(order);
//                         order.notifiedPaid = true;
//                         await order.save();
//                         console.log("✅ Notifications sent successfully");
//                     } catch (err) {
//                         console.error("❌ Notification error:", err.message);
//                         // Don't throw - allow webhook to complete successfully
//                     }
//                 }
//             }
//         }

//         // 🔹 Handle failed charge
//         else if (
//             event.event === "charge.failed" ||
//             (event.event === "charge.success" && ps.status !== "success")
//         ) {
//             const order = await MealOrder.findOne({ "payment.reference": reference })
//                 .populate("buyer", "firstName lastName email")
//                 .populate("chef", "email")
//                 .populate("meal", "mealName price");

//             if (order) {
//                 // ✅ USE YOUR UTILITY FUNCTION
//                 await updateOrderToFailed(order, ps);

//                 // Only send failure notifications if the order was actually updated
//                 if (order.payment.status === "failed") {
//                     await sendPaymentFailedNotifications(order, ps);
//                 }
//             }
//         }

//         // 🔹 Handle transfer success
//         else if (event.event === "transfer.success") {
//             await NotificationModel.create({
//                 scope: 'admin',
//                 title: "✅ Transfer Successful",
//                 body: `Transfer ${ps.reference} to chef completed. Amount: GHS ${(ps.amount / 100).toFixed(2)}`,
//                 url: "/admin/transfers",
//                 type: "transfer",
//             });
//         }

//         // 🔹 Handle transfer failure
//         else if (event.event === "transfer.failed") {
//             await NotificationModel.create({
//                 scope: 'admin',
//                 title: "❌ Transfer Failed",
//                 body: `Transfer ${ps.reference} failed. Reason: ${ps.reason || "Unknown"}`,
//                 url: "/admin/transfers",
//                 type: "transfer",
//                 priority: "high",
//             });
//         }

//         // 🔹 Handle unknown events
//         else {
//             console.log(`ℹ️ Unhandled webhook event: ${event.event}`);
//         }

//     } catch (err) {
//         console.error("Webhook processing error:", err.message);
//         await NotificationModel.create({
//             scope: 'system',
//             title: "⚠ Webhook Processing Error",
//             body: `Error processing Paystack webhook: ${err.message}`,
//             url: "/admin/system",
//             type: "system",
//             priority: "high",
//         });
//     }
// };


export const paystackWebhook = async (req, res, next) => {
    try {
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const signature = req.headers["x-paystack-signature"];

        // ✅ 1. Validate webhook signature
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
        if (hash !== signature) {
            console.error("❌ Invalid webhook signature! Potential fraud.");

            await WebhookLogModel.create({
                event: "invalid_signature",
                reference: null,
                payload: req.body,
                verified: false,
                notes: "Signature mismatch detected"
            });

            await NotificationModel.create({
                scope: 'admin',
                title: "⚠ Security Alert",
                body: "Potential fraudulent webhook signature detected in Paystack webhook.",
                url: "/admin/security",
                type: "security",
                priority: "high",
            });
            return res.sendStatus(400);
        }

        // ✅ 2. Parse event BEFORE responding
        const event = typeof rawBody === "string" ? JSON.parse(rawBody) : req.body;

        // ✅ 3. ⚡⚡⚡ ACKNOWLEDGE RECEIPT IMMEDIATELY - BEFORE ANY ASYNC OPERATIONS! ⚡⚡⚡
        res.sendStatus(200);

        // ✅ 4. Process event asynchronously (AFTER sending 200)
        processWebhookAsync(event);

    } catch (err) {
        console.error("Webhook processing error:", err.message);
        // Only send error if we haven't sent 200 yet
        if (!res.headersSent) {
            await NotificationModel.create({
                scope: 'system',
                title: "⚠ Webhook Processing Error",
                body: `Error processing Paystack webhook: ${err.message}`,
                url: "/admin/system",
                type: "system",
                priority: "high",
            });
            res.sendStatus(500);
        }
    }
};

// ✅ SEPARATE ASYNC FUNCTION FOR PROCESSING
async function processWebhookAsync(event) {
    try {
        // ✅ Log verified webhook event
        await WebhookLogModel.create({
            event: event.event,
            reference: event.data?.reference,
            payload: event,
            verified: true,
            notes: `Webhook received and verified for ${event.event}`
        });

        const reference = event.data?.reference;
        console.log(`🔔 Webhook received: ${event.event} for reference: ${reference}`);

        if (!reference) return;

        const ps = event.data;

        // 🔹 Handle successful charge
        if (event.event === "charge.success" && ps.status === "success") {
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
                    return;
                }

                if (ps.customer.email !== order.buyer.email) {
                    console.error(`⚠ Email mismatch for order ${order._id}`);
                    await handleEmailMismatch(order, ps, reference);
                    return;
                }

                // 🕒 Vodafone voucher expiry check
                if (
                    order.payment.authorizationType === "voucher" &&
                    order.payment.expiresAt &&
                    new Date() > order.payment.expiresAt
                ) {
                    console.warn(`⚠ Voucher expired before webhook arrived for ${reference}`);
                    order.payment.status = "expired";
                    order.payment.failureReason = "Voucher not submitted in time";
                    await order.save();
                    return;
                }

                // ✅ Update order to PAID using your utility function
                await updateOrderToPaid(order, ps);

                // Only send notifications if the order was actually updated to paid
                if (order.payment.status === "paid") {
                    // ✅ Check notification flag
                    if (order.notifiedPaid) {
                        console.log("🔁 Notification already sent for this order. Skipping.");
                        return;
                    }

                    try {
                        await sendPaymentSuccessNotifications(order);
                        order.notifiedPaid = true;
                        await order.save();
                        console.log("✅ Notifications sent successfully");
                    } catch (err) {
                        console.error("❌ Notification error:", err.message);
                    }
                }
            }
        }

        // 🔹 Handle failed charge
        else if (
            event.event === "charge.failed" ||
            (event.event === "charge.success" && ps.status !== "success")
        ) {
            const order = await MealOrder.findOne({ "payment.reference": reference })
                .populate("buyer", "firstName lastName email")
                .populate("chef", "email")
                .populate("meal", "mealName price");

            if (order) {
                // ✅ USE YOUR UTILITY FUNCTION
                await updateOrderToFailed(order, ps);

                // Only send failure notifications if the order was actually updated
                if (order.payment.status === "failed") {
                    await sendPaymentFailedNotifications(order, ps);
                }
            }
        }

        // 🔹 Handle transfer success
        else if (event.event === "transfer.success") {
            await NotificationModel.create({
                scope: 'admin',
                title: "✅ Transfer Successful",
                body: `Transfer ${ps.reference} to chef completed. Amount: GHS ${(ps.amount / 100).toFixed(2)}`,
                url: "/admin/transfers",
                type: "transfer",
            });
        }

        // 🔹 Handle transfer failure
        else if (event.event === "transfer.failed") {
            await NotificationModel.create({
                scope: 'admin',
                title: "❌ Transfer Failed",
                body: `Transfer ${ps.reference} failed. Reason: ${ps.reason || "Unknown"}`,
                url: "/admin/transfers",
                type: "transfer",
                priority: "high",
            });
        }

        // 🔹 Handle unknown events
        else {
            console.log(`ℹ️ Unhandled webhook event: ${event.event}`);
        }

    } catch (error) {
        console.error("Async webhook processing error:", error.message);
        // Log async errors separately since response is already sent
        await NotificationModel.create({
            scope: 'system',
            title: "⚠ Async Webhook Processing Error",
            body: `Async error processing Paystack webhook: ${error.message}`,
            url: "/admin/system",
            type: "system",
            priority: "medium",
        });
    }
}

// =======================
// HELPER FUNCTIONS
// =======================

const updateOrderToPaid = async (order, ps) => {
    if (order.payment.status === "paid") {
        console.log(`Order ${order._id} is already paid. Skipping update.`);
        return;
    }

    order.payment.status = "paid";
    order.payment.reference = ps.reference;
    order.payment.transactionId = ps.id;
    order.payment.channel = ps.channel;
    order.payment.gatewayResponse = ps.gateway_response;
    order.payment.authorization = ps.authorization || null;
    order.payment.failureReason = null;
    order.payment.paidAt = new Date(ps.paid_at || Date.now());

    const commission = order.totalPrice * 0.15;
    order.commission = commission;
    order.vendorEarnings = order.totalPrice - commission;

    await order.save();

    console.log(`✅ Order ${order._id} marked as PAID`);
    console.log(`🔍 Channel: ${order.payment.channel}`);
    console.log(`🔍 Authorization Type: ${order.payment.authorizationType}`);
};

const updateOrderToFailed = async (order, ps) => {
    if (order.payment.status !== "pending") {
        console.log(`Order ${order._id} status is already ${order.payment.status}. Skipping failure update.`);
        return;
    }

    order.payment.status = "failed";
    order.payment.reference = ps.reference || order.payment.reference;
    order.payment.failureReason = ps.gateway_response || "Payment failed";
    order.payment.failedAt = new Date();

    await order.save();
    console.log(`❌ Order ${order._id} marked as FAILED`);
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

        console.log(`📧 Sending notifications for order ${shortId}`);
        console.log(`   Chef: ${order.chef.email}`);
        console.log(`   Buyer: ${order.buyer.email}`);

        // ✅ Validate email addresses before sending
        const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        // 🔔 Push notifications (with error handling)
        try {
            await sendUserNotification(order.chef._id, {
                title: "💰 New Paid Order",
                body: `New order for ${order.meal.mealName} has been paid. You received: GHS ${order.vendorEarnings}`,
                url: `/dashboard/orders/${order._id}`,
            });
            console.log(`✅ Push notification sent to chef`);
        } catch (pushError) {
            console.warn(`⚠️ Push notification to chef failed:`, pushError.message);
        }

        try {
            await sendUserNotification(order.buyer._id, {
                title: "✅ Payment Confirmed",
                body: `Your payment for ${order.meal.mealName} was successful. Order #${shortId}`,
                url: `/dashboard/my-orders/${order._id}`,
            });
            console.log(`✅ Push notification sent to buyer`);
        } catch (pushError) {
            console.warn(`⚠️ Push notification to buyer failed:`, pushError.message);
        }

        // ✅ DATABASE NOTIFICATIONS FOR IN-APP DISPLAY
        // Chef notification
        await NotificationModel.create({
            user: order.chef._id,
            title: "💰 New Paid Order",
            body: `New order for ${order.meal.mealName} has been paid. Amount: GHS ${order.vendorEarnings}`,
            url: `/dashboard/orders/${order._id}`,
            type: "order",
        });

        // Buyer notification  
        await NotificationModel.create({
            user: order.buyer._id,
            title: "✅ Payment Confirmed",
            body: `Your payment for ${order.meal.mealName} was successful. Order #${shortId}`,
            url: `/dashboard/my-orders/${order._id}`,
            type: "order",
        });

        // 📧 Email to Buyer
        if (isValidEmail(order.buyer.email)) {
            try {
                await sendEmail({
                    from: {
                        name: process.env.SMTP_FROM_NAME,
                        email: process.env.SMTP_FROM_EMAIL
                    },
                    to: order.buyer.email,
                    subject: `✅ Payment Receipt - Order #${shortId}`,
                    html: `
        <p>Hi ${order.buyer.firstName},</p>
        <p>Your payment for <strong>${order.quantity}x ${order.meal.mealName}</strong> has been successfully processed.</p>
        <p><strong>Order Summary:</strong></p>
        <ul>
            <li><strong>Order ID:</strong> ${shortId}</li>
            <li><strong>Chef:</strong> ${order.chef.firstName} ${order.chef.lastName}</li>
            <li><strong>Total Paid:</strong> GHS ${order.totalPrice.toFixed(2)}</li>
            <li><strong>Pickup Time:</strong> ${pickupTime}</li>
        </ul>
        <p>You can track your order status in your dashboard.</p>
        <p>Thank you for choosing PotChef!</p>
        <p>— PotChef Team</p>
    `
                });

                console.log(`✅ Buyer email sent successfully`);
            } catch (emailError) {
                console.error(`❌ Buyer email failed:`, emailError.message);
            }
        } else {
            console.warn(`⚠️ Invalid buyer email: ${order.buyer.email}`);
        }

        // 📧 Email to Chef - CRITICAL: This is what sends to the chef
        if (isValidEmail(order.chef.email)) {
            try {
                await sendEmail({
                    from: {
                        name: process.env.SMTP_FROM_NAME,
                        email: process.env.SMTP_FROM_EMAIL
                    },
                    to: order.chef.email,
                    subject: `💰 New Paid Order - #${shortId}`,
                    html: `
        <p>Hi ${order.chef.firstName},</p>
        <p>You've received a new paid order for <strong>${order.meal.mealName}</strong>.</p>
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
    `
                });

                console.log(`✅ Chef email sent successfully`);
            } catch (emailError) {
                console.error(`❌ Chef email failed:`, emailError.message);
                // ✅ Notify admin of email failure
                await NotificationModel.create({
                    scope: 'system',
                    title: "⚠ Chef Email Failed",
                    body: `Failed to send notification email to chef ${order.chef.email} for order ${shortId}`,
                    url: `/admin/orders/${order._id}`,
                    type: "system",
                });
            }
        } else {
            console.warn(`⚠️ Invalid chef email: ${order.chef.email}`);
            // ✅ Invalid email notification
            await NotificationModel.create({
                scope: 'system',
                title: "⚠ Invalid Chef Email",
                body: `Chef ${order.chef.firstName} has invalid email: ${order.chef.email}`,
                url: `/admin/users/${order.chef._id}`,
                type: "system",
            });
        }

        // ✅ Admin record
        await NotificationModel.create({
            scope: 'admin',
            title: "💰 New Payment Received",
            body: `Order #${shortId} paid successfully. Amount: GHS ${order.totalPrice}`,
            url: `/admin/orders/${order._id}`,
            type: "payment",
        });

        console.log(`✅ All notifications processed for order ${shortId}`);

    } catch (error) {
        console.error("❌ Notification sending failed completely:", error?.message || error);
        // ✅ Critical failure
        await NotificationModel.create({
            scope: 'system',
            title: "🚨 Notification System Failure",
            body: `Complete failure in sending notifications for order ${order._id}: ${error.message}`,
            url: "/admin/system",
            type: "system",
        });
    }
};

const sendPaymentFailedNotifications = async (order, ps) => {
    try {
        const shortId = order._id.toString().slice(-6);

        // 🔔 Push notification to buyer
        await sendUserNotification(order.buyer._id, {
            title: "❌ Payment Failed",
            body: `Payment for order ${shortId} failed. Please try again.`,
            url: `/dashboard/my-orders/${order._id}`,
        });

        // ✅ DATABASE NOTIFICATION FOR BUYER
        await NotificationModel.create({
            user: order.buyer._id, // ✅ TARGET BUYER SPECIFICALLY
            title: "❌ Payment Failed",
            body: `Payment for order ${shortId} failed. Please try again.`,
            url: `/dashboard/my-orders/${order._id}`,
            type: "order",
        });

        // 📧 Email to buyer
        await sendEmail({
            from: {
                name: process.env.SMTP_FROM_NAME,
                email: process.env.SMTP_FROM_EMAIL
            },
            to: order.buyer.email,
            subject: "Payment Failed - Order On Hold",
            html: `
                <p>Hi ${order.buyer.firstName},</p>
                <p>Your payment for <strong>${order.meal.mealName}</strong> failed.</p>
                <p><strong>Reason:</strong> ${ps.gateway_response || "Payment declined"}</p>
                <p>Please try again to complete your order.</p>
            `,
        });

        // ✅ Admin record
        await NotificationModel.create({
            scope: 'admin',
            title: "❌ Payment Failed",
            body: `Payment failed for Order #${shortId}. Reason: ${ps.gateway_response || "Unknown"}`,
            url: `/admin/orders/${order._id}`,
            type: "payment",
        });

    } catch (error) {
        console.warn("Failed payment notification error:", error?.message || error);

        // ✅ System notification for failure
        await NotificationModel.create({
            scope: 'system',
            title: "⚠ Payment Failure Notification Error",
            body: `Error sending failed payment notifications for order ${shortId}: ${error.message}`,
            url: `/admin/orders/${order._id}`,
            type: "system",
        });
    }
};

const handlePaymentMismatch = async (order, ps, reference) => {
    await NotificationModel.create({
        scope: 'admin', // ✅ FIXED: Use scope instead of user: null
        title: "⚠ Payment Mismatch",
        body: `Reference ${reference} attempted with mismatched amount. Expected ${order.totalPrice} GHS, got ${ps.amount / 100} GHS`,
        url: `/admin/orders/${order._id}`,
        type: "payment",
        priority: "high",
    });
};

const handleEmailMismatch = async (order, ps, reference) => {
    await NotificationModel.create({
        scope: 'admin', // ✅ FIXED: Use scope instead of user: null
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

        console.log(`🔸 createPaymentController called`);
        console.log(`   Order ID: ${orderId}`);
        console.log(`   Payment Method: ${method}`);
        console.log(`   Momo Details:`, momo || "Not provided");

        // ✅ Fetch user and order
        const user = await UserModel.findById(req.auth.id).select("email firstName lastName");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const mealOrder = await MealOrder.findById(orderId)
            .populate("buyer", "email")
            .populate("chef", "email paystack firstName lastName payoutDetails")
            .populate("meal", "mealName price");

        if (!mealOrder) {
            return res.status(404).json({ message: "Order not found" });
        }

        // ✅ Validate chef's payment setup
        const subaccountCode = mealOrder.chef.paystack?.subaccountCode;
        const payoutDetails = mealOrder.chef.payoutDetails;

        if (!subaccountCode || !payoutDetails?.bank?.bankCode || !payoutDetails?.bank?.accountNumber) {
            return res.status(400).json({
                message: "Chef payout setup is incomplete. Please contact support."
            });
        }

        // ✅ Validate momo data if method is momo
        if (method === "momo" && (!momo?.phone || !momo?.provider)) {
            return res.status(400).json({
                message: "Mobile money payment requires phone number and provider"
            });
        }

        // ✅ Initiate payment
        const paymentResponse = await initiatePayment({
            amount: mealOrder.totalPrice,
            email: user.email,
            method,
            momo,
            currency: "GHS",
            metadata: {
                orderId: mealOrder._id.toString(),
                buyerId: user._id.toString(),
                mealName: mealOrder.meal.mealName,
                chefId: mealOrder.chef._id.toString(),
            },
            subaccount: subaccountCode,
            bearer: "subaccount"
        });

        const reference = paymentResponse?.data?.reference;
        const authorizationUrl = paymentResponse?.data?.authorization_url;
        const paymentStatus = paymentResponse?.data?.status;
        const displayText = paymentResponse?.data?.display_text;
        const displayTextType = paymentResponse?.data?.display_text_type || "ussd";
        const channel = paymentResponse?.data?.channel || (method === "momo" ? "mobile_money" : "card");

        if (!reference) {
            return res.status(500).json({ message: "Payment initiation failed - no reference received" });
        }

        // ✅ Save payment info to order
        mealOrder.payment = {
            method,
            status: "pending",
            reference,
            subaccountUsed: subaccountCode,
            expiresAt: new Date(Date.now() + 3 * 60 * 1000),
            channel,
        };

        if (method === "momo") {
            mealOrder.payment.momoProvider = momo.provider;
            mealOrder.payment.displayText = displayText;
            mealOrder.payment.displayTextType = displayTextType;

            if (paymentStatus === "pay_offline") {
                mealOrder.payment.authorizationType = "offline";
            } else if (paymentStatus === "send_otp") {
                mealOrder.payment.authorizationType = "voucher";
            } else {
                mealOrder.payment.authorizationType = "online";
            }
        }

        await mealOrder.save();

        // ✅ Build response
        const responseData = {
            message: "Payment initiated successfully",
            order: mealOrder,
            paymentReference: reference,
            authorizationUrl,
            displayText,
            displayTextType,
            channel,
            subaccountUsed: subaccountCode,
            expiresAt: mealOrder.payment.expiresAt,
            authorizationType: mealOrder.payment.authorizationType,
        };

        if (method === "momo") {
            if (paymentStatus === "pay_offline") {
                responseData.message = "Payment initiated - authorize on your mobile device";
            } else if (paymentStatus === "send_otp") {
                responseData.message = "Dial the USSD code and enter the voucher";
            }
        }

        res.status(200).json(responseData);

    } catch (err) {
        console.error("❌ Error in createPaymentController:", err);
        res.status(err.status || 500).json({ message: err.message, details: err.details });
    }
};



// =======================
// Submit otp
// =======================



export const submitOtpController = async (req, res) => {
    const { reference, voucherCode } = req.body;

    if (!reference || !voucherCode) {
        return res.status(400).json({ error: "Reference and voucher code are required" });
    }

    try {
        const result = await submitOtp(reference, voucherCode);
        return res.status(200).json(result);
    } catch (err) {
        console.error("OTP submission failed:", err.message);
        return res.status(500).json({ error: "OTP submission failed" });
    }
};




// =======================
// VERIFY PAYMENT
// =======================

export const verifyPaymentController = async (req, res, next) => {
    try {
        const { paymentReference } = req.params;
        if (!paymentReference) {
            return res.status(400).json({ message: "paymentReference is required" });
        }

        console.log("🔹 Verifying payment for reference:", paymentReference);

        const order = await MealOrder.findOne({ "payment.reference": paymentReference })
            .populate("buyer", "email firstName lastName")
            .populate("chef", "email paystack firstName lastName")
            .populate("meal", "mealName price");

        if (!order) {
            return res.status(404).json({ message: "Order not found for this reference" });
        }

        // ✅ Expiry check
        if (order.payment?.expiresAt && new Date() > order.payment.expiresAt) {
            order.payment.status = "expired";
            order.payment.failureReason = "Payment session expired";
            await order.save();

            return res.status(400).json({
                message: "Payment session expired. Please try again.",
                order
            });
        }

        // ✅ Verify with Paystack
        const verified = await verifyPayment(paymentReference);
        console.log("🔹 Paystack verification response:", verified);

        const expectedAmount = Math.round(order.totalPrice * 100);
        const receivedAmount = verified.data.amount;

        // ✅ Handle SUCCESS
        if (verified?.status && verified.data.status === "success") {
            if (receivedAmount !== expectedAmount) {
                return res.status(400).json({
                    message: `Payment amount mismatch. Expected: GHS ${expectedAmount / 100} Received: GHS ${receivedAmount / 100}`,
                });
            }

            // ✅ USE UTILITY FUNCTION INSTEAD OF MANUAL UPDATE
            await updateOrderToPaid(order, verified.data);

            // Only send notifications if order was actually updated
            if (order.payment.status === "paid") {
                // ✅ IMPROVEMENT #1: Check notification flag
                if (order.notifiedPaid) {
                    console.log("🔁 Notification already sent for this order. Skipping.");
                } else {
                    // ✅ IMPROVEMENT #2: Wrap in try-catch
                    try {
                        await sendPaymentSuccessNotifications(order);
                        order.notifiedPaid = true;
                        await order.save();
                        console.log("✅ Notifications sent successfully from controller");
                    } catch (err) {
                        console.error("❌ Notification error in controller:", err.message);
                    }
                }
            }

            return res.status(200).json({
                message: "Payment verified successfully",
                order,
                payment: {
                    ...order.payment.toObject(),
                    authorizationType: order.payment.authorizationType,
                    gatewayResponse: verified.data.gateway_response,
                    authorization: verified.data.authorization || null
                }
            });
        }

        // ✅ Handle FAILURE
        if (["failed", "abandoned"].includes(verified?.data?.status)) {
            // ✅ USE UTILITY FUNCTION INSTEAD OF MANUAL UPDATE
            await updateOrderToFailed(order, verified.data);

            // Only send notifications if order was actually updated
            if (order.payment.status === "failed") {
                await sendPaymentFailedNotifications(order, verified.data);
            }

            return res.status(400).json({
                message: "Payment verification failed",
                failureReason: verified.data.gateway_response,
                data: verified.data,
            });
        }

        // ✅ Handle STILL PENDING
        if (verified?.data?.status === "pending") {
            // 🕒 Vodafone voucher timeout check
            if (
                order.payment.authorizationType === "voucher" &&
                order.payment.expiresAt &&
                new Date() > order.payment.expiresAt
            ) {
                order.payment.status = "expired";
                order.payment.failureReason = "Voucher not submitted in time";
                await order.save();

                return res.status(400).json({
                    message: "Voucher expired. Please restart payment.",
                    order
                });
            }

            return res.status(200).json({
                message: "Payment still processing",
                status: verified.data.status,
                order,
                authorizationType: order.payment.authorizationType
            });
        }

        // ⚠️ Fallback for unhandled states
        console.warn("⚠️ Unhandled Paystack status:", verified?.data?.status);
        return res.status(202).json({
            message: "Unhandled payment state",
            status: verified?.data?.status,
            data: verified?.data,
            authorizationType: order.payment.authorizationType
        });

    } catch (err) {
        console.error("❌ Error in verifyPaymentController:", err);
        next(err);
    }
};



