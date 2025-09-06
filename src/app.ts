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
import swaggerUi from "swagger-ui-express";
import { ValidateError } from "tsoa";
import bodyParser from "body-parser";
import mongoose from "mongoose";

const app = express();
const PORT = process.env.PORT || 3000;

dotenv.config()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

/* Register TSOA Routes */
const ApiRouter = Router()
ApiRouter.use("/api/docs", swaggerUi.serve, async (req: Request, res: Response) => {
  return res.send(swaggerUi.generateHTML(await import("../dist/swagger.json")))
})

/* Register & Setup Catch All Route for Public Dir */
RegisterRoutes(ApiRouter);
app.use(ApiRouter);
app.get("*splat", (req, res) => {
  res.send("CATCHALL")
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
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }

  next();
});

app.listen(PORT, async () => {
  await mongoose.connect(process.env.PEOPLEPORTAL_MONGO_URL!)
  console.log(`Server running at http://localhost:${PORT}`);
});
