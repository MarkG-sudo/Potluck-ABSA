import axios from "axios";

const paystack = axios.create({
    baseURL: "https://api.paystack.co",
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
    }
});

// ✅ Initiate a payment (bank / card / MoMo) with subaccount support
export const initiatePayment = async ({
    email,
    amount,
    metadata,
    method,
    momo,
    subaccount,
    bearer = "subaccount"
}) => {
    try {
        const scaledAmount = Math.round(amount * 100); // convert to pesewas

        const basePayload = {
            email,
            amount: scaledAmount,
            currency: "GHS",
            metadata,
            subaccount,
            bearer
        };

        if (method === "momo") {
            if (!momo?.phone || !momo?.provider) {
                throw new Error("Mobile money payment requires phone and provider");
            }

            const res = await paystack.post("/charge", {
                ...basePayload,
                mobile_money: {
                    phone: momo.phone,
                    provider: momo.provider
                }
            });
            return res.data.data;
        } else {
            const res = await paystack.post("/transaction/initialize", {
                ...basePayload,
                channels: method === "bank" ? ["bank"] : ["card", "bank"]
            });
            return res.data.data;
        }
    } catch (err) {
        console.error("initiatePayment error:", err.response?.data || err.message);
        throw new Error(err.response?.data?.message || "Failed to initiate payment");
    }
};

export const verifyPayment = async (reference) => {
    try {
        const res = await paystack.get(`/transaction/verify/${reference}`);
        return res.data.data;
    } catch (err) {
        console.error("verifyPayment error:", err.response?.data || err.message);
        throw new Error("Payment verification failed");
    }
};

// ✅ Transfers (used for chef payouts)
export const createTransfer = async ({
    source = "balance",
    reason,
    amount,
    recipient,
    reference
}) => {
    try {
        const res = await paystack.post("/transfer", {
            source,
            reason,
            amount: Math.round(amount * 100), // pesewas
            recipient,
            reference
        });
        return res.data.data;
    } catch (err) {
        console.error("createTransfer error:", err.response?.data || err.message);
        throw new Error("Transfer failed");
    }
};

// ✅ Resolve bank account
export const resolveAccount = async (accountNumber, bankCode) => {
    try {
        const res = await paystack.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
        return res.data.data;
    } catch (err) {
        console.error("resolveAccount error:", err.response?.data || err.message);
        throw new Error("Account resolution failed");
    }
};

// ✅ Get list of Ghanaian banks
export const getBanks = async () => {
    try {
        const res = await paystack.get("/bank?country=ghana");
        return res.data.data;
    } catch (err) {
        console.error("getBanks error:", err.response?.data || err.message);
        throw new Error("Failed to fetch banks");
    }
};

// ✅ Create transfer recipient (for chef payouts)
export const createTransferRecipient = async ({
    name,
    account_number,
    bank_code,
    currency = "GHS"
}) => {
    try {
        const res = await paystack.post("/transferrecipient", {
            type: "bank_account", // enforce for Ghana
            name,
            account_number,
            bank_code,
            currency
        });
        return res.data.data;
    } catch (err) {
        console.error("createTransferRecipient error:", err.response?.data || err.message);
        throw new Error("Failed to create transfer recipient");
    }
};

// ✅ Verify transfer status
export const verifyTransfer = async (reference) => {
    try {
        const res = await paystack.get(`/transfer/verify/${reference}`);
        return res.data.data;
    } catch (err) {
        console.error("verifyTransfer error:", err.response?.data || err.message);
        throw new Error("Transfer verification failed");
    }
};



// import axios from "axios";

// const paystack = axios.create({
//     baseURL: "https://api.paystack.co",
//     headers: {
//         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         "Content-Type": "application/json"
//     }
// });

// /**
//  * Initiate a payment with subaccount support
//  */
// export const initiatePayment = async ({
//     email,
//     amount,
//     metadata,
//     method,
//     momo,
//     subaccount,
//     bearer = "subaccount"
// }) => {
//     const basePayload = {
//         email,
//         amount,
//         currency: "GHS",
//         metadata,
//         subaccount, // Add subaccount for split payments
//         bearer      // Who bears the transaction charge
//     };

//     if (method === "momo") {
//         const res = await paystack.post("/charge", {
//             ...basePayload,
//             mobile_money: {
//                 phone: momo.phone,
//                 provider: momo.provider
//             }
//         });
//         return res.data;
//     } else {
//         const res = await paystack.post("/transaction/initialize", {
//             ...basePayload,
//             channels: method === "bank" ? ["bank"] : ["card", "bank"]
//         });
//         return res.data;
//     }
// };

// export const verifyPayment = async (reference) => {
//     const res = await paystack.get(`/transaction/verify/${reference}`);
//     return res.data;
// };

// // ✅ Additional utility for creating transfers to chefs
// export const createTransfer = async ({
//     source = "balance",
//     reason,
//     amount,
//     recipient,
//     reference
// }) => {
//     const res = await paystack.post("/transfer", {
//         source,
//         reason,
//         amount: amount * 100, // Convert to kobo
//         recipient,
//         reference
//     });
//     return res.data;
// };

// // ✅ Utility to resolve bank account details
// export const resolveAccount = async (accountNumber, bankCode) => {
//     const res = await paystack.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
//     return res.data;
// };

// // Get list of banks for Ghana
// export const getBanks = async () => {
//     const res = await paystack.get("/bank?country=ghana");
//     return res.data;
// };

// // Create transfer recipient (for chef payouts)
// export const createTransferRecipient = async ({
//     type,
//     name,
//     account_number,
//     bank_code,
//     currency = "GHS"
// }) => {
//     const res = await paystack.post("/transferrecipient", {
//         type,
//         name,
//         account_number,
//         bank_code,
//         currency
//     });
//     return res.data;
// };

// // Verify transfer status
// export const verifyTransfer = async (reference) => {
//     const res = await paystack.get(`/transfer/verify/${reference}`);
//     return res.data;
// };