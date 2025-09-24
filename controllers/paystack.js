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
                    // ✅ Double-check amount
                    if (ps.amount !== order.totalPrice * 100) {
                        console.error(`⚠ Payment amount mismatch for order ${order._id}`);
                        await NotificationModel.create({
                            user: null,
                            title: "⚠ Payment Mismatch",
                            body: `Reference ${reference} attempted with mismatched amount. Expected ${order.totalPrice}, got ${ps.amount / 100}`,
                            url: `/admin/orders/${order._id}`,
                            type: "payment",
                            priority: "high",
                        });
                        return res.sendStatus(400);
                    }

                    // ✅ Double-check email
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

        // Fetch user
        const user = await UserModel.findById(req.auth.id).select("email firstName lastName");
        if (!user) return res.status(404).json({ message: "User not found" });

        // Fetch order
        const mealOrder = await MealOrder.findById(orderId)
            .populate("buyer", "firstName lastName email")
            .populate("chef", "firstName lastName email paystack")
            .populate("meal", "mealName price");

        if (!mealOrder) return res.status(404).json({ message: "Order not found" });

        console.log("💡 Meal Order fetched:", mealOrder);

        // Initiate payment
        let paymentResponse;
        try {
            paymentResponse = await initiatePayment({
                amount: mealOrder.totalPrice * 100,
                email: user.email,
                reference: `ORD_${Date.now()}_${orderId}`,
                method,
                momo,
            });
        } catch (payErr) {
            console.error("❌ Paystack initiation error:", payErr?.response?.data || payErr?.message || payErr);
            return res.status(500).json({ message: "Payment initiation failed", error: payErr?.message || payErr });
        }

        console.log("💡 Paystack initiate response:", JSON.stringify(paymentResponse, null, 2));

        // Safe check for payment response
        if (!paymentResponse?.data?.reference) {
            console.error("❌ Paystack initiate returned invalid response!", paymentResponse);
            return res.status(500).json({ message: "Payment initiation failed" });
        }

        const reference = paymentResponse.data.reference;

        // Save payment reference safely
        mealOrder.payment = mealOrder.payment || {};
        mealOrder.payment.method = method;
        mealOrder.payment.status = "pending";
        mealOrder.payment.reference = reference;

        // 🔍 DEBUG LOG: show side-by-side comparison
        console.log("💾 Preparing to save payment info:");
        console.log("Order ID:", mealOrder._id);
        console.log("Payment object to save:", mealOrder.payment);
        console.log("Paystack reference:", reference);

        await mealOrder.save();
        console.log("✅ Payment reference saved in order:", mealOrder.payment);

        res.status(200).json({
            message: "Payment initiated successfully",
            order: mealOrder,
            paymentReference: reference,
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
        const { paymentReference } = req.body;

        console.log("Verifying payment for reference:", paymentReference);

        if (!paymentReference) {
            console.error("No paymentReference provided in request body");
            return res.status(400).json({ message: "paymentReference is required" });
        }

        // ✅ Fetch the order by payment reference
        const mealOrder = await MealOrder.findOne({ "payment.reference": paymentReference });
        if (!mealOrder) {
            console.error("No order found for paymentReference:", paymentReference);
            return res.status(404).json({ message: "Order not found" });
        }

        console.log("Order fetched for verification:", mealOrder);

        // ✅ Verify payment with Paystack
        const verified = await verifyPayment(paymentReference);

        console.log("Paystack verification response:", verified);

        if (!verified || !verified.data) {
            console.error("Invalid response from Paystack verification");
            return res.status(500).json({ message: "Payment verification failed" });
        }

        // ✅ Check if payment was successful
        if (verified.data.status !== "success") {
            console.warn("Payment not successful:", verified.data);
            mealOrder.payment.status = "failed";
            await mealOrder.save();
            return res.status(400).json({ message: "Payment not successful" });
        }

        // ✅ Amount check to prevent tampering
        if (verified.data.amount !== mealOrder.totalPrice * 100) {
            console.error(
                "Payment amount mismatch. Expected:",
                mealOrder.totalPrice * 100,
                "Received:",
                verified.data.amount
            );
            return res.status(400).json({ message: "Payment amount mismatch" });
        }

        // ✅ Update order as paid
        mealOrder.payment.status = "paid";
        mealOrder.payment.transactionId = verified.data.id; // Paystack transaction ID
        mealOrder.paidAt = new Date();
        await mealOrder.save();

        console.log("Payment verified and order updated:", mealOrder);

        return res.status(200).json({
            message: "Payment verified successfully",
            order: mealOrder,
        });
    } catch (error) {
        console.error("Error in verifyPaymentController:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



// export const verifyPaymentController = async (req, res, next) => {
//     try {
//         const { reference } = req.body;

//         // ✅ Fetch order by reference
//         const order = await MealOrder.findOne({ "payment.reference": reference }).populate("meal chef buyer");
//         if (!order) return res.status(404).json({ message: "Order not found" });

//         if (order.payment.status === "paid") {
//             return res.status(400).json({ message: "Order already verified" });
//         }

//         // ✅ Verify payment with Paystack
//         const verified = await verifyPayment(reference);

//         if (verified.status !== "success") {
//             return res.status(400).json({ message: "Payment not successful" });
//         }

//         if (verified.data.amount !== order.totalPrice * 100) {
//             return res.status(400).json({ message: "Payment amount mismatch" });
//         }

//         // ✅ Update order payment
//         order.payment.status = "paid";
//         order.payment.transactionId = verified.data.id; // Paystack transaction ID
//         await order.save();

//         // ✅ Send notifications
//         await NotificationModel.create([
//             {
//                 user: order.buyer._id,
//                 title: "Payment Successful",
//                 message: `Your payment for order ${order._id} was successful.`,
//                 data: { orderId: order._id.toString() }
//             },
//             {
//                 user: order.chef._id,
//                 title: "New Order Paid",
//                 message: `Order ${order._id} has been paid by the buyer.`,
//                 data: { orderId: order._id.toString() }
//             }
//         ]);

//         res.status(200).json({
//             message: "Payment verified successfully",
//             order
//         });
//     } catch (error) {
//         next(error);
//     }
// };














// export const createPaymentController = async (req, res, next) => {
//     try {
//         const { orderId, method, momo } = req.body;

//         // ✅ Fetch user
//         const user = await UserModel.findById(req.auth.id).select("email firstName lastName");
//         if (!user) return res.status(404).json({ message: "User not found" });

//         // ✅ Fetch meal order with full population
//         const mealOrder = await MealOrder.findById(orderId)
//             .populate("buyer", "firstName lastName email")
//             .populate("chef", "firstName lastName email paystack")
//             .populate("meal", "mealName price");

//         if (!mealOrder) return res.status(404).json({ message: "Order not found" });
//         if (mealOrder.payment.status === "paid") {
//             return res.status(400).json({ message: "Order already paid" });
//         }

//         // ✅ Use pre-generated reference or generate inline
//         const reference = mealOrder.payment.reference || `ORD_${crypto.randomBytes(6).toString("hex")}_${Date.now()}`;
//         mealOrder.payment.reference = reference;
//         mealOrder.payment.method = method || mealOrder.payment.method;
//         await mealOrder.save();

//         // ✅ Prepare metadata
//         const metadata = {
//             orderId: mealOrder._id.toString(),
//             buyerId: user._id.toString(),
//             chefId: mealOrder.chef?._id?.toString(),
//             paymentMethod: method,
//             reference,
//         };

//         // ✅ Initiate Paystack payment
//         const amount = mealOrder.totalPrice;
//         if (!amount || amount <= 0) {
//             return res.status(400).json({ message: "Invalid order amount" });
//         }

//         const subaccount = mealOrder.chef?.paystack?.subaccountCode || undefined;

//         const response = await initiatePayment({
//             email: user.email,
//             amount,
//             metadata,
//             method,
//             momo,
//             subaccount,
//         });

//         const psData = response?.data;
//         if (!psData) {
//             throw new Error("Unexpected Paystack response shape");
//         }

//         // ✅ Log notification
//         await NotificationModel.create({
//             user: null,
//             title: "🔄 Payment Initiated",
//             body: `Payment initiated for order ${mealOrder._id}. Amount: GHS ${amount}`,
//             url: `/admin/orders/${mealOrder._id}`,
//             type: "payment",
//         });

//         return res.status(200).json({
//             status: "success",
//             authorizationUrl: psData.authorization_url,
//             reference: mealOrder.payment.reference,
//             metadata,
//         });

//     } catch (err) {
//         console.error("createPaymentController error:", err.response?.data || err.message);
//         return res.status(500).json({
//             message: "Payment initiation failed",
//             error: err.response?.data?.message || err.message,
//         });
//     }
// };



// export const verifyPaymentController = async (req, res, next) => {
//     try {
//         const { reference, orderId } = req.body;
//         if (!reference || !orderId) {
//             return res.status(400).json({ message: "Reference and orderId are required" });
//         }

//         const verified = await verifyPayment(reference);
//         const ps = verified?.data;
//         if (!ps) {
//             return res.status(400).json({ message: "Invalid Paystack response" });
//         }

//         const mealOrder = await MealOrder.findById(orderId).populate("buyer chef meal");
//         if (!mealOrder) return res.status(404).json({ message: "Order not found" });

//         if (ps.status !== "success") {
//             return res.status(400).json({ message: "Payment not successful", details: ps });
//         }

//         const expectedAmount = Math.round(mealOrder.totalPrice * 100);
//         if (ps.amount !== expectedAmount) {
//             return res.status(400).json({
//                 message: "Payment amount mismatch",
//                 expected: expectedAmount,
//                 got: ps.amount,
//             });
//         }

//         if (ps.currency !== "GHS") {
//             return res.status(400).json({ message: "Invalid currency", got: ps.currency });
//         }

//         if (mealOrder.payment.status === "paid") {
//             return res.status(200).json({ message: "Order already marked paid" });
//         }

//         // ✅ Update payment details but **do not overwrite reference if pre-set**
//         mealOrder.payment.status = "paid";
//         mealOrder.payment.transactionId = ps.id;
//         mealOrder.payment.channel = ps.channel;
//         mealOrder.payment.paidAt = ps.paid_at ? new Date(ps.paid_at) : new Date();
//         mealOrder.payment.reference = mealOrder.payment.reference || ps.reference;

//         const commission = mealOrder.totalPrice * 0.15;
//         mealOrder.commission = commission;
//         mealOrder.vendorEarnings = mealOrder.totalPrice - commission;

//         await mealOrder.save();

//         // 🔔 Notifications
//         try {
//             await sendUserNotification(mealOrder.chef._id, {
//                 title: "💰 New Paid Order",
//                 body: `Order ${mealOrder._id} has been paid.`,
//                 url: `/dashboard/orders/${mealOrder._id}`,
//             });
//             await sendUserNotification(mealOrder.buyer._id, {
//                 title: "✅ Payment Confirmed",
//                 body: `Your payment for Order ${mealOrder._id} was successful.`,
//                 url: `/dashboard/my-orders/${mealOrder._id}`,
//             });
//         } catch (pushErr) {
//             console.warn("Push notification failed:", pushErr?.message || pushErr);
//         }

//         // 📧 Email
//         try {
//             await mailtransporter.sendMail({
//                 from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
//                 to: mealOrder.buyer.email,
//                 subject: "Payment Receipt",
//                 html: `<p>Hi ${mealOrder.buyer.firstName}, your payment for order ${mealOrder._id} was successful.</p>`,
//             });
//         } catch (mailErr) {
//             console.warn("Buyer email failed:", mailErr?.message || mailErr);
//         }

//         await NotificationModel.create({
//             user: null,
//             title: "✅ Payment Verified",
//             body: `Payment for order ${mealOrder._id} verified. Amount: GHS ${mealOrder.totalPrice}`,
//             url: `/admin/orders/${mealOrder._id}`,
//             type: "payment",
//         });

//         return res.status(200).json({
//             status: "success",
//             message: "Payment verified successfully",
//             data: {
//                 reference: mealOrder.payment.reference,
//                 amount: ps.amount / 100,
//                 currency: ps.currency,
//                 channel: ps.channel,
//                 paidAt: ps.paid_at,
//             },
//         });
//     } catch (err) {
//         console.error("verifyPaymentController error:", err.response?.data || err.message);
//         return res.status(500).json({
//             message: "Payment verification failed",
//             error: err.response?.data?.message || err.message,
//         });
//     }
// };


// export const createPaymentController = async (req, res, next) => {
//     try {
//         const { orderId, method, momo } = req.body;

//         // ✅ Fetch user
//         const user = await UserModel.findById(req.auth.id).select("email firstName lastName");
//         if (!user) return res.status(404).json({ message: "User not found" });

//         // ✅ Fetch order
//         const mealOrder = await MealOrder.findById(orderId).populate("buyer chef meal");
//         if (!mealOrder) return res.status(404).json({ message: "Order not found" });

//         // ✅ Check if already paid
//         if (mealOrder.payment.status === "paid") {
//             return res.status(400).json({ message: "Order already paid" });
//         }

//         const amount = mealOrder.totalPrice;
//         if (!amount || amount <= 0) {
//             return res.status(400).json({ message: "Invalid order amount" });
//         }

//         const subaccount = mealOrder.chef?.paystack?.subaccountCode || undefined;

//         // ✅ Use pre-generated reference or generate if missing
//         const reference = mealOrder.payment.reference || generateReference();
//         mealOrder.payment.reference = reference;
//         mealOrder.payment.method = method || mealOrder.payment.method;
//         await mealOrder.save();

//         const metadata = {
//             orderId: mealOrder._id.toString(),
//             buyerId: user._id.toString(),
//             chefId: mealOrder.chef?._id?.toString(),
//             paymentMethod: method,
//             reference,
//         };

//         // ✅ Initiate Paystack payment
//         const response = await initiatePayment({
//             email: user.email,
//             amount,
//             metadata,
//             method,
//             momo,
//             subaccount,
//         });

//         const psData = response?.data;
//         if (!psData) {
//             throw new Error("Unexpected Paystack response shape");
//         }

//         await NotificationModel.create({
//             user: null,
//             title: "🔄 Payment Initiated",
//             body: `Payment initiated for order ${mealOrder._id}. Amount: GHS ${amount}`,
//             url: `/admin/orders/${mealOrder._id}`,
//             type: "payment",
//         });

//         return res.status(200).json({
//             status: "success",
//             authorizationUrl: psData.authorization_url,
//             reference: psData.reference,
//             metadata,
//         });
//     } catch (err) {
//         console.error("createPaymentController error:", err.response?.data || err.message);
//         return res.status(500).json({
//             message: "Payment initiation failed",
//             error: err.response?.data?.message || err.message,
//         });
//     }
// };



