# ScholarLedger

A blockchain-based peer-to-peer study material sharing platform where each upload and revision is anchored on-chain for authenticity, attribution, and version tracking.

## What This Project Implements

- Immutable upload records with:
  - File hash (`bytes32`)
  - Uploader wallet address
  - Subject and topic metadata
  - Timestamp
- Smart contract workflow for:
  - New uploads
  - Revision linking (`parentId`, `rootId`, `version`, `nextVersionId`)
  - Access control so only the original uploader can publish revisions
- Unique identifiers:
  - `documentId` for each version
  - `uploaderId` for each uploader wallet
- Authenticity verification:
  - Compare a local file hash with on-chain hash using `verifyDocumentHash`
- Frontend features:
  - Upload material
  - Upload revision
  - Browse by subject
  - View full version history
  - Verify local file integrity
- Optional IPFS-backed upload flow:
  - Browser sends file to local backend
  - Backend pins it to Pinata/IPFS
  - Backend returns `ipfs://...`
  - Frontend stores that URI on-chain

## Tech Stack

- Solidity `0.8.28`
- Hardhat 3
- TypeScript tests (`node:test` + viem)
- Ethers.js frontend

## Consensus Choice (and Why)

Recommended for this use case: **Proof of Authority (PoA)** on a permissioned or consortium network.

Why PoA fits a student document registry:

- Low transaction cost for frequent uploads/revisions.
- Fast finality for near real-time confirmation in UI.
- Predictable throughput under campus-scale traffic.
- Governance is manageable through trusted validators (e.g., departments/university IT).

For public deployments, you can still use an L2 chain (OP stack, Polygon, Arbitrum) to reduce cost while keeping public verifiability.

## Contract

Main contract: `StudyMaterialRegistry` in `contracts/Counter.sol`.

Core methods:

- `uploadDocument(bytes32 contentHash, string subject, string topic, string uri)`
- `uploadRevision(uint256 parentDocumentId, bytes32 contentHash, string topic, string uri)`
- `getDocument(uint256 documentId)`
- `getVersionHistory(uint256 documentId)`
- `getRootDocumentsBySubject(string subject)`
- `verifyDocumentHash(uint256 documentId, bytes32 localHash)`

## How To Run

### 1. Install dependencies

```bash
npm install
```

### 2. Compile contracts

```bash
npm run compile
```

### 3. Run tests

```bash
npm test
```

### 4. Start local blockchain

```bash
npm run node
```

Keep this terminal running.

### 5. Start IPFS backend

Set your Pinata JWT first:

```powershell
$env:PINATA_JWT="YOUR_PINATA_JWT"
```

Then run:

```bash
npm run backend
```

This backend accepts uploaded files, pins them to IPFS through Pinata, and returns the generated `ipfs://` URI.

### 6. Deploy locally (new terminal)

```bash
npm run deploy:local
```

Copy the deployed contract address from output.

### 7. Launch frontend (new terminal)

```bash
npm run frontend
```

Open `http://localhost:5173` and do the following:

1. Paste deployed contract address.
2. Connect wallet (MetaMask).
3. Switch to Localhost 31337.
4. Upload new document or revision.
  - If you pick a file, the backend will generate the `ipfs://...` URI automatically.
  - If you leave the file empty, you can still paste a manual URI.
5. Browse by subject and inspect version history.
6. Verify local file integrity.

## Sepolia Deployment

Set environment variables in PowerShell:

```powershell
$env:SEPOLIA_RPC_URL="YOUR_RPC_URL"
$env:SEPOLIA_PRIVATE_KEY="YOUR_PRIVATE_KEY"
```

Then deploy:

```bash
npm run deploy:sepolia
```

## Notes

- Local file hashing in frontend uses `keccak256(fileBytes)` for EVM-compatible verification.
- Hardhat may warn if your Node version is unsupported. Upgrade to Node `22.10.0+` (or compatible LTS) if needed.
