// SunvoyAPI.js
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");

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
        } catch (error) {
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

    makeRequest(options, postData = null) {
        return new Promise((resolve, reject) => {
            const cookies = Object.entries(this.cookieJar)
                .map(([key, value]) => `${key}=${value}`)
                .join("; ");

            if (cookies) {
                options.headers = options.headers || {};
                options.headers["Cookie"] = cookies;
            }

            if (postData && options.method === "POST") {
                options.headers = options.headers || {};
                if (!options.headers["Content-Length"]) {
                    options.headers["Content-Length"] = Buffer.byteLength(postData);
                }
            }

            const req = https.request(options, (res) => {
                let data = "";

                if (res.headers["set-cookie"]) {
                    res.headers["set-cookie"].forEach((cookie) => {
                        const [nameValue] = cookie.split(";");
                        const [name, value] = nameValue.split("=");
                        if (name && value) this.cookieJar[name.trim()] = value.trim();
                    });
                }

                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    const result = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data,
                        json: null,
                    };
                    if (
                        res.headers["content-type"]?.includes("application/json") ||
                        data.trim().startsWith("{") ||
                        data.trim().startsWith("[")
                    ) {
                        try {
                            result.json = JSON.parse(data);
                        } catch {}
                    }
                    resolve(result);
                });
            });

            req.on("error", reject);
            if (postData) req.write(postData);
            req.end();
        });
    }

    async login() {
        console.log("🔐 Attempting to login...");
        const loginPage = await this.makeRequest({
            hostname: "challenge.sunvoy.com",
            path: "/login",
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        const nonceMatch = loginPage.body.match(/name=["']nonce["'][^>]*value=["']([^"']+)["']/);
        const nonce = nonceMatch ? nonceMatch[1] : "72c894c8b3877da3664171e45270e6e4";

        const loginData = new URLSearchParams({
            username: this.credentials.username,
            password: this.credentials.password,
            nonce,
        });

        const response = await this.makeRequest(
            {
                hostname: "challenge.sunvoy.com",
                path: "/login",
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0",
                    Referer: "https://challenge.sunvoy.com/login",
                    Origin: "https://challenge.sunvoy.com",
                },
            },
            loginData.toString()
        );

        if (response.statusCode === 200 || response.statusCode === 302) {
            console.log("✅ Login successful!");
            return this.saveCredentials();
        }

        console.log("❌ Login failed.");
        return null;
    }

    async validateSession() {
        const response = await this.makeRequest({
            hostname: "challenge.sunvoy.com",
            path: "/dashboard",
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });
        return response.statusCode === 200 && !response.body.includes("login");
    }

    async getUsers() {
        console.log("👥 Fetching users list...");
        const response = await this.makeRequest(
            {
                hostname: "challenge.sunvoy.com",
                path: "/api/users",
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                    Referer: "https://challenge.sunvoy.com/",
                    Origin: "https://challenge.sunvoy.com",
                },
            },
            "{}"
        );

        if (response.statusCode === 200 && response.json) {
            console.log("✓ Users found via POST /api/users");
            return Array.isArray(response.json) ? response.json.slice(0, 10) : [response.json];
        }

        throw new Error("❌ Failed to fetch users list.");
    }

    async getCurrentUser() {
        const tokenPage = await this.makeRequest({
            hostname: "challenge.sunvoy.com",
            path: "/settings/tokens",
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        const extract = (id) => {
            const match = tokenPage.body.match(new RegExp(`id=\"${id}\"[^>]*value=\"([^\"]+)\"`));
            return match ? match[1] : null;
        };

        const userId = extract("userId");
        const openId = extract("openId");
        const timestamp = Math.floor(Date.now() / 1000);
        const checkcode = this.generateCheckcode(userId, openId, timestamp);

        const payload = {
            access_token: extract("access_token"),
            apiuser: extract("apiuser"),
            language: extract("language"),
            openId,
            operateId: extract("operateId"),
            timestamp,
            userId,
            checkcode,
        };

        const response = await this.makeRequest(
            {
                hostname: "api.challenge.sunvoy.com",
                path: "/api/settings",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                },
            },
            JSON.stringify(payload)
        );

        

        if (response.statusCode === 200 && response.json) {
            return response.json;
        }

        return null

    }

    generateCheckcode(accessToken, userId, timestamp) {
        return crypto
            .createHash("sha1")
            .update(accessToken + userId + timestamp)
            .digest("hex")
            .toUpperCase();
    }
    

    async run() {
        console.log("🚀 Starting Sunvoy API reverse engineering...\n");

        const hasValidCredentials = this.loadCredentials();
        if (hasValidCredentials) {
            const isValid = await this.validateSession();
            if (!isValid) {
                console.log("❌ Session invalid. Logging in...");
                await this.login();
            }
        } else {
            await this.login();
        }

        const users = await this.getUsers();
        const currentUser = await this.getCurrentUser();
        
        if (currentUser) {
            
            users = [...users, { currentUser }];
        }

        const outputFile = path.join(__dirname, "users.json");
        fs.writeFileSync(outputFile, JSON.stringify(users, null, 2));

        console.log(`\n✅ Successfully saved ${users.length} user records to users.json`);
    }
}

module.exports = SunvoyAPI;


// Run the script
if (require.main === module) {
    const api = new SunvoyAPI();
    api.run().catch(console.error);
}

