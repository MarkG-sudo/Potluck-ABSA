import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY); // Store your API key securely

export const sendEmail = async ({ to, subject, html }) => {
    try {
        const msg = {
            to,
            from: {
                email: process.env.SMTP_FROM_EMAIL, // e.g. "noreply@potchef.com"
                name: process.env.SMTP_FROM_NAME 
            },
            subject,
            html,
        };

        await sgMail.send(msg);
        console.log(`📧 Email sent to ${to}`);
    } catch (error) {
        console.error("❌ SendGrid email error:", error.response?.body || error.message);
        throw new Error("Failed to send email");
    }
};






// import { createTransport } from "nodemailer";

// export const mailtransporter = createTransport({
//     host: 'smtp.gmail.com',
//     port: 465,
//     secure: true,
//     auth: {
//         user: 'gidodoom@gmail.com',
//         pass: process.env.MAIL_PASS_KEY
//     },



// })