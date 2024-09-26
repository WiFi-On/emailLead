// app.ts
import BitrixService from "./bitrixService.js";
import EmailService, { emailOutput } from "./emailService.js";
import dotenv from "dotenv";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import logger from "./logger.js"; // Импортируйте логгер

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
    port: parseInt(process.env.IMAP_PORT || "993", 10),
    tls: true, // Используем TLS
    authTimeout: 10000,
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

const run = async () => {
  try {
    logger.info("Запуск обработки писем...");
    await emailService.connect();
    const emails = await emailService.fetchEmails("Заявка");

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const idEmail = email.uid;
      const body = email.body;
      const from = email.from;

      if (from.includes("ISP <no-reply@isp-vrn.ru>")) {
        const parsedISP = await emailService.parseBodyEmailISP(body);
        logger.info(`Спарсил письмо от ISP: ${parsedISP.id}`);
        const contact = await bitrixService.createContact(
          parsedISP.name,
          " ",
          " ",
          parsedISP.phone,
          parsedISP.address
        );
        logger.info(`Создал контакт: ${contact.result}`);
        const deal = await bitrixService.createDeal(
          contact.result,
          32,
          parsedISP.address,
          parsedISP.comment,
          parsedISP.id
        );
        logger.info(`Создал сделку: ${deal.result}`);
        await emailService.moveEmails(idEmail, "ready");
        logger.info(`Обработано письмо от ISP: ${parsedISP.id}`);
      } else if (from.includes("Л, Алёна <vo@isp-vrn.ru>")) {
        const parsedBodyToText = await emailService.parseBodyToText(body);
        logger.info(
          `Спарсил из body в текст от Алена(ISP): ${parsedBodyToText}`
        );
        const parsedISP = await emailService.parseBodyEmailISP(
          parsedBodyToText
        );
        logger.info(`Спарсил письмо от Алена(ISP): ${parsedISP.id}`);
        const contact = await bitrixService.createContact(
          parsedISP.name,
          " ",
          " ",
          parsedISP.phone,
          parsedISP.address
        );
        logger.info(`Создал контакт: ${contact.result}`);
        const deal = await bitrixService.createDeal(
          contact.result,
          35,
          parsedISP.address,
          parsedISP.comment,
          parsedISP.id
        );
        logger.info(`Создал сделку: ${deal.result}`);
        await emailService.moveEmails(idEmail, "ready");
        logger.info(`Обработано письмо от Алена(ISP): ${parsedISP.id}`);
      } else if (from.includes("gdelu.ru")) {
        const decode = await emailService.decoderBase64(body);
        logger.info(`Декодировал письмо от gdelu: ${decode}`);
        const parsedGDELU = await emailService.parseBodyEmailGDELU(decode);
        logger.info(`Спарсил письмо от gdelu: ${parsedGDELU.id}`);
        const contact = await bitrixService.createContact(
          parsedGDELU.name,
          " ",
          " ",
          parsedGDELU.phone,
          parsedGDELU.address
        );
        logger.info(`Создал контакт: ${contact.result}`);
        const deal = await bitrixService.createDeal(
          contact.result,
          31,
          parsedGDELU.address,
          parsedGDELU.comment,
          parsedGDELU.id
        );
        logger.info(`Создал сделку: ${deal.result}`);
        await emailService.moveEmails(idEmail, "ready");
        logger.info(`Обработано письмо от gdelu: ${parsedGDELU.id}`);
      }
    }
  } catch (error) {
    logger.error(`Ошибка при обработке писем: ${error}`);
  }
};

setInterval(run, 2 * 60 * 1000);
