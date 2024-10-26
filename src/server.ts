import path from "path";
import express, { Request, Response } from "express";
import { createPool } from "@vercel/postgres";
import dotenv from "dotenv";
import QRCode from "qrcode";
import { auth, requiredScopes } from "express-oauth2-jwt-bearer";
import { auth as authOIDC, requiresAuth } from "express-openid-connect";

dotenv.config();
const app = express();

const PORT = 3000;
const MAX_TICKETS_PER_OIB = 3;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const pool = createPool({
  connectionString: process.env.POSTGRES_URL,
});

const checkJwt = auth({
  audience: process.env.AUTH0_API_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_API_DOMAIN}/`,
});

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_API_OIDC_SECRET,
  baseURL: "https://projekt-1-markopvlkvcs-projects.vercel.app",
  clientID: "O31X4XFmVwQvazPC8UyBoUr10xCPoOLZ",
  issuerBaseURL: "https://dev-g2pnzcqpdat4wh2s.eu.auth0.com",
};

app.use(authOIDC(config));

app.get("/:uuid", requiresAuth(), (req: Request, res: Response) => {
  if (!req.oidc.isAuthenticated()) {
    return;
  }

  res.sendFile(path.join(__dirname, "../public/ticketInfo.html"));
});

app.get("/", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* app.get("/callback", (req: Request, res: Response) => {
  const state = req.query.state;

  if (state) {
    const redirectUrl = decodeURIComponent(state.toString());
    return res.redirect(redirectUrl);
  }
}); */

async function generateTicket(
  vatin: number,
  firstName: string,
  lastName: string
) {
  let generatedTicket;

  try {
    const result = await pool.sql`
      INSERT INTO generatedtickets (vatin, firstname, lastname)
      VALUES (${vatin}, ${firstName}, ${lastName})
      RETURNING *;
    `;

    generatedTicket = result.rows[0];

    console.log("Ticket generated successfully:", generatedTicket);
  } catch (error) {
    console.log("Error generating ticket:", error);
  }

  return generatedTicket;
}

interface Ticket {
  id: string;
  vatin: number;
  firstName: string;
  lastName: string;
  createdAt: Date;
}

async function generateQRCode(generatedTicket: Ticket) {
  const baseUrl = "https://projekt-1-markopvlkvcs-projects.vercel.app/";

  const QRCodeData = JSON.stringify({
    url: `${baseUrl}/${generatedTicket.id}`,
  });

  const QRCodeImage = await QRCode.toBuffer(QRCodeData);

  console.log("QR code generated successfully:");

  return QRCodeImage;
}

app.get(
  "/api/tickets/generate",
  checkJwt,
  async (req: Request, res: Response) => {
    const { vatin, firstName, lastName } = req.body;

    if (!vatin || !firstName || !lastName) {
      res.status(400).send("Missing parameters in request body.");
      return;
    }

    try {
      const result =
        await pool.sql`SELECT COUNT(*) FROM generatedtickets WHERE vatin = ${vatin}`;
      const count = parseInt(result.rows[0].count);

      if (count >= MAX_TICKETS_PER_OIB) {
        res
          .status(400)
          .send(
            `OIB has already been used to generate the maximum (${MAX_TICKETS_PER_OIB}) number of tickets.`
          );
        return;
      }

      const generatedTicket = await generateTicket(vatin, firstName, lastName);

      if (!generatedTicket) {
        res.status(500).send("Error generating ticket.");
        return;
      }

      const QRCodeImage = await generateQRCode(generatedTicket as Ticket);

      res.setHeader("Content-Type", "image/png");
      res.status(200).send(QRCodeImage);
    } catch (error) {
      res.status(500).send("Error querying database.");
    }
  }
);

app.get("/api/tickets/count", async (_req: Request, res: Response) => {
  try {
    const result = await pool.sql`SELECT COUNT(*) FROM generatedtickets`;
    const count = parseInt(result.rows[0].count);

    res.status(200).send(count.toString());
  } catch (error) {
    console.log("Error querying database:", error);
    res.status(500).send("Error querying database.");
  }
});

app.get("/api/tickets/:uuid", async (req: Request, res: Response) => {
  const { uuid } = req.params;

  try {
    const result = await pool.sql`
      SELECT * FROM generatedtickets WHERE id = ${uuid};
    `;

    const ticket = result.rows[0];

    if (!ticket) {
      res.status(404).send("Ticket not found.");
      return;
    }

    res.status(200).json(ticket);
  } catch (error) {
    console.log("Error querying database:", error);
    res.status(500).send("Error querying database.");
  }
});

app.get("/api/user", requiresAuth(), (req: Request, res: Response) => {
  if (!req.oidc.isAuthenticated()) {
    return;
  }

  const safeUserInfo = {
    email: req.oidc.user?.email,
  };

  res.json(safeUserInfo);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
