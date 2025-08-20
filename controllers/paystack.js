import crypto from "crypto";
import { initiatePayment, verifyPayment } from "../utils/paystack.js";
import { MealOrder } from "../models/mealOrder.js";
import { mailtransporter } from "../utils/mail.js";

// export const paystackWebhook = async (req, res, next) => {
//     try {
//         const event = req.body;

//         if (event.event === "charge.success") {
//             const reference = event.data.reference;

//             // 🔎 Verify with Paystack
//             const verified = await verifyPayment(reference);

//             if (verified.data.status === "success") {
//                 const order = await MealOrder.findOne({ "payment.reference": reference })
//                     .populate("buyer", "firstName lastName email")
//                     .populate("chef", "firstName lastName email")
//                     .populate("meal", "mealName price");

//                 if (order) {
//                     // ✅ Update order as paid
//                     order.payment.status = "paid";
//                     order.paidAt = new Date();
//                     await order.save();

//                     // 🔔 Notify Chef
//                     await sendUserNotification(order.chef._id, {
//                         title: "💰 Payment Received",
//                         body: `Order #${order._id} has been paid by ${order.buyer.firstName}.`,
//                         url: "/dashboard/orders"
//                     });

//                     // 🔔 Notify Buyer
//                     await sendUserNotification(order.buyer._id, {
//                         title: "✅ Payment Successful",
//                         body: `Your payment for ${order.quantity}x ${order.meal.mealName} was successful.`,
//                         url: "/dashboard/my-orders"
//                     });

//                     // 📧 Email Receipt to Buyer
//                     await mailtransporter.sendMail({
//                         from: `"Potluck 🍲" <gidodoom@gmail.com>`,
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
//                         from: `"Potluck 🍲" <gidodoom@gmail.com>`,
//                         to: order.chef.email,
//                         subject: "New Order Payment Received",
//                         html: `
//                             <h2>Order Payment Confirmed</h2>
//                             <p>Hi ${order.chef.firstName},</p>
//                             <p>You’ve just received payment for an order on <b>Potluck</b>!</p>
//                             <p><b>Order ID:</b> ${order._id}</p>
//                             <p><b>Meal:</b> ${order.meal.mealName}</p>
//                             <p><b>Quantity:</b> ${order.quantity}</p>
//                             <p><b>Total Paid by Buyer:</b> GHS ${order.totalPrice.toFixed(2)}</p>
//                             <p><b>Commission (15%):</b> GHS ${order.commission.toFixed(2)}</p>
//                             <p><b>Your Earnings:</b> GHS ${order.vendorEarnings.toFixed(2)}</p>
//                             <br/>
//                             <p>Keep cooking and earning with Potluck 🍲</p>
//                             <p>— Potluck Team</p>
//                         `
//                     });
//                 }
//             }
//         }

//         res.sendStatus(200); // ✅ Always 200 for Paystack
//     } catch (err) {
//         console.error("Webhook error:", err.message);
//         res.sendStatus(500);
//     }
// };

export const paystackWebhook = async (req, res, next) => {
    
    const rawBody = req.body; // This is a Buffer because of bodyParser.raw()
    const signature = req.headers['x-paystack-signature'];

    // ✅  Validate the webhook signature
    const secret = process.env.PAYSTACK_SECRET_KEY; // Use your secret key
    const hash = crypto.createHmac('sha512', secret)
        .update(rawBody) // Use the RAW BODY buffer
        .digest('hex');

    // ✅ Compare the signature from Paystack 
    if (hash !== signature) {
        console.error('Invalid webhook signature! Potential fraud.');
        return res.sendStatus(400); // Do not process fraudulent webhooks
    }

    // ✅  safely parse the raw body into a JSON object
    const event = JSON.parse(rawBody.toString()); // Convert Buffer to String first

    try {
        if (event.event === "charge.success") {
            const reference = event.data.reference;

            // 🔎 Verify with Paystack
            const verified = await verifyPayment(reference);

            if (verified.data.status === "success") {
                const order = await MealOrder.findOne({ "payment.reference": reference })
                    .populate("buyer", "firstName lastName email")
                    .populate("chef", "firstName lastName email")
                    .populate("meal", "mealName price");

                // ✅ LOGICAL FIX: Check if order is already paid to avoid duplicates
                if (order && order.payment.status !== "paid") {
                    // ✅ Update order as paid
                    order.payment.status = "paid";
                    order.paidAt = new Date();
                    await order.save();

                    // 🔔 Notify Chef
                    await sendUserNotification(order.chef._id, {
                        title: "💰 Payment Received",
                        body: `Order #${order._id} has been paid by ${order.buyer.firstName}.`,
                        url: "/dashboard/orders"
                    });

                    // 🔔 Notify Buyer
                    await sendUserNotification(order.buyer._id, {
                        title: "✅ Payment Successful",
                        body: `Your payment for ${order.quantity}x ${order.meal.mealName} was successful.`,
                        url: "/dashboard/my-orders"
                    });

                    // ... REST OF YOUR EMAIL CODE ...
                    // 📧 Email Receipt to Buyer
                    await mailtransporter.sendMail({
                        from: `"Potluck 🍲" <gidodoom@gmail.com>`,
                        to: order.buyer.email,
                        subject: "Potluck Payment Receipt",
                        html: `
                            <h2>Payment Receipt</h2>
                            <p>Hi ${order.buyer.firstName},</p>
                            <p>Thank you for your order on <b>Potluck</b>!</p>
                            <p><b>Order ID:</b> ${order._id}</p>
                            <p><b>Meal:</b> ${order.meal.mealName}</p>
                            <p><b>Quantity:</b> ${order.quantity}</p>
                            <p><b>Total Paid:</b> GHS ${order.totalPrice.toFixed(2)}</p>
                            <p><b>Status:</b> Paid ✅</p>
                            <br/>
                            <p>You can track your order in the Potluck app.</p>
                            <p>— Potluck Team 🍲</p>
                        `
                    });

                    // 📧 Email Earnings to Chef
                    await mailtransporter.sendMail({
                        from: `"Potluck 🍲" <gidodoom@gmail.com>`,
                        to: order.chef.email,
                        subject: "New Order Payment Received",
                        html: `
                            <h2>Order Payment Confirmed</h2>
                            <p>Hi ${order.chef.firstName},</p>
                            <p>You’ve just received payment for an order on <b>Potluck</b>!</p>
                            <p><b>Order ID:</b> ${order._id}</p>
                            <p><b>Meal:</b> ${order.meal.mealName}</p>
                            <p><b>Quantity:</b> ${order.quantity}</p>
                            <p><b>Total Paid by Buyer:</b> GHS ${order.totalPrice.toFixed(2)}</p>
                            <p><b>Commission (15%):</b> GHS ${order.commission.toFixed(2)}</p>
                            <p><b>Your Earnings:</b> GHS ${order.vendorEarnings.toFixed(2)}</p>
                            <br/>
                            <p>Keep cooking and earning with Potluck 🍲</p>
                            <p>— Potluck Team</p>
                        `
                    });
                } else {
                    console.log(`Order with reference ${reference} not found or already paid.`);
                }
            }
        }

        res.sendStatus(200); // ✅ Always 200 for Paystack
    } catch (err) {
        console.error("Webhook processing error:", err.message);
        res.sendStatus(500);
    }
};
// ✅ Controller for POST /api/create-payment
export const createPaymentController = async (req, res, next) => {
    try {
        const { email, amount, method, momo, orderId } = req.body;

        
        const paymentData = await initiatePayment({
            email,
            amount,
            method, // e.g., "card", "momo"
            momo,   // { phone, provider } if method is "momo"
            metadata: { orderId } //  Paystack ref to your order
        });

        // Send the payment authorization URL back to the PWA
        res.json({
            authorization_url: paymentData.data.authorization_url,
            reference: paymentData.data.reference
        });

    } catch (error) {
        console.error("Create Payment Error:", error);
        next(error);
    }
};

// ✅ Controller for GET /api/verify-payment/:reference
export const verifyPaymentController = async (req, res, next) => {
    try {
        const { reference } = req.params;

        // Use the function from your first code block
        const verification = await verifyPayment(reference);

        // Check the status from Paystack's API
        if (verification.data.status === 'success') {
            // You can optionally update the order status here too,
            // but the webhook is the primary handler for this.
            res.json({
                status: true,
                message: "Payment verified successfully",
                data: verification.data
            });
        } else {
            // Payment failed or is pending
            res.json({
                status: false,
                message: "Payment not successful",
                data: verification.data
            });
        }

    } catch (error) {
        console.error("Verify Payment Error:", error);
        next(error);
    }
};