/**
  App Dev Club People Portal Server
  Copyright (C) 2025  Atheesh Thirumalairajan

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import nodemailer, { Transporter } from "nodemailer";
import hbs, { TemplateOptions } from "nodemailer-express-handlebars";
import path from "path";
import { EmailSendRequest } from "./models";
import { Options as NodemailerOptions } from "nodemailer/lib/mailer";

type MailTemplateOptions = NodemailerOptions & TemplateOptions
export class EmailClient {
    private transporter: Transporter;
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.PEOPLEPORTAL_SMTP_HOST,
            port: Number(process.env.PEOPLEPORTAL_SMTP_PORT),
            secure: process.env.PEOPLEPORTAL_SMTP_SECURE === "true",
            auth: {
                user: process.env.PEOPLEPORTAL_SMTP_USER,
                pass: process.env.PEOPLEPORTAL_SMTP_PASS,
            },
        });

        /* Setup Templating Engine */
        this.transporter.use(
            "compile",
            hbs({
                extName: '.hbs',
                viewPath: path.resolve(__dirname, "templates"),
                viewEngine: {
                    extname: ".hbs",
                    partialsDir: path.resolve(__dirname, "templates"),
                    defaultLayout: false,
                },
            })
        );
    }

    async send(request: EmailSendRequest) {
        try {
            return await this.transporter.sendMail({
                from: request.from ?? process.env.PEOPLEPORTAL_SMTP_USER,
                to: request.to,
                cc: request.cc,
                bcc: request.bcc,
                subject: request.subject,
                template: request.templateName,
                context: request.templateVars,
                replyTo: request.replyTo,
            } as MailTemplateOptions);
        } catch (e) {
            console.error(e)
            throw e
        }
    }
}