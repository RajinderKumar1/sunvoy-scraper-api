
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
}