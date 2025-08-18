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

import express, { Router, Request, Response } from "express"
import cors from "cors"
import dotenv from 'dotenv'
import { RegisterRoutes } from "./routes";
import swaggerUi from "swagger-ui-express";

const app = express();
const PORT = process.env.PORT || 3000;

dotenv.config()
//app.use(express.urlencoded({ extended: true }))

app.use(cors({
  origin: '*'
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
