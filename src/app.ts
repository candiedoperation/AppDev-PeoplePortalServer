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

import express, { Router, Request, Response, NextFunction } from "express"
import cors from "cors"
import dotenv from 'dotenv'
import { RegisterRoutes } from "./routes";
import { apiReference } from '@scalar/express-api-reference'
import { ValidateError } from "tsoa";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { OpenIdClient } from "./clients/OpenIdClient";
import expressSession from 'express-session'
import { generateSecureRandomString } from "./utils/strings";
import path from "path";
import { NativeExpressOIDCAuthPort } from "./auth";
import { AuthentikClient } from "./clients/AuthentikClient";

if (!process.env.PEOPLEPORTAL_TOKEN_SECRET)
  process.env.PEOPLEPORTAL_TOKEN_SECRET = generateSecureRandomString(16)

const app = express();
const PORT = process.env.PORT || 3000;

dotenv.config()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(
  expressSession({
    secret: process.env.PEOPLEPORTAL_TOKEN_SECRET,
    resave: false,
    saveUninitialized: true,
    store: new expressSession.MemoryStore() /* Use Redis for Horizontal Scaling */
  })
);

/* Register TSOA Routes */
const ApiRouter = Router()
ApiRouter.get("/api/docs/swagger.json", async (req, res) => {
  const doc = await import("../dist/swagger.json");
  res.json(doc.default || doc);
});

/* Enable Documentation A */
ApiRouter.use("/api/docs", apiReference({
  spec: {
    url: "/api/docs/swagger.json",
  },

  metaData: {
    title: "People Portal Server API Reference",
  },

  favicon: '/logo.svg',
  showDeveloperTools: "never",
  theme: "kepler",
  hideClientButton: true,
  customCss: `
    a[href="https://www.scalar.com"] {
      display: none;
    }

    div.flex-col:nth-child(4) > div:nth-child(1)::before {
      content: "© 2026 Atheesh Thirumalairajan";
      font-size: small;
      color: var(--scalar-color-3);
    }
  `,

  authentication: {
    /* Must Match Generated OpenAPI Spec from tsoa.json */
    preferredSecurityScheme: 'OIDC Bindle Shim',
  },
}));

/* Register & Setup Catch All Route for Public Dir */
RegisterRoutes(ApiRouter);
app.use(ApiRouter);

app.get(["/onboard", "/onboard/*splat"], (req, res) => {
  res.sendFile(path.join(__dirname, "ui", "index.html"))
})

app.get(["/apply", "/apply/*splat"], (req, res) => {
  res.sendFile(path.join(__dirname, "ui", "index.html"))
})

app.use(express.static(path.join(__dirname, "ui"), { index: false }))

app.get("*splat", NativeExpressOIDCAuthPort, (req, res) => {
  res.sendFile(path.join(__dirname, "ui", "index.html"))
})

app.use(function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  if (err instanceof ValidateError) {
    console.warn(`Caught Validation Error for ${req.path}:`, err.fields);
    return res.status(422).json({
      message: "Validation Failed",
      details: err?.fields
    });
  }

  if (err instanceof Error) {
    console.error(err)
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }

  next();
});

app.listen(PORT, async () => {
  /* Validate Connections */
  await OpenIdClient.init()
  await AuthentikClient.validateAuthentikConnection()
  await mongoose.connect(process.env.PEOPLEPORTAL_MONGO_URL!)
  console.log(`Server running at http://localhost:${PORT}`);
});
