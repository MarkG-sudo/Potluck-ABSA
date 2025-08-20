import axios from "axios";

const paystack = axios.create({
    baseURL: "https://api.paystack.co",
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
    }
});

/**
 * Initiate a payment
 * @param {Object} params
 * @param {string} params.email - buyer email
 * @param {number} params.amount - amount in pesewas (GHS * 100)
 * @param {Object} params.metadata - extra metadata (orderId, buyerId, etc.)
 * @param {string} params.method - "paystack" | "bank" | "momo"
 * @param {Object} params.momo - optional (phone, provider)
 */
export const initiatePayment = async ({ email, amount, metadata, method, momo }) => {
    if (method === "momo") {
        // ✅ Mobile Money via /charge
        const res = await paystack.post("/charge", {
            email,
            amount,
            currency: "GHS",
            mobile_money: {
                phone: momo.phone,
                provider: momo.provider // "mtn", "vodafone", "airteltigo"
            },
            metadata
        });
        return res.data;
    } else {
        // ✅ Card or Bank via /transaction/initialize
        const res = await paystack.post("/transaction/initialize", {
            email,
            amount,
            currency: "GHS",
            channels: method === "bank" ? ["bank"] : ["card"],
            metadata
        });
        return res.data;
    }
};

// ✅ Verify transaction
export const verifyPayment = async (reference) => {
    const res = await paystack.get(`/transaction/verify/${reference}`);
    return res.data;
};
