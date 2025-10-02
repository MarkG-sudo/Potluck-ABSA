import axios from "axios";

const paystack = axios.create({
    baseURL: "https://api.paystack.co",
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
    }
});


// ✅ Initiate payment
export const initiatePayment = async ({
    email,
    amount,
    metadata,
    method,
    momo,
    subaccount,
    bearer = "subaccount"
}) => {
    if (!email) throw new Error("Customer email is required");
    if (!amount || amount <= 0) throw new Error("Amount must be greater than 0");

    try {
        const scaledAmount = Math.round(amount * 100); // Convert GHS to pesewas
        const basePayload = {
            email,
            amount: scaledAmount,
            currency: "GHS",
            metadata,
            ...(subaccount ? { subaccount, bearer } : {})
        };

        let res;

        if (method === "momo") {
            if (!momo?.phone || !momo?.provider) {
                throw new Error("Mobile money payment requires phone and provider");
            }

            console.log(`📱 Mobile Money via /charge`);
            res = await paystack.post("/charge", {
                ...basePayload,
                mobile_money: {
                    phone: momo.phone,
                    provider: momo.provider
                }
            });

            const { reference, status, display_text } = res.data.data || {};

            console.log(`🔁 Charge Response: ${status}`);
            console.log(`📄 Display Text: ${display_text}`);
            console.log(`🔗 Reference: ${reference}`);

            if (status === "pay_offline") {
                // MTN, AirtelTigo — wait for webhook
                console.log(`📲 Offline authorization required. Show this to customer: ${display_text}`);

                // Schedule verification fallback after 180s
                setTimeout(() => verifyPayment(reference), 180000);
            }

            else if (status === "send_otp") {
                // Vodafone — collect voucher and submit OTP
                console.log(`📟 Vodafone flow. Prompt customer to dial USSD: ${display_text}`);
                // Store reference and prompt for voucher input
                // Later: call submitOtp(reference, voucherCode)
            }

            else if (status === "pending") {
                console.log(`⏳ Transaction pending. Will require manual verification`);
                setTimeout(() => verifyPayment(reference), 180000);
            }

        } else {
            const channels = method === "bank" ? ["bank"] : ["card", "bank"];
            console.log(`💳 Card/Bank via /transaction/initialize`);
            res = await paystack.post("/transaction/initialize", {
                ...basePayload,
                channels
            });
        }

        return res.data;
    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        console.error(`📡 HTTP Status: ${err.response?.status}`);
        console.error(`🧾 Paystack Error: ${JSON.stringify(err.response?.data)}`);
        throw {
            status: err.response?.status || 500,
            message: err.response?.data?.message || err.message,
            details: err.response?.data
        };
    }
};


export const submitOtp = async (reference, voucherCode) => {
    try {
        const res = await paystack.post("/charge/submit_otp", {
            reference,
            otp: voucherCode
        });

        console.log(`✅ OTP submitted for ${reference}`);
        console.log(`📄 Gateway Response: ${res.data.data?.gateway_response}`);
        return res.data;
    } catch (err) {
        console.error(`❌ OTP submission failed: ${err.message}`);
        throw new Error("OTP submission failed");
    }
};


// ✅ Verify payment
export const verifyPayment = async (reference) => {
    try {
        const res = await paystack.get(`/transaction/verify/${reference}`);
        const verified = res.data;

        if (verified?.data?.currency !== "GHS") {
            throw new Error(`Invalid currency: expected GHS, got ${verified?.data?.currency}`);
        }

        return verified; // ✅ consistent: status, message, data
    } catch (err) {
        console.error("verifyPayment error:", err.response?.data || err.message);
        throw new Error("Payment verification failed");
    }
};


// ✅ Transfers (chef payouts)
export const createTransfer = async ({ source = "balance", reason, amount, recipient, reference }) => {
    try {
        const res = await paystack.post("/transfer", {
            source,
            reason,
            amount: Math.round(amount * 100), // GHS → pesewas
            recipient,
            reference
        });
        return res.data; // ✅ full response
    } catch (err) {
        console.error("createTransfer error:", err.response?.data || err.message);
        throw new Error("Transfer failed");
    }
};


// ✅ Resolve bank account
export const resolveAccount = async (accountNumber, bankCode) => {
    try {
        const res = await paystack.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
        return res.data; // ✅ full response
    } catch (err) {
        console.error("resolveAccount error:", err.response?.data || err.message);
        throw new Error("Account resolution failed");
    }
};


// ✅ Get list of Ghanaian banks
export const getBanks = async () => {
    try {
        const res = await paystack.get("/bank?country=ghana");
        return res.data; // ✅ full response
    } catch (err) {
        console.error("getBanks error:", err.response?.data || err.message);
        throw new Error("Failed to fetch banks");
    }
};


// ✅ Create transfer recipient (for chef payouts)
export const createTransferRecipient = async ({ name, account_number, bank_code, currency = "GHS" }) => {
    try {
        const res = await paystack.post("/transferrecipient", {
            type: "bank_account", // enforce for Ghana
            name,
            account_number,
            bank_code,
            currency
        });
        return res.data; // ✅ full response
    } catch (err) {
        console.error("createTransferRecipient error:", err.response?.data || err.message);
        throw new Error("Failed to create transfer recipient");
    }
};


// ✅ Verify transfer status
export const verifyTransfer = async (reference) => {
    try {
        const res = await paystack.get(`/transfer/verify/${reference}`);
        return res.data; // ✅ full response
    } catch (err) {
        console.error("verifyTransfer error:", err.response?.data || err.message);
        throw new Error("Transfer verification failed");
    }
};
