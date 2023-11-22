import express from "express"
import spdy from "spdy"
import fs from "fs"
import got from "got"
import { dirname } from "path"
import { fileURLToPath } from "url";

import http2wrapper from "http2-wrapper"

const CERT_DIR = `${dirname(fileURLToPath(import.meta.url))}/cert`;

const app = express()

app.get("/working", (req, res) => {
    res.send(`hello world`)
})

app.get("/timeout", (req) => {
})

const server = spdy.createServer({
    key: fs.readFileSync(`${CERT_DIR}/server.key`),
    cert: fs.readFileSync(`${CERT_DIR}/server.cert`),
}, app)

server.listen("9999", () => {
    console.log("Server listening on port 9999")
    void tryRequests()
})

const http2Got = got.extend({
    http2: true,
    https: {
        rejectUnauthorized: false
    },
    timeout: {
        request: 20
    },
    request: http2wrapper.auto,
    retry: {
        limit: 0
    }
})

const tryRequests = async () => {
    const timeoutRequests = []

    for (let i = 0; i < 10000; i++) {
        try {
            timeoutRequests.push(http2Got.get("https://localhost:9999/timeout").text().catch(() => {}))
        } catch (err) {
        }
    }

    console.log("Waiting for timeout requests to finish...")

    await Promise.allSettled(timeoutRequests)

    console.log("Finished! Attempting valid endpoint...")

    const attempts = 1000
    let failedAttempts = 0

    for (let i = 0; i < attempts; i++) {
        try {
            const response = await http2Got.get("https://localhost:9999/working").text()
            console.log(`i=${i} OK`)
        } catch (err) {
            console.log(`i=${i} FAIL`)
            failedAttempts++
        }
    }

    console.log(`Fail rate rate: ${failedAttempts/attempts} (${failedAttempts}/${attempts})`)
}
