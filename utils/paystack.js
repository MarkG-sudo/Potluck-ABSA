import axios from "axios";

const paystack = axios.create({
    baseURL: "https://api.paystack.co",
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
    }
});

/**
 * Initiate a payment with subaccount support
 */
export const initiatePayment = async ({
    email,
    amount,
    metadata,
    method,
    momo,
    subaccount,
    bearer = "subaccount"
}) => {
    const basePayload = {
        email,
        amount,
        currency: "GHS",
        metadata,
        subaccount, // Add subaccount for split payments
        bearer      // Who bears the transaction charge
    };

    if (method === "momo") {
        const res = await paystack.post("/charge", {
            ...basePayload,
            mobile_money: {
                phone: momo.phone,
                provider: momo.provider
            }
        });
        return res.data;
    } else {
        const res = await paystack.post("/transaction/initialize", {
            ...basePayload,
            channels: method === "bank" ? ["bank"] : ["card", "bank"]
        });
        return res.data;
    }
};

export const verifyPayment = async (reference) => {
    const res = await paystack.get(`/transaction/verify/${reference}`);
    return res.data;
};

// ✅ Additional utility for creating transfers to chefs
export const createTransfer = async ({
    source = "balance",
    reason,
    amount,
    recipient,
    reference
}) => {
    const res = await paystack.post("/transfer", {
        source,
        reason,
        amount: amount * 100, // Convert to kobo
        recipient,
        reference
    });
    return res.data;
};

// ✅ Utility to resolve bank account details
export const resolveAccount = async (accountNumber, bankCode) => {
    const res = await paystack.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
    return res.data;
};

// Get list of banks for Ghana
export const getBanks = async () => {
    const res = await paystack.get("/bank?country=ghana");
    return res.data;
};

// Create transfer recipient (for chef payouts)
export const createTransferRecipient = async ({
    type,
    name,
    account_number,
    bank_code,
    currency = "GHS"
}) => {
    const res = await paystack.post("/transferrecipient", {
        type,
        name,
        account_number,
        bank_code,
        currency
    });
    return res.data;
};

// Verify transfer status
export const verifyTransfer = async (reference) => {
    const res = await paystack.get(`/transfer/verify/${reference}`);
    return res.data;
};