import path from "path";
import express, { Request, Response } from "express";
import { createPool } from "@vercel/postgres";
import dotenv from "dotenv";
import QRCode from "qrcode";

dotenv.config();
const app = express();

const PORT = 3000;
const MAX_TICKETS_PER_OIB = 3;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const pool = createPool({
  connectionString: process.env.POSTGRES_URL,
});

app.get("/:uuid", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public/ticketInfo.html"));
});

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

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

  const QRCodeImage = await QRCode.toDataURL(QRCodeData);

  console.log("QR code generated successfully:");

  return QRCodeImage;
}

app.get("/api/tickets/generate", async (req, res) => {
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

    res.status(200).json({
      message: "Ticket generated successfully.",
      QRCodeImage,
    });
  } catch (error) {
    res.status(500).send("Error querying database.");
  }

  // rezultat uspješnog poziva je QR kod koji sadrži url na stranici s UUID / identifikatorom ulaznice
  // u urlu smije biti samo identifikator ulaznice

  // pristupna točka mora koristiti autorizacijski mehanizam OAuth2 Client Credentials (machine-to-machine)
  // nije vezan za konkretnog korisnika, već za pojedinu aplikaciju.
  // (https://auth0.com/blog/using-m2m-authorization)
  // (https://www.rfc-editor.org/rfc/rfc6749#section-1.3.1)

  // url koji sadrži identifikator ulaznice prikazuje podatke ulaznice (vatin/OIB, ime, prezime i vrijeme nastanka ulaznice)
  // pristup toj stranici imaju samo prijavljeni korisnici
  // na stranici ispisati ime trenutno prijavljenog korisnika koristeći OpenId Connect protokol

  /*
    Upravljanje korisnicima odvija se korištenjem protokola OAuth2 i OpenId Connect (OIDC) i servisa Auth0.
    Korisnike na servisu Auth0 možete dodati kroz opciju User management/Users na Auth0.
    Za pohranu podataka koristiti PostgreSQL na Renderu ili neku drugu bazu podataka po izboru (npr. Firebase).
  */
});

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

app.get("/api/tickets/:uuid", async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
