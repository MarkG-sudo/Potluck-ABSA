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

        // 🧾 Log comprehensive payment info
        console.log(`🔸 Initiating payment`);
        console.log(`   Email: ${email}`);
        console.log(`   Amount: GHS ${amount} → ${scaledAmount} pesewas`);
        console.log(`   Method: ${method}`);
        console.log(`   Subaccount: ${subaccount || "None"}`);
        console.log(`   Bearer: ${bearer}`);
        console.log(`   Metadata:`, metadata);

        // ✅ Validate subaccount format if provided
        if (subaccount && !subaccount.startsWith('ACCT_')) {
            console.warn(`⚠️  Subaccount code format may be invalid: ${subaccount}`);
        }

        const basePayload = {
            email,
            amount: scaledAmount,
            currency: "GHS",
            metadata, // This will now include momo_provider for momo payments
            subaccount,
            bearer,
        };

        let res;
        if (method === "momo") {
            if (!momo?.phone || !momo?.provider) {
                throw new Error("Mobile money payment requires phone and provider");
            }

            console.log(`📱 Initializing Mobile Money transaction`);
            console.log(`   Phone: ${momo.phone}`);
            console.log(`   Provider: ${momo.provider}`);
            console.log(`   Endpoint: /transaction/initialize`);

            // ✅ FIXED: Use /transaction/initialize and add provider to metadata
            res = await paystack.post("/transaction/initialize", {
                ...basePayload,
                channels: ["mobile_money"],
                metadata: {
                    ...metadata,
                    momo_provider: momo.provider // Track provider in metadata
                },
            });
        } else {
            const channels = method === "bank" ? ["bank"] : ["card", "bank"];
            console.log(`💳 Initializing card/bank transaction`);
            console.log(`   Channels: ${channels.join(', ')}`);
            console.log(`   Endpoint: /transaction/initialize`);

            res = await paystack.post("/transaction/initialize", {
                ...basePayload,
                channels: channels,
            });
        }

        console.log(`✅ Paystack response received`);
        console.log(`   Status: ${res.data.status}`);
        console.log(`   Message: ${res.data.message}`);
        console.log(`   Reference: ${res.data.data?.reference}`);

        if (res.data.data?.authorization_url) {
            console.log(`   Authorization URL: Present (length: ${res.data.data.authorization_url.length})`);
        } else {
            console.log(`   Authorization URL: Missing - this may cause issues`);
        }

        return res.data;
    } catch (err) {
        console.error(`   Error Message: ${err.message}`);
        console.error(`   HTTP Status: ${err.response?.status}`);
        console.error(`   Paystack Error: ${JSON.stringify(err.response?.data)}`);
        console.error(`   Request Data:`, err.config?.data);

        throw new Error(err.response?.data?.message || "Failed to initiate payment");
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
