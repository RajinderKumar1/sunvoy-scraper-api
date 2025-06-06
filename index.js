const https = require("https");
const fs = require("fs");
const path = require("path");
class SunvoyAPI {
    constructor() {
        this.baseURL = "https://challenge.sunvoy.com";
        this.credentials = {
            username: "demo@example.org",
            password: "test",
        };
        this.cookieJar = {};
        this.authToken = null;
        this.credentialsFile = path.join(__dirname, "auth_credentials.json");
        this.debugMode = process.env.DEBUG === "true";
    }

    debug(message, data = null) {
        if (this.debugMode) {
            console.log(`🐛 DEBUG: ${message}`);
            if (data) console.log(JSON.stringify(data, null, 2));
        }
    }

    loadCredentials() {
        try {
            if (fs.existsSync(this.credentialsFile)) {
                const saved = JSON.parse(fs.readFileSync(this.credentialsFile, "utf8"));
                this.cookieJar = saved.cookies || {};
                this.authToken = saved.authToken || null;
                console.log("✓ Loaded saved authentication credentials");
                return saved;
            }
        } catch {
            console.log("No valid saved credentials found");
        }
        return null;
    }

    saveCredentials() {
        try {
            const toSave = {
                cookies: this.cookieJar,
                authToken: this.authToken,
                timestamp: Date.now(),
            };
            fs.writeFileSync(this.credentialsFile, JSON.stringify(toSave, null, 2));
            console.log("✓ Saved authentication credentials for reuse");
            return toSave;
        } catch (error) {
            console.error("Failed to save credentials:", error.message);
            return null;
        }
    }
}