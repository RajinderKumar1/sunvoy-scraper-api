# Sunvoy Scraper API

Hey, I'm Rajinder Kumar 👋

This is a reverse engineering assignment I worked on to extract user data from the legacy Sunvoy web application. The challenge was to log in programmatically, maintain sessions, and retrieve both user lists and current user details securely.

I used pure Node.js modules like `https`, `fs`, and `crypto` — no external dependencies — to simulate real-world web scraping and session handling.

---

## 🚀 What it does

- Logs in to the [Sunvoy challenge site](https://challenge.sunvoy.com)
- Handles session reuse via saved cookies and tokens (`auth_credentials.json`)
- Fetches the user list via a POST request to `/api/users`
- Extracts additional current user details via token page parsing and authenticated API call
- Saves the final data into a local `users.json` file

---

## 📁 Output

The script writes all fetched user data 

