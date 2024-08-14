// app.ts
import MailService from "./emailService.js";
import BitrixService from "./bitrixService.js";
import dotenv from "dotenv";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import iconv from "iconv-lite";
import EmailService, { emailOutput } from "./emailService.js";

dotenv.config();

interface ImapConfig {
  imap: {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    authTimeout: number;
  };
}

const imapConfig: ImapConfig = {
  imap: {
    user: process.env.MAIL_USER || "",
    password: process.env.MAIL_PASSWORD || "",
    host: process.env.IMAP_HOST || "",
    port: parseInt(process.env.IMAP_PORT || "0", 10),
    tls: false,
    authTimeout: 3000,
  },
};

const smtpConfig: SMTPTransport.Options = {
  host: process.env.SMTP_HOST || "",
  port: parseInt(process.env.SMTP_PORT || "0", 10),
  secure: false,
  auth: {
    user: process.env.MAIL_USER || "",
    pass: process.env.MAIL_PASSWORD || "",
  },
};

const emailService = new EmailService(imapConfig, smtpConfig);
const bitrixService = new BitrixService();

// Где лучше sourse_id = 31
// VRN source_id = 32

const run = async () => {
  try {
    await emailService.connect();
    const emails = await emailService.fetchEmails("Заявка");
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      const idEmail = email.uid;
      const body = email.body;
      const from = email.from;

      if (from.includes("ISP")) {
        const parsedISP = await emailService.parseBodyEmailISP(body);
        const contact = await bitrixService.createContact(
          parsedISP.name,
          " ",
          " ",
          parsedISP.phone,
          parsedISP.address
        );
        console.log(contact);
        const deal = await bitrixService.createDeal(
          contact.result,
          32,
          parsedISP.address,
          parsedISP.comment,
          parsedISP.id
        );
        console.log(deal);
        await emailService.moveEmails(idEmail, "ready");
      } else if (from.includes("gdelu.ru")) {
        const decode = emailService.decoderBase64(body);
        const parsedGDELU = await emailService.parseBodyEmailGDELU(decode);
        const contact = await bitrixService.createContact(
          parsedGDELU.name,
          " ",
          " ",
          parsedGDELU.phone,
          parsedGDELU.address
        );
        console.log(contact);
        const deal = await bitrixService.createDeal(
          contact.result,
          31,
          parsedGDELU.address,
          parsedGDELU.comment,
          parsedGDELU.id
        );
        console.log(deal);
        await emailService.moveEmails(idEmail, "ready");
      }
    }
  } catch (error) {
    console.error(error);
  }
};
// Запускаем функцию каждые 5 минут
setInterval(run, 5 * 60 * 1000);
