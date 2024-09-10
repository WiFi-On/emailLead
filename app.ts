// app.ts
import BitrixService from "./bitrixService.js";
import EmailService, { emailOutput } from "./emailService.js";

import dotenv from "dotenv";
import SMTPTransport from "nodemailer/lib/smtp-transport";

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
// Алена source_id = 35

const run = async () => {
  try {
    // Подключение к почтовому сервису
    await emailService.connect();
    // Получение писем у которых в тебе есть слово "Заявка"
    const emails = await emailService.fetchEmails("Заявка");

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      const idEmail = email.uid;
      const body = email.body;
      const from = email.from;

      // Обработка писем от ISP, Алены и gdelu.ru
      if (from.includes("ISP <no-reply@isp-vrn.ru>")) {
        // Парсинг тела письма
        const parsedISP = await emailService.parseBodyEmailISP(body);
        // Создание контакта
        const contact = await bitrixService.createContact(
          parsedISP.name,
          " ",
          " ",
          parsedISP.phone,
          parsedISP.address
        );
        // Создание сделки
        const deal = await bitrixService.createDeal(
          contact.result,
          32,
          parsedISP.address,
          parsedISP.comment,
          parsedISP.id
        );
        // Перемещение письма в "ready"
        await emailService.moveEmails(idEmail, "ready");
      } else if (from.includes("Л, Алёна <vo@isp-vrn.ru>")) {
        // Парсинг тела письма
        const parsedBodyToText = await emailService.parseBodyToText(body);
        const parsedISP = await emailService.parseBodyEmailISP(
          parsedBodyToText
        );
        // Создание контакта
        const contact = await bitrixService.createContact(
          parsedISP.name,
          " ",
          " ",
          parsedISP.phone,
          parsedISP.address
        );
        // Создание сделки
        const deal = await bitrixService.createDeal(
          contact.result,
          35,
          parsedISP.address,
          parsedISP.comment,
          parsedISP.id
        );
        // Перемещение письма в "ready"
        await emailService.moveEmails(idEmail, "ready");
      } else if (from.includes("gdelu.ru")) {
        // Декодирование из base64
        const decode = await emailService.decoderBase64(body);
        // Парсинг тела письма
        const parsedGDELU = await emailService.parseBodyEmailGDELU(decode);
        // Создание контакта
        const contact = await bitrixService.createContact(
          parsedGDELU.name,
          " ",
          " ",
          parsedGDELU.phone,
          parsedGDELU.address
        );
        // Создание сделки
        const deal = await bitrixService.createDeal(
          contact.result,
          31,
          parsedGDELU.address,
          parsedGDELU.comment,
          parsedGDELU.id
        );
        // Перемещение письма в "ready"
        await emailService.moveEmails(idEmail, "ready");
      }
    }
  } catch (error) {
    console.error(error);
  }
};

// Запускаем функцию каждые 5 минут
setInterval(run, 5 * 60 * 1000);
