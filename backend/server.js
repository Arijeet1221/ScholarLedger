import http from "node:http";

const PORT = Number(process.env.IPFS_BACKEND_PORT || 8080);
const PINATA_JWT = process.env.PINATA_JWT || "";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(message);
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

async function uploadToPinata({ filename, mimeType, data }) {
  if (!PINATA_JWT) {
    throw new Error("Missing PINATA_JWT environment variable");
  }

  if (!data) {
    throw new Error("File data is required");
  }

  const bytes = Buffer.from(data, "base64");
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  const formData = new FormData();
  formData.append("file", blob, filename || "upload.bin");

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Pinata upload failed with status ${response.status}`);
  }

  const result = await response.json();
  if (!result?.IpfsHash) {
    throw new Error("Pinata did not return an IPFS hash");
  }

  return {
    cid: result.IpfsHash,
    uri: `ipfs://${result.IpfsHash}`,
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/ipfs/upload") {
    try {
      const payload = await parseJsonBody(request);
      const result = await uploadToPinata(payload);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message || "IPFS upload failed" });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  sendText(response, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`IPFS backend running at http://127.0.0.1:${PORT}`);
  if (!PINATA_JWT) {
    console.log("Warning: PINATA_JWT is not set. Uploads will fail until you configure it.");
  }
});