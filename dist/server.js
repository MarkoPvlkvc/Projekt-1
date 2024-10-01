"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const postgres_1 = require("@vercel/postgres");
const dotenv_1 = __importDefault(require("dotenv"));
const qrcode_1 = __importDefault(require("qrcode"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = 3000;
const MAX_TICKETS_PER_OIB = 3;
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
const pool = (0, postgres_1.createPool)({
    connectionString: process.env.POSTGRES_URL,
});
app.get("/:uuid", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/ticketInfo.html"));
});
app.get("/", (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/index.html"));
});
function generateTicket(vatin, firstName, lastName) {
    return __awaiter(this, void 0, void 0, function* () {
        let generatedTicket;
        try {
            const result = yield pool.sql `
      INSERT INTO generatedtickets (vatin, firstname, lastname)
      VALUES (${vatin}, ${firstName}, ${lastName})
      RETURNING *;
    `;
            generatedTicket = result.rows[0];
            console.log("Ticket generated successfully:", generatedTicket);
        }
        catch (error) {
            console.log("Error generating ticket:", error);
        }
        return generatedTicket;
    });
}
function generateQRCode(generatedTicket) {
    return __awaiter(this, void 0, void 0, function* () {
        const baseUrl = "https://projekt-1-markopvlkvcs-projects.vercel.app/";
        const QRCodeData = JSON.stringify({
            url: `${baseUrl}/${generatedTicket.uuid}`,
        });
        const QRCodeImage = yield qrcode_1.default.toDataURL(QRCodeData);
        console.log("QR code generated successfully:");
        return QRCodeImage;
    });
}
app.get("/generate-ticket", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vatin, firstName, lastName } = req.body;
    if (!vatin || !firstName || !lastName) {
        res.status(400).send("Missing parameters in request body.");
        return;
    }
    try {
        const result = yield pool.sql `SELECT COUNT(*) FROM generatedtickets WHERE vatin = ${vatin}`;
        const count = parseInt(result.rows[0].count);
        if (count >= MAX_TICKETS_PER_OIB) {
            res
                .status(400)
                .send(`OIB has already been used to generate the maximum (${MAX_TICKETS_PER_OIB}) number of tickets.`);
            return;
        }
        const generatedTicket = yield generateTicket(vatin, firstName, lastName);
        if (!generatedTicket) {
            res.status(500).send("Error generating ticket.");
            return;
        }
        const QRCodeImage = yield generateQRCode(generatedTicket);
        res.status(200).json({
            message: "Ticket generated successfully.",
            QRCodeImage,
        });
    }
    catch (error) {
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
}));
app.get("/api/tickets/count", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield pool.sql `SELECT COUNT(*) FROM generatedtickets`;
        const count = parseInt(result.rows[0].count);
        res.status(200).send(count.toString());
    }
    catch (error) {
        console.log("Error querying database:", error);
        res.status(500).send("Error querying database.");
    }
}));
app.get("/api/tickets/:uuid", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uuid } = req.params;
    try {
        const result = yield pool.sql `
      SELECT * FROM generatedtickets WHERE id = ${uuid};
    `;
        const ticket = result.rows[0];
        if (!ticket) {
            res.status(404).send("Ticket not found.");
            return;
        }
        res.status(200).json(ticket);
    }
    catch (error) {
        console.log("Error querying database:", error);
        res.status(500).send("Error querying database.");
    }
}));
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
