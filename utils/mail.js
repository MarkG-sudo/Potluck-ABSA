import { createTransport } from "nodemailer";

export const mailtransporter = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'gidodoom@gmail.com',
        pass: process.env.MAIL_PASS_KEY
    },



})