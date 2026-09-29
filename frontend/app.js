import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.5/+esm";

const CONTRACT_ABI = [
  "function uploadDocument(bytes32 contentHash, string subject, string topic, string uri) external returns (uint256)",
  "function uploadRevision(uint256 parentDocumentId, bytes32 contentHash, string topic, string uri) external returns (uint256)",
  "function getDocument(uint256 documentId) external view returns ((uint256 id, uint256 parentId, uint256 rootId, uint256 version, bytes32 contentHash, string subject, string topic, string uri, address uploader, uint256 uploaderId, uint256 timestamp, uint256 nextVersionId, bool exists))",
  "function getVersionHistory(uint256 documentId) external view returns (uint256[] memory)",
  "function getRootDocumentsBySubject(string subject) external view returns (uint256[] memory)",
  "function verifyDocumentHash(uint256 documentId, bytes32 localHash) external view returns (bool)",
  "function latestVersionByRoot(uint256 rootId) external view returns (uint256)",
  "function uploaderIds(address uploader) external view returns (uint256)",
];

const IPFS_BACKEND_URL = "http://127.0.0.1:8080";

let browserProvider;
let signer;

const el = {
  contractAddress: document.getElementById("contractAddress"),
  connectWalletBtn: document.getElementById("connectWalletBtn"),
  switchNetworkBtn: document.getElementById("switchNetworkBtn"),
  walletState: document.getElementById("walletState"),
  actionStatus: document.getElementById("actionStatus"),
  uploadForm: document.getElementById("uploadForm"),
  uploadSubject: document.getElementById("uploadSubject"),
  uploadTopic: document.getElementById("uploadTopic"),
  uploadUri: document.getElementById("uploadUri"),
  uploadFile: document.getElementById("uploadFile"),
  uploadHash: document.getElementById("uploadHash"),
  revisionForm: document.getElementById("revisionForm"),
  revisionParentId: document.getElementById("revisionParentId"),
  revisionTopic: document.getElementById("revisionTopic"),
  revisionUri: document.getElementById("revisionUri"),
  revisionFile: document.getElementById("revisionFile"),
  revisionHash: document.getElementById("revisionHash"),
  browseForm: document.getElementById("browseForm"),
  browseSubject: document.getElementById("browseSubject"),
  browseResults: document.getElementById("browseResults"),
  historyForm: document.getElementById("historyForm"),
  historyDocumentId: document.getElementById("historyDocumentId"),
  historyResults: document.getElementById("historyResults"),
  verifyForm: document.getElementById("verifyForm"),
  verifyDocumentId: document.getElementById("verifyDocumentId"),
  verifyFile: document.getElementById("verifyFile"),
  verifyHash: document.getElementById("verifyHash"),
  verifyResult: document.getElementById("verifyResult"),
  logPanel: document.getElementById("logPanel"),
};

function log(message) {
  const now = new Date().toLocaleTimeString();
  el.logPanel.textContent = `[${now}] ${message}\n${el.logPanel.textContent}`;
}

function setActionStatus(message, kind = "info") {
  el.actionStatus.textContent = message;
  el.actionStatus.className = `state action-status ${kind}`;
}

function getErrorMessage(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.info?.error?.message ||
    error?.info?.message ||
    error?.message ||
    "Unknown error"
  );
}

function formatDate(unixSeconds) {
  const date = new Date(Number(unixSeconds) * 1000);
  return date.toLocaleString();
}

function toIpfsGatewayUrl(uri) {
  if (!uri) {
    return "";
  }

  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  }

  return uri;
}

async function fileToHash(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ethers.keccak256(bytes);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }

      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

async function uploadFileToIpfs(file) {
  const payload = {
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    data: await fileToBase64(file),
  };

  const response = await fetch(`${IPFS_BACKEND_URL}/ipfs/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `IPFS upload failed with status ${response.status}`);
  }

  const body = await response.json();
  if (!body?.uri) {
    throw new Error("IPFS backend did not return a URI");
  }

  return body;
}

async function resolveHash(fileInput, typedHash) {
  if (typedHash && typedHash.trim()) {
    return typedHash.trim();
  }

  if (fileInput.files && fileInput.files[0]) {
    return fileToHash(fileInput.files[0]);
  }

  throw new Error("Provide a file or hash");
}

function requireSigner() {
  if (!signer) {
    throw new Error("Connect wallet first");
  }
}

async function getContract() {
  requireSigner();
  const address = el.contractAddress.value.trim();
  if (!ethers.isAddress(address)) {
    throw new Error("Enter a valid deployed contract address");
  }

  const provider = signer.provider;
  if (!provider) {
    throw new Error("Wallet provider is not ready");
  }

  const code = await provider.getCode(address);
  if (code === "0x") {
    throw new Error("No contract code found at this address on the current network. Paste the local deployment address and make sure Hardhat node is still running.");
  }

  return new ethers.Contract(address, CONTRACT_ABI, signer);
}

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Use Chrome/Brave with MetaMask, or use Connect Local Dev Wallet.");
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);
  await browserProvider.send("eth_requestAccounts", []);
  signer = await browserProvider.getSigner();
  const account = await signer.getAddress();
  const network = await browserProvider.getNetwork();
  el.walletState.textContent = `Wallet: ${account} | Chain ID: ${network.chainId}`;
  setActionStatus(`Connected wallet ${account} on chain ${network.chainId}.`, "success");
  log(`Connected wallet ${account}`);
}

async function switchToLocalhost() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Use Connect Local Dev Wallet instead.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }],
    });
    log("Switched to localhost chain (31337)");
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x7a69",
            chainName: "Hardhat Localhost",
            rpcUrls: ["http://127.0.0.1:8545"],
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18,
            },
          },
        ],
      });
      log("Added localhost chain to wallet");
    } else {
      throw switchError;
    }
  }
}

async function renderSubjectResults(subject) {
  const contract = await getContract();
  const rootIds = await contract.getRootDocumentsBySubject(subject);

  if (rootIds.length === 0) {
    el.browseResults.innerHTML = "<div class=\"result-item\">No materials found.</div>";
    return;
  }

  const rows = await Promise.all(
    rootIds.map(async (id) => {
      const doc = await contract.getDocument(id);
      const latest = await contract.latestVersionByRoot(doc.rootId);
      const gatewayUrl = toIpfsGatewayUrl(doc.uri);
      return `
        <div class="result-item">
          <div><strong>Root ID:</strong> ${doc.rootId}</div>
          <div><strong>Latest Version ID:</strong> ${latest}</div>
          <div><strong>Topic:</strong> ${doc.topic}</div>
          <div><strong>Uploader:</strong> ${doc.uploader}</div>
          <div><strong>Uploader ID:</strong> ${doc.uploaderId}</div>
          <div><strong>Created:</strong> ${formatDate(doc.timestamp)}</div>
          <div><strong>URI:</strong> <a href="${gatewayUrl}" target="_blank" rel="noreferrer">${gatewayUrl}</a></div>
        </div>
      `;
    }),
  );

  el.browseResults.innerHTML = rows.join("");
}

async function renderHistory(documentId) {
  const contract = await getContract();
  const ids = await contract.getVersionHistory(documentId);

  const rows = await Promise.all(
    ids.map(async (id) => {
      const doc = await contract.getDocument(id);
      const gatewayUrl = toIpfsGatewayUrl(doc.uri);
      return `
        <div class="result-item">
          <div><strong>Document ID:</strong> ${doc.id}</div>
          <div><strong>Version:</strong> ${doc.version}</div>
          <div><strong>Parent ID:</strong> ${doc.parentId}</div>
          <div><strong>Hash:</strong> ${doc.contentHash}</div>
          <div><strong>Topic:</strong> ${doc.topic}</div>
          <div><strong>Timestamp:</strong> ${formatDate(doc.timestamp)}</div>
          <div><strong>URI:</strong> <a href="${gatewayUrl}" target="_blank" rel="noreferrer">${gatewayUrl}</a></div>
        </div>
      `;
    }),
  );

  el.historyResults.innerHTML = rows.join("");
}

el.connectWalletBtn.addEventListener("click", async () => {
  try {
    await connectWallet();
  } catch (error) {
    const message = getErrorMessage(error);
    setActionStatus(`Wallet connect failed: ${message}`, "error");
    log(`Wallet connect failed: ${message}`);
  }
});

el.switchNetworkBtn.addEventListener("click", async () => {
  try {
    await switchToLocalhost();
    setActionStatus("Switched MetaMask to Hardhat Localhost.", "success");
  } catch (error) {
    const message = getErrorMessage(error);
    setActionStatus(`Network switch failed: ${message}`, "error");
    log(`Network switch failed: ${message}`);
  }
});

el.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const contract = await getContract();
    const hash = await resolveHash(el.uploadFile, el.uploadHash.value);
    const uri = await (async () => {
      const selectedFile = el.uploadFile.files && el.uploadFile.files[0] ? el.uploadFile.files[0] : null;

      if (selectedFile) {
        setActionStatus("Upload: uploading file to IPFS...", "info");
        const result = await uploadFileToIpfs(selectedFile);
        return result.uri;
      }

      if (el.uploadUri.value && el.uploadUri.value.trim()) {
        return el.uploadUri.value.trim();
      }

      throw new Error("Select a file to upload to IPFS or paste a URI manually");
    })();
    el.uploadUri.value = uri;
    const tx = await contract.uploadDocument(hash, el.uploadSubject.value.trim(), el.uploadTopic.value.trim(), uri);
    log(`Upload tx sent: ${tx.hash}`);
    await tx.wait();
    setActionStatus(`Upload confirmed. Tx: ${tx.hash}`, "success");
    log("Upload confirmed");
  } catch (error) {
    const message = getErrorMessage(error);
    setActionStatus(`Upload failed: ${message}`, "error");
    log(`Upload failed: ${message}`);
  }
});

el.revisionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const contract = await getContract();
    const parentId = BigInt(el.revisionParentId.value);
    const hash = await resolveHash(el.revisionFile, el.revisionHash.value);
    const uri = await (async () => {
      const selectedFile = el.revisionFile.files && el.revisionFile.files[0] ? el.revisionFile.files[0] : null;

      if (selectedFile) {
        setActionStatus("Revision: uploading file to IPFS...", "info");
        const result = await uploadFileToIpfs(selectedFile);
        return result.uri;
      }

      if (el.revisionUri.value && el.revisionUri.value.trim()) {
        return el.revisionUri.value.trim();
      }

      throw new Error("Select a file to upload to IPFS or paste a URI manually");
    })();
    el.revisionUri.value = uri;

    const [connectedAccount, parentDocument] = await Promise.all([
      signer.getAddress(),
      contract.getDocument(parentId),
    ]);

    const [rootDocument, latestVersionId] = await Promise.all([
      contract.getDocument(parentDocument.rootId),
      contract.latestVersionByRoot(parentDocument.rootId),
    ]);

    if (parentId !== latestVersionId) {
      const message = `Document ${parentId} is not the latest version. Use latest version ID ${latestVersionId} as parent.`;
      setActionStatus(`Revision failed: ${message}`, "error");
      log(`Revision failed: ${message}`);
      return;
    }

    if (rootDocument.uploader.toLowerCase() !== connectedAccount.toLowerCase()) {
      const message = "You are not authorized to revise this document. Only the original uploader can submit a revision.";
      setActionStatus(`Revision failed: ${message}`, "error");
      log(`Revision failed: ${message}`);
      return;
    }

    const tx = await contract.uploadRevision(parentId, hash, el.revisionTopic.value.trim(), uri);
    log(`Revision tx sent: ${tx.hash}`);
    await tx.wait();
    setActionStatus(`Revision confirmed. Tx: ${tx.hash}`, "success");
    log("Revision confirmed");
  } catch (error) {
    const message = getErrorMessage(error);
    setActionStatus(`Revision failed: ${message}`, "error");
    log(`Revision failed: ${message}`);
  }
});

el.browseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await renderSubjectResults(el.browseSubject.value.trim());
    setActionStatus(`Browse completed for subject "${el.browseSubject.value.trim()}".`, "success");
    log(`Subject query executed for ${el.browseSubject.value.trim()}`);
  } catch (error) {
    const message = getErrorMessage(error);
    setActionStatus(`Browse failed: ${message}`, "error");
    log(`Browse failed: ${message}`);
  }
});

el.historyForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await renderHistory(BigInt(el.historyDocumentId.value));
    setActionStatus(`History loaded for document ${el.historyDocumentId.value}.`, "success");
    log(`History loaded for document ${el.historyDocumentId.value}`);
  } catch (error) {
    const message = getErrorMessage(error);
    setActionStatus(`History failed: ${message}`, "error");
    log(`History failed: ${message}`);
  }
});

el.verifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const contract = await getContract();
    const documentId = BigInt(el.verifyDocumentId.value);
    const localHash = await resolveHash(el.verifyFile, el.verifyHash.value);
    const valid = await contract.verifyDocumentHash(documentId, localHash);

    el.verifyResult.className = valid ? "state ok" : "state bad";
    el.verifyResult.textContent = valid
      ? `Verified: local hash matches on-chain record (${localHash})`
      : `Mismatch: local hash differs from on-chain record (${localHash})`;
    setActionStatus(valid ? `Verification passed for document ${documentId}.` : `Verification mismatch for document ${documentId}.`, valid ? "success" : "error");

    log(`Verification result for document ${documentId}: ${valid ? "valid" : "invalid"}`);
  } catch (error) {
    const message = getErrorMessage(error);
    setActionStatus(`Verification failed: ${message}`, "error");
    log(`Verification failed: ${message}`);
  }
});

if (!window.ethereum) {
  log("Injected wallet not detected. If you are in VS Code preview, open http://localhost:5173 in Chrome/Brave, or use local dev wallet connection.");
}

setActionStatus("Ready.", "info");
log("Frontend loaded. Enter contract address, then connect wallet.");
