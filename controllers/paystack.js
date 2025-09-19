import crypto from "crypto";
import { initiatePayment, verifyPayment } from "../utils/paystack.js";
import { MealOrder } from "../models/mealOrder.js";
import { UserModel } from "../models/users.js";
import { NotificationModel } from "../models/notifications.js";
import { mailtransporter } from "../utils/mail.js";
import { sendUserNotification } from "../utils/push.js";

// export const paystackWebhook = async (req, res, next) => {
//     const rawBody = req.body;
//     const signature = req.headers['x-paystack-signature'];

//     // ✅ Validate webhook signature
//     const secret = process.env.PAYSTACK_SECRET_KEY;
//     const hash = crypto.createHmac('sha512', secret)
//         .update(rawBody)
//         .digest('hex');

//     if (hash !== signature) {
//         console.error('Invalid webhook signature! Potential fraud.');
//         await NotificationModel.create({
//             user: null,
//             title: "⚠️ Security Alert",
//             body: "Potential fraudulent webhook signature detected in Paystack webhook.",
//             url: "/admin/security",
//             type: 'security',
//             priority: 'high'
//         });
//         return res.sendStatus(400);
//     }

//     const event = JSON.parse(rawBody.toString());

//     try {
//         if (event.event === "charge.success") {
//             const reference = event.data.reference;

//             // 🔎 Verify with Paystack
//             const verified = await verifyPayment(reference);

//             if (verified.data.status === "success") {
//                 const order = await MealOrder.findOne({ "payment.reference": reference })
//                     .populate("buyer", "firstName lastName email")
//                     .populate("chef", "firstName lastName email paystack")
//                     .populate("meal", "mealName price");

//                 if (order && order.payment.status !== "paid") {
//                     // ✅ Double-check that Paystack amount == order.totalPrice
//                     if (verified.data.amount !== order.totalPrice * 100) {
//                         console.error(`⚠️ Payment amount mismatch for order ${order._id}`);
//                         await NotificationModel.create({
//                             user: null,
//                             title: "⚠️ Payment Mismatch",
//                             body: `Reference ${reference} attempted with mismatched amount. Expected ${order.totalPrice}, got ${verified.data.amount / 100}`,
//                             url: `/admin/orders/${order._id}`,
//                             type: 'payment',
//                             priority: 'high'
//                         });
//                         return res.sendStatus(400); // Reject
//                     }

//                     // ✅ Update order as paid
//                     order.payment.status = "paid";
//                     order.paidAt = new Date();

//                     // ✅ Calculate commission and earnings
//                     const commission = order.totalPrice * 0.15;
//                     const vendorEarnings = order.totalPrice - commission;
//                     order.commission = commission;
//                     order.vendorEarnings = vendorEarnings;

//                     await order.save();

//                     // ... 🔔 Send notifications + emails (unchanged from before) ...
//                 } else {
//                     console.log(`Order with reference ${reference} not found or already paid.`);
//                 }
//             }
//         }

//         // ✅ Handle transfer events (unchanged)
//         if (event.event === "transfer.success") {
//             await NotificationModel.create({
//                 user: null,
//                 title: "✅ Transfer Successful",
//                 body: `Transfer ${event.data.reference} to chef completed. Amount: GHS ${(event.data.amount / 100).toFixed(2)}`,
//                 url: "/admin/transfers",
//                 type: 'transfer'
//             });
//         }

//         if (event.event === "transfer.failed") {
//             await NotificationModel.create({
//                 user: null,
//                 title: "❌ Transfer Failed",
//                 body: `Transfer ${event.data.reference} failed. Reason: ${event.data.reason || 'Unknown'}`,
//                 url: "/admin/transfers",
//                 type: 'transfer',
//                 priority: 'high'
//             });
//         }

//         res.sendStatus(200);
//     } catch (err) {
//         console.error("Webhook processing error:", err.message);
//         await NotificationModel.create({
//             user: null,
//             title: "⚠️ Webhook Processing Error",
//             body: `Error processing Paystack webhook: ${err.message}`,
//             url: "/admin/system",
//             type: 'system',
//             priority: 'high'
//         });
//         res.sendStatus(500);
//     }
// };

export const paystackWebhook = async (req, res, next) => {
    try {
        // ⚠️ Use rawBody (string/buffer) for signature validation
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

        // ✅ Parse webhook event
        const event = typeof rawBody === "string" ? JSON.parse(rawBody) : req.body;

        // 🔹 Handle successful charge
        if (event.event === "charge.success") {
            const reference = event.data.reference;

            // 🔎 Verify with Paystack API
            const verified = await verifyPayment(reference);

            if (verified.status === "success") {
                const order = await MealOrder.findOne({ "payment.reference": reference })
                    .populate("buyer", "firstName lastName email")
                    .populate("chef", "firstName lastName email paystack")
                    .populate("meal", "mealName price");

                if (order && order.payment.status !== "paid") {
                    // ✅ Double-check amount
                    if (verified.amount !== order.totalPrice * 100) {
                        console.error(`⚠ Payment amount mismatch for order ${order._id}`);
                        await NotificationModel.create({
                            user: null,
                            title: "⚠ Payment Mismatch",
                            body: `Reference ${reference} attempted with mismatched amount. Expected ${order.totalPrice}, got ${verified.amount / 100}`,
                            url: `/admin/orders/${order._id}`,
                            type: "payment",
                            priority: "high",
                        });
                        return res.sendStatus(400);
                    }

                    // ✅ Double-check email
                    if (verified.customer.email !== order.buyer.email) {
                        console.error(`⚠ Email mismatch for order ${order._id}. Paystack: ${verified.customer.email}, Expected: ${order.buyer.email}`);
                        await NotificationModel.create({
                            user: null,
                            title: "⚠ Payment Email Mismatch",
                            body: `Reference ${reference} email mismatch. Paystack: ${verified.customer.email}, Expected: ${order.buyer.email}`,
                            url: `/admin/orders/${order._id}`,
                            type: "payment",
                            priority: "high",
                        });
                        return res.sendStatus(400);
                    }

                    // ✅ Update order
                    order.payment.status = "paid";
                    order.payment.reference = reference;
                    order.payment.transactionId = verified.id; // Paystack transaction ID
                    order.payment.channel = verified.channel;  // e.g., "bank", "card", "mobile_money"
                    order.paidAt = new Date();

                    // ✅ Commission + vendor earnings
                    const commission = order.totalPrice * 0.15;
                    order.commission = commission;
                    order.vendorEarnings = order.totalPrice - commission;

                    await order.save();

                    // TODO: 🔔 Trigger vendor payout logic here if needed
                } else {
                    console.log(`ℹ Order with reference ${reference} not found or already paid.`);
                }
            }
        }

        // 🔹 Handle transfer events
        if (event.event === "transfer.success") {
            await NotificationModel.create({
                user: null,
                title: "✅ Transfer Successful",
                body: `Transfer ${event.data.reference} to chef completed. Amount: GHS ${(event.data.amount / 100).toFixed(2)}`,
                url: "/admin/transfers",
                type: "transfer",
            });
        }

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


// export const createPaymentController = async (req, res, next) => {
//     try {
//         const { email, method, momo, orderId, chefId } = req.body;

//         // 🔎 Fetch the order securely from DB
//         const order = await MealOrder.findById(orderId)
//             .populate("chef", "paystack")
//             .populate("buyer", "email firstName lastName");

//         if (!order) {
//             return res.status(404).json({ error: "Order not found" });
//         }

//         if (order.payment.status === "paid") {
//             return res.status(400).json({ error: "Order already paid" });
//         }

//         // ✅ Always use totalPrice from DB, never trust frontend
//         const amount = order.totalPrice;

//         // Get chef’s subaccount code if available
//         let subaccountCode = null;
//         if (order.chef?.paystack?.subaccountCode) {
//             subaccountCode = order.chef.paystack.subaccountCode;
//         }

//         // 🔐 Initiate payment with Paystack
//         const paymentData = await initiatePayment({
//             email: email || order.buyer.email, // fallback to buyer email from DB
//             amount: amount * 100, // Convert to kobo
//             method,
//             momo,
//             metadata: {
//                 orderId: order._id.toString(),
//                 chefId: order.chef?._id?.toString()
//             },
//             subaccount: subaccountCode,
//             bearer: "subaccount"
//         });

//         // 🔔 Notify Admin of payment initiation
//         await NotificationModel.create({
//             user: null,
//             title: "🔄 Payment Initiated",
//             body: `Payment started for order ${order._id}. Amount: GHS ${amount.toFixed(2)}`,
//             url: `/admin/orders/${order._id}`,
//             type: "payment"
//         });

//         res.json({
//             authorization_url: paymentData.data.authorization_url,
//             reference: paymentData.data.reference,
//             access_code: paymentData.data.access_code
//         });

//     } catch (error) {
//         console.error("Create Payment Error:", error);

//         // 🔔 Notify Admin of failure
//         await NotificationModel.create({
//             user: null,
//             title: "❌ Payment Initiation Failed",
//             body: `Payment failed for order ${req.body.orderId}. Error: ${error.message}`,
//             url: "/admin/payments",
//             type: "payment",
//             priority: "high"
//         });

//         next(error);
//     }
// };


export const createPaymentController = async (req, res, next) => {
    try {
        const { email, amount, method, momo, orderId, chefId } = req.body;

        // Get chef's subaccount code if available
        let subaccountCode = null;
        if (chefId) {
            const chef = await UserModel.findById(chefId).select("paystack");
            subaccountCode = chef?.paystack?.subaccountCode;
        }

        // 🔎 Call Paystack to initiate payment
        const paymentData = await initiatePayment({
            email,
            amount: amount * 100, // Paystack expects kobo
            method,
            momo,
            metadata: {
                orderId,
                chefId
            },
            subaccount: subaccountCode,
            bearer: "subaccount"
        });

        const { reference, authorization_url, access_code } = paymentData.data;

        // ✅ Immediately update the order with payment details
        await MealOrder.findByIdAndUpdate(orderId, {
            $set: {
                "payment.reference": reference,
                "payment.status": "initiated",
                "payment.method": method,
                "payment.channel": momo ? "mobile_money" : undefined
            }
        });

        // 🔔 Notify Admin of payment initiation
        await NotificationModel.create({
            user: null,
            title: "🔄 Payment Initiated",
            body: `New payment initiated for order ${orderId}. Amount: GHS ${amount.toFixed(2)}`,
            url: `/admin/orders/${orderId}`,
            type: 'payment'
        });

        // ✅ Send Paystack details back to frontend
        res.json({
            authorization_url,
            reference,
            access_code
        });

    } catch (error) {
        console.error("Create Payment Error:", error);

        // 🔔 Notify Admin of payment initiation failure
        await NotificationModel.create({
            user: null,
            title: "❌ Payment Initiation Failed",
            body: `Failed to initiate payment for order ${req.body.orderId}. Error: ${error.message}`,
            url: "/admin/payments",
            type: 'payment',
            priority: 'high'
        });

        next(error);
    }
};


export const verifyPaymentController = async (req, res, next) => {
    try {
        const { reference } = req.params;
        const verification = await verifyPayment(reference);

        if (verification.data.status === "success") {
            const order = await MealOrder.findOne({ "payment.reference": reference });

            if (!order) {
                console.warn(`Verify: No order found for reference ${reference}`);
            } else if (order.payment.status === "paid") {
                console.log(`Verify: Order ${order._id} already marked as paid`);
            } else {
                order.payment.status = "verified";
                order.verifiedAt = new Date();
                await order.save();
            }

            await NotificationModel.create({
                user: null,
                title: "✅ Payment Manually Verified",
                body: `Payment ${reference} verified successfully.`,
                url: "/admin/payments",
                type: "payment",
            });

            res.json({
                status: true,
                message: "Payment verified successfully",
                data: verification.data,
            });
        } else {
            await NotificationModel.create({
                user: null,
                title: "❌ Payment Verification Failed",
                body: `Manual verification failed for ${reference}. Status: ${verification.data.status}`,
                url: "/admin/payments",
                type: "payment",
            });

            res.json({
                status: false,
                message: "Payment not successful",
                data: verification.data,
            });
        }
    } catch (error) {
        console.error("Verify Payment Error:", error);
        await NotificationModel.create({
            user: null,
            title: "⚠️ Payment Verification Error",
            body: `Error verifying ${req.params.reference}: ${error.message}`,
            url: "/admin/payments",
            type: "payment",
            priority: "high",
        });
        next(error);
    }
};





















// import crypto from "crypto";
// import { initiatePayment, verifyPayment } from "../utils/paystack.js";
// import { MealOrder } from "../models/mealOrder.js";
// import { UserModel } from "../models/users.js";
// import { NotificationModel } from "../models/notifications.js";
// import { mailtransporter } from "../utils/mail.js";
// import { sendUserNotification } from "../utils/push.js";

// export const paystackWebhook = async (req, res, next) => {
//     const rawBody = req.body;
//     const signature = req.headers['x-paystack-signature'];

//     // ✅ Validate webhook signature
//     const secret = process.env.PAYSTACK_SECRET_KEY;
//     const hash = crypto.createHmac('sha512', secret)
//         .update(rawBody)
//         .digest('hex');

//     if (hash !== signature) {
//         console.error('Invalid webhook signature! Potential fraud.');

//         // 🔔 Notify admin of potential fraud
//         await NotificationModel.create({
//             user: null,
//             title: "⚠️ Security Alert",
//             body: "Potential fraudulent webhook signature detected in Paystack webhook.",
//             url: "/admin/security",
//             type: 'security',
//             priority: 'high'
//         });

//         return res.sendStatus(400);
//     }

//     const event = JSON.parse(rawBody.toString());

//     try {
//         if (event.event === "charge.success") {
//             const reference = event.data.reference;

//             // 🔎 Verify with Paystack
//             const verified = await verifyPayment(reference);

//             if (verified.data.status === "success") {
//                 const order = await MealOrder.findOne({ "payment.reference": reference })
//                     .populate("buyer", "firstName lastName email")
//                     .populate("chef", "firstName lastName email paystack")
//                     .populate("meal", "mealName price");

//                 if (order && order.payment.status !== "paid") {
//                     // ✅ Update order as paid
//                     order.payment.status = "paid";
//                     order.paidAt = new Date();

//                     // ✅ Calculate commission and earnings (15% platform fee)
//                     const commission = order.totalPrice * 0.15;
//                     const vendorEarnings = order.totalPrice - commission;
//                     order.commission = commission;
//                     order.vendorEarnings = vendorEarnings;

//                     await order.save();

//                     // 🔔 Notify Chef
//                     await sendUserNotification(order.chef._id, {
//                         title: "💰 Payment Received",
//                         body: `Order #${order._id} has been paid by ${order.buyer.firstName}.`,
//                         url: "/dashboard/orders"
//                     });

//                     await NotificationModel.create({
//                         user: order.chef._id,
//                         title: "💰 Payment Received",
//                         body: `Order #${order._id} has been paid. Your earnings: GHS ${vendorEarnings.toFixed(2)}`,
//                         url: `/dashboard/orders/${order._id}`,
//                         type: 'payment'
//                     });

//                     // 🔔 Notify Buyer
//                     await sendUserNotification(order.buyer._id, {
//                         title: "✅ Payment Successful",
//                         body: `Your payment for ${order.quantity}x ${order.meal.mealName} was successful.`,
//                         url: "/dashboard/my-orders"
//                     });

//                     await NotificationModel.create({
//                         user: order.buyer._id,
//                         title: "✅ Payment Successful",
//                         body: `Payment for ${order.quantity}x ${order.meal.mealName} completed.`,
//                         url: `/dashboard/my-orders/${order._id}`,
//                         type: 'payment'
//                     });

//                     // 🔔 Notify Admin of successful payment
//                     await NotificationModel.create({
//                         user: null,
//                         title: "💰 New Payment Received",
//                         body: `Order #${order._id} paid successfully. Amount: GHS ${order.totalPrice.toFixed(2)}, Commission: GHS ${commission.toFixed(2)}`,
//                         url: `/admin/orders/${order._id}`,
//                         type: 'payment'
//                     });

//                     // 📧 Email Receipt to Buyer
//                     await mailtransporter.sendMail({
//                         from: `"Potluck 🍲" <${process.env.SMTP_FROM_EMAIL}>`,
//                         to: order.buyer.email,
//                         subject: "Potluck Payment Receipt",
//                         html: `
//                             <h2>Payment Receipt</h2>
//                             <p>Hi ${order.buyer.firstName},</p>
//                             <p>Thank you for your order on <b>Potluck</b>!</p>
//                             <p><b>Order ID:</b> ${order._id}</p>
//                             <p><b>Meal:</b> ${order.meal.mealName}</p>
//                             <p><b>Quantity:</b> ${order.quantity}</p>
//                             <p><b>Total Paid:</b> GHS ${order.totalPrice.toFixed(2)}</p>
//                             <p><b>Status:</b> Paid ✅</p>
//                             <br/>
//                             <p>You can track your order in the Potluck app.</p>
//                             <p>— Potluck Team 🍲</p>
//                         `
//                     });

//                     // 📧 Email Earnings to Chef
//                     await mailtransporter.sendMail({
//                         from: `"Potluck 🍲" <${process.env.SMTP_FROM_EMAIL}>`,
//                         to: order.chef.email,
//                         subject: "New Order Payment Received",
//                         html: `
//                             <h2>Order Payment Confirmed</h2>
//                             <p>Hi ${order.chef.firstName},</p>
//                             <p>You've just received payment for an order on <b>Potluck</b>!</p>
//                             <p><b>Order ID:</b> ${order._id}</p>
//                             <p><b>Meal:</b> ${order.meal.mealName}</p>
//                             <p><b>Quantity:</b> ${order.quantity}</p>
//                             <p><b>Total Paid by Buyer:</b> GHS ${order.totalPrice.toFixed(2)}</p>
//                             <p><b>Platform Commission (15%):</b> GHS ${commission.toFixed(2)}</p>
//                             <p><b>Your Earnings:</b> GHS ${vendorEarnings.toFixed(2)}</p>
//                             <br/>
//                             <p>Keep cooking and earning with Potluck 🍲</p>
//                             <p>— Potluck Team</p>
//                         `
//                     });

//                     // 📧 Email Admin about the transaction
//                     if (process.env.ADMIN_EMAIL) {
//                         await mailtransporter.sendMail({
//                             from: `"Potluck 🍲" <${process.env.SMTP_FROM_EMAIL}>`,
//                             to: process.env.ADMIN_EMAIL,
//                             subject: "💰 New Payment Processed",
//                             html: `
//                                 <h2>Payment Processed Successfully</h2>
//                                 <p><b>Order ID:</b> ${order._id}</p>
//                                 <p><b>Buyer:</b> ${order.buyer.firstName} ${order.buyer.lastName} (${order.buyer.email})</p>
//                                 <p><b>Chef:</b> ${order.chef.firstName} ${order.chef.lastName} (${order.chef.email})</p>
//                                 <p><b>Meal:</b> ${order.meal.mealName}</p>
//                                 <p><b>Quantity:</b> ${order.quantity}</p>
//                                 <p><b>Total Amount:</b> GHS ${order.totalPrice.toFixed(2)}</p>
//                                 <p><b>Platform Commission (15%):</b> GHS ${commission.toFixed(2)}</p>
//                                 <p><b>Chef Earnings:</b> GHS ${vendorEarnings.toFixed(2)}</p>
//                                 <p><b>Payment Reference:</b> ${reference}</p>
//                                 <br/>
//                                 <p>— Potluck System</p>
//                             `
//                         });
//                     }
//                 } else {
//                     console.log(`Order with reference ${reference} not found or already paid.`);
//                 }
//             }
//         }

//         // Handle transfer events
//         if (event.event === "transfer.success") {
//             console.log("Transfer to chef successful:", event.data);

//             // 🔔 Notify Admin of successful transfer
//             await NotificationModel.create({
//                 user: null,
//                 title: "✅ Transfer Successful",
//                 body: `Transfer ${event.data.reference} to chef completed successfully. Amount: GHS ${(event.data.amount / 100).toFixed(2)}`,
//                 url: "/admin/transfers",
//                 type: 'transfer'
//             });
//         }

//         if (event.event === "transfer.failed") {
//             console.error("Transfer to chef failed:", event.data);

//             // 🔔 Notify Admin of failed transfer
//             await NotificationModel.create({
//                 user: null,
//                 title: "❌ Transfer Failed",
//                 body: `Transfer ${event.data.reference} failed. Reason: ${event.data.reason || 'Unknown'}`,
//                 url: "/admin/transfers",
//                 type: 'transfer',
//                 priority: 'high'
//             });

//             // 📧 Email admin about failed transfer
//             if (process.env.ADMIN_EMAIL) {
//                 await mailtransporter.sendMail({
//                     from: `"Potluck 🍲" <${process.env.SMTP_FROM_EMAIL}>`,
//                     to: process.env.ADMIN_EMAIL,
//                     subject: "❌ Transfer Failed - Action Required",
//                     html: `
//                         <h2>Transfer Failed</h2>
//                         <p><b>Transfer Reference:</b> ${event.data.reference}</p>
//                         <p><b>Amount:</b> GHS ${(event.data.amount / 100).toFixed(2)}</p>
//                         <p><b>Reason:</b> ${event.data.reason || 'Unknown'}</p>
//                         <p><b>Timestamp:</b> ${new Date().toLocaleString()}</p>
//                         <br/>
//                         <p>Please check the Paystack dashboard and take appropriate action.</p>
//                         <p>— Potluck System</p>
//                     `
//                 });
//             }
//         }

//         res.sendStatus(200);
//     } catch (err) {
//         console.error("Webhook processing error:", err.message);

//         // 🔔 Notify Admin of webhook processing error
//         await NotificationModel.create({
//             user: null,
//             title: "⚠️ Webhook Processing Error",
//             body: `Error processing Paystack webhook: ${err.message}`,
//             url: "/admin/system",
//             type: 'system',
//             priority: 'high'
//         });

//         res.sendStatus(500);
//     }
// };

// export const createPaymentController = async (req, res, next) => {
//     try {
//         const { email, amount, method, momo, orderId, chefId } = req.body;

//         // Get chef's subaccount code if available
//         let subaccountCode = null;
//         if (chefId) {
//             const chef = await UserModel.findById(chefId).select("paystack");
//             subaccountCode = chef?.paystack?.subaccountCode;
//         }

//         const paymentData = await initiatePayment({
//             email,
//             amount: amount * 100, // Convert to kobo
//             method,
//             momo,
//             metadata: {
//                 orderId,
//                 chefId
//             },
//             subaccount: subaccountCode,
//             bearer: "subaccount"
//         });

//         // 🔔 Notify Admin of payment initiation
//         await NotificationModel.create({
//             user: null,
//             title: "🔄 Payment Initiated",
//             body: `New payment initiated for order ${orderId}. Amount: GHS ${amount.toFixed(2)}`,
//             url: `/admin/orders/${orderId}`,
//             type: 'payment'
//         });

//         res.json({
//             authorization_url: paymentData.data.authorization_url,
//             reference: paymentData.data.reference,
//             access_code: paymentData.data.access_code
//         });

//     } catch (error) {
//         console.error("Create Payment Error:", error);

//         // 🔔 Notify Admin of payment initiation failure
//         await NotificationModel.create({
//             user: null,
//             title: "❌ Payment Initiation Failed",
//             body: `Failed to initiate payment for order ${req.body.orderId}. Error: ${error.message}`,
//             url: "/admin/payments",
//             type: 'payment',
//             priority: 'high'
//         });

//         next(error);
//     }
// };

// export const verifyPaymentController = async (req, res, next) => {
//     try {
//         const { reference } = req.params;

//         const verification = await verifyPayment(reference);

//         if (verification.data.status === 'success') {
//             // Optional: Update order status here for immediate feedback
//             await MealOrder.findOneAndUpdate(
//                 { "payment.reference": reference },
//                 {
//                     "payment.status": "verified",
//                     verifiedAt: new Date()
//                 }
//             );

//             // 🔔 Notify Admin of manual verification
//             await NotificationModel.create({
//                 user: null,
//                 title: "✅ Payment Manually Verified",
//                 body: `Payment ${reference} was manually verified successfully.`,
//                 url: "/admin/payments",
//                 type: 'payment'
//             });

//             res.json({
//                 status: true,
//                 message: "Payment verified successfully",
//                 data: verification.data
//             });
//         } else {
//             // 🔔 Notify Admin of failed manual verification
//             await NotificationModel.create({
//                 user: null,
//                 title: "❌ Payment Verification Failed",
//                 body: `Manual verification failed for payment ${reference}. Status: ${verification.data.status}`,
//                 url: "/admin/payments",
//                 type: 'payment'
//             });

//             res.json({
//                 status: false,
//                 message: "Payment not successful",
//                 data: verification.data
//             });
//         }

//     } catch (error) {
//         console.error("Verify Payment Error:", error);

//         // 🔔 Notify Admin of verification error
//         await NotificationModel.create({
//             user: null,
//             title: "⚠️ Payment Verification Error",
//             body: `Error verifying payment ${req.params.reference}: ${error.message}`,
//             url: "/admin/payments",
//             type: 'payment',
//             priority: 'high'
//         });

//         next(error);
//     }
// };