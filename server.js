
const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let sessions = new Map();

function getSession(req) {
    const id = req.headers["x-session-id"] || "default";
    return sessions.get(id);
}

// Welcome website
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Get connection status and QR
app.get("/api/connection", (req, res) => {
    const session = getSession(req);

    if (!session) {
        return res.json({
            status: "DISCONNECTED",
            qr: null,
            pairingCode: null
        });
    }

    res.json({
        status: session.connectionStatus || "DISCONNECTED",
        qr: session.qrCode || null,
        pairingCode: session.pairingCode || null
    });
});

// Request pairing code
app.post("/api/connect/pairing", async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                error: "Phone number is required"
            });
        }

        const session = getSession(req);

        if (!session || !session.sock) {
            return res.status(400).json({
                error: "WhatsApp session is not initialized"
            });
        }

        if (session.connectionStatus === "CONNECTED") {
            return res.status(400).json({
                error: "WhatsApp is already connected"
            });
        }

        const number = String(phone).replace(/\D/g, "");

        if (number.length < 8 || number.length > 15) {
            return res.status(400).json({
                error: "Invalid phone number"
            });
        }

        const code = await session.sock.requestPairingCode(number);

        session.pairingCode = code;

        res.json({
            success: true,
            pairingCode: code
        });

    } catch (error) {
        console.error("PAIRING ERROR:", error);

        res.status(500).json({
            error: "Could not generate pairing code"
        });
    }
});

// Register a Baileys session
app.post("/api/internal/register-session", (req, res) => {
    const { sessionId, sessionData } = req.body;

    if (!sessionId || !sessionData) {
        return res.status(400).json({
            error: "Missing session information"
        });
    }

    sessions.set(sessionId, sessionData);

    res.json({ success: true });
});

// Remove a session
app.delete("/api/internal/session/:id", (req, res) => {
    sessions.delete(req.params.id);

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`SUDDA-MD server running on port ${PORT}`);
});
