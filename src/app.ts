/**
  People Portal Server
  Copyright (C) 2026  Atheesh Thirumalairajan

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

/* Configure ENV Variables before other imports */
import dotenv from 'dotenv'
dotenv.config()

import express, { Router, Request, Response, NextFunction } from "express"
import cors from "cors"
import { RegisterRoutes } from "./routes";
import { apiReference } from '@scalar/express-api-reference'
import { ValidateError } from "tsoa";
import mongoose from "mongoose";
import { OpenIdClient } from "./clients/OpenIdClient";
import expressSession from 'express-session'
import { generateSecureRandomString } from "./utils/strings";
import path from "path";
import { NativeExpressOIDCAuthPort } from "./auth";
import { AuthentikClient } from "./clients/AuthentikClient";
import { CustomValidationError, ResourceAccessError } from "./utils/errors";
import { ENABLED_SHARED_RESOURCES } from "./config";
import log from 'loglevel';

log.setLevel("info")

if (!process.env.PEOPLEPORTAL_TOKEN_SECRET)
  process.env.PEOPLEPORTAL_TOKEN_SECRET = generateSecureRandomString(16)

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.set('trust proxy', 1);
app.use(
  expressSession({
    name: 'peopleportal_sid',
    secret: process.env.PEOPLEPORTAL_TOKEN_SECRET,
    resave: false,
    saveUninitialized: true,
    store: new expressSession.MemoryStore(), /* Use Redis for Horizontal Scaling */
    proxy: true,
    cookie: {
      partitioned: true,
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    }
  })
);

app.use((req, res, next) => {
  console.log('--- SESSION SPY ---');
  console.log(`Request: ${req.method} ${req.url}`);

  // 1. Did the browser send a cookie?
  const cookieHeader = req.headers.cookie;
  console.log('1. Cookie Header Received:', cookieHeader ? 'YES' : 'NO (Browser blocked it)');

  // 2. What is the Session ID?
  console.log('2. Session ID:', req.sessionID);

  // 3. Is the session new or old?
  // If this says 'true' on the callback, the old session is dead.
  // @ts-ignore
  console.log('3. Is New Session?:', req.session?.isNew || 'Unknown');

  // 4. What data is actually inside?
  console.log('4. Session Data:', Object.keys(req.session || {}));
  console.log('-------------------');
  next();
});

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
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ValidateError) {
    console.warn(`Caught Validation Error for ${req.path}:`, err.fields);
    return res.status(422).json({
      message: "Validation Failed",
      details: err?.fields
    });
  }

  if (err instanceof ResourceAccessError || err instanceof CustomValidationError) {
    return res.status(err.status).json({
      message: err.message,
    });
  }

  if (err instanceof Error) {
    console.error(err)
    return res.status(500).json({
      message: err.message ?? "Unknown Internal Server Error",
    });
  }

  next();
});

app.listen(PORT, async () => {
  /* Validate Connections */
  await OpenIdClient.init()
  //await AuthentikClient.validateAuthentikConnection()

  /* Validate Service Team Creation */
  const authentikClient = new AuthentikClient()
  //await authentikClient.validateServiceExistance()

  /* Initialize Shared Resource Clients */
  for (const client in ENABLED_SHARED_RESOURCES) {
    console.log(`Initializing Shared Resource Client: ${client}`)
    const clientInstance = ENABLED_SHARED_RESOURCES[client]!;
    await clientInstance.init()
  }

  /* Validate Database Connection */
  await mongoose.connect(process.env.PEOPLEPORTAL_MONGO_URL!)
  console.log(`Server running at http://localhost:${PORT}`);
});
