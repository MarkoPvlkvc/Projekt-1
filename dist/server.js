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
const express_oauth2_jwt_bearer_1 = require("express-oauth2-jwt-bearer");
const express_openid_connect_1 = require("express-openid-connect");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = 3000;
const MAX_TICKETS_PER_OIB = 3;
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
const pool = (0, postgres_1.createPool)({
    connectionString: process.env.POSTGRES_URL,
});
const checkJwt = (0, express_oauth2_jwt_bearer_1.auth)({
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
app.use((0, express_openid_connect_1.auth)(config));
app.get("/:uuid", (0, express_openid_connect_1.requiresAuth)(), (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return;
    }
    res.sendFile(path_1.default.join(__dirname, "../public/ticketInfo.html"));
});
app.get("/", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/index.html"));
});
/* app.get("/callback", (req: Request, res: Response) => {
  const state = req.query.state;

  if (state) {
    const redirectUrl = decodeURIComponent(state.toString());
    return res.redirect(redirectUrl);
  }
}); */
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
            url: `${baseUrl}/${generatedTicket.id}`,
        });
        const QRCodeImage = yield qrcode_1.default.toBuffer(QRCodeData);
        console.log("QR code generated successfully:");
        return QRCodeImage;
    });
}
app.get("/api/tickets/generate", checkJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        res.setHeader("Content-Type", "image/png");
        res.status(200).send(QRCodeImage);
    }
    catch (error) {
        res.status(500).send("Error querying database.");
    }
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
app.get("/api/user", (0, express_openid_connect_1.requiresAuth)(), (req, res) => {
    var _a;
    if (!req.oidc.isAuthenticated()) {
        return;
    }
    const safeUserInfo = {
        email: (_a = req.oidc.user) === null || _a === void 0 ? void 0 : _a.email,
    };
    res.json(safeUserInfo);
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
