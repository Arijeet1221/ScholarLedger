import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("StudyMaterialRegistry", async function () {
  const { viem } = await network.connect();
  const [owner, otherUser] = await viem.getWalletClients();

  it("Registers a document with immutable metadata and uploader attribution", async function () {
    const registry = await viem.deployContract("StudyMaterialRegistry");
    const hash = "0x5f70bf18a08660b8295fd8f5610f78f7167f3ee2a8fca3968f89f06f5f4f85f8";

    await registry.write.uploadDocument([hash, "Computer Science", "Distributed Systems", "ipfs://note-v1"], {
      account: owner.account,
    });

    const document = await registry.read.getDocument([1n]);
    assert.equal(document.parentId, 0n);
    assert.equal(document.rootId, 1n);
    assert.equal(document.version, 1n);
    assert.equal(document.contentHash, hash);
    assert.equal(document.subject, "Computer Science");
    assert.equal(document.topic, "Distributed Systems");
    assert.equal(document.uri, "ipfs://note-v1");
    assert.equal(document.uploader.toLowerCase(), owner.account.address.toLowerCase());
    assert.equal(document.uploaderId, 1n);

    const uploaderId = await registry.read.uploaderIds([owner.account.address]);
    assert.equal(uploaderId, 1n);
  });

  it("Creates a linear revision history and links each new version to the parent", async function () {
    const registry = await viem.deployContract("StudyMaterialRegistry");
    const v1 = "0x1f70bf18a08660b8295fd8f5610f78f7167f3ee2a8fca3968f89f06f5f4f85f8";
    const v2 = "0x2f70bf18a08660b8295fd8f5610f78f7167f3ee2a8fca3968f89f06f5f4f85f8";

    await registry.write.uploadDocument([v1, "Mathematics", "Calculus I", "ipfs://calculus-v1"], {
      account: owner.account,
    });
    await registry.write.uploadRevision([1n, v2, "Calculus I - corrected", "ipfs://calculus-v2"], {
      account: owner.account,
    });

    const history = await registry.read.getVersionHistory([1n]);
    assert.equal(history.length, 2);
    assert.equal(history[0], 1n);
    assert.equal(history[1], 2n);

    const first = await registry.read.getDocument([1n]);
    const second = await registry.read.getDocument([2n]);

    assert.equal(first.nextVersionId, 2n);
    assert.equal(second.parentId, 1n);
    assert.equal(second.rootId, 1n);
    assert.equal(second.version, 2n);

    const latest = await registry.read.latestVersionByRoot([1n]);
    assert.equal(latest, 2n);
  });

  it("Allows only the original uploader to push revisions", async function () {
    const registry = await viem.deployContract("StudyMaterialRegistry");

    await registry.write.uploadDocument(
      [
        "0x3f70bf18a08660b8295fd8f5610f78f7167f3ee2a8fca3968f89f06f5f4f85f8",
        "Physics",
        "Electromagnetism",
        "ipfs://physics-v1",
      ],
      { account: owner.account },
    );

    await viem.assertions.revertWith(
      registry.write.uploadRevision(
        [1n, "0x4f70bf18a08660b8295fd8f5610f78f7167f3ee2a8fca3968f89f06f5f4f85f8", "Electromagnetism - revised", "ipfs://physics-v2"],
        { account: otherUser.account },
      ),
      "only original uploader",
    );
  });

  it("Enables document authenticity verification and subject-based browsing", async function () {
    const registry = await viem.deployContract("StudyMaterialRegistry");
    const storedHash = "0xaf70bf18a08660b8295fd8f5610f78f7167f3ee2a8fca3968f89f06f5f4f85f8";
    const wrongHash = "0xbf70bf18a08660b8295fd8f5610f78f7167f3ee2a8fca3968f89f06f5f4f85f8";

    await registry.write.uploadDocument([storedHash, "Biology", "Cell Biology", "ipfs://bio-v1"], {
      account: owner.account,
    });

    const isValid = await registry.read.verifyDocumentHash([1n, storedHash]);
    const isInvalid = await registry.read.verifyDocumentHash([1n, wrongHash]);
    assert.equal(isValid, true);
    assert.equal(isInvalid, false);

    const bySubject = await registry.read.getRootDocumentsBySubject(["Biology"]);
    assert.equal(bySubject.length, 1);
    assert.equal(bySubject[0], 1n);
  });
});
