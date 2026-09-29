// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract StudyMaterialRegistry {
  struct Document {
    uint256 id;
    uint256 parentId;
    uint256 rootId;
    uint256 version;
    bytes32 contentHash;
    string subject;
    string topic;
    string uri;
    address uploader;
    uint256 uploaderId;
    uint256 timestamp;
    uint256 nextVersionId;
    bool exists;
  }

  uint256 public nextDocumentId = 1;
  uint256 public nextUploaderId = 1;

  mapping(uint256 => Document) private _documents;
  mapping(uint256 => uint256[]) private _versionsByRoot;
  mapping(uint256 => uint256) public latestVersionByRoot;
  mapping(bytes32 => uint256[]) private _rootDocumentsBySubject;
  mapping(address => uint256) public uploaderIds;

  event DocumentUploaded(
    uint256 indexed documentId,
    uint256 indexed parentId,
    uint256 indexed rootId,
    uint256 version,
    bytes32 contentHash,
    string subject,
    string topic,
    string uri,
    address uploader,
    uint256 uploaderId,
    uint256 timestamp
  );

  function uploadDocument(
    bytes32 contentHash,
    string calldata subject,
    string calldata topic,
    string calldata uri
  ) external returns (uint256 documentId) {
    require(contentHash != bytes32(0), "content hash required");
    require(bytes(subject).length > 0, "subject required");
    require(bytes(topic).length > 0, "topic required");

    uint256 uploaderId = _ensureUploaderId(msg.sender);
    documentId = nextDocumentId++;

    _documents[documentId] = Document({
      id: documentId,
      parentId: 0,
      rootId: documentId,
      version: 1,
      contentHash: contentHash,
      subject: subject,
      topic: topic,
      uri: uri,
      uploader: msg.sender,
      uploaderId: uploaderId,
      timestamp: block.timestamp,
      nextVersionId: 0,
      exists: true
    });

    _versionsByRoot[documentId].push(documentId);
    latestVersionByRoot[documentId] = documentId;
    _rootDocumentsBySubject[_subjectKey(subject)].push(documentId);

    emit DocumentUploaded(
      documentId,
      0,
      documentId,
      1,
      contentHash,
      subject,
      topic,
      uri,
      msg.sender,
      uploaderId,
      block.timestamp
    );
  }

  function uploadRevision(
    uint256 parentDocumentId,
    bytes32 contentHash,
    string calldata topic,
    string calldata uri
  ) external returns (uint256 documentId) {
    require(contentHash != bytes32(0), "content hash required");
    require(bytes(topic).length > 0, "topic required");

    Document storage parentDocument = _documents[parentDocumentId];
    require(parentDocument.exists, "parent not found");

    uint256 rootId = parentDocument.rootId;
    Document storage rootDocument = _documents[rootId];
    require(msg.sender == rootDocument.uploader, "only original uploader");
    require(parentDocumentId == latestVersionByRoot[rootId], "must revise latest version");

    uint256 uploaderId = uploaderIds[msg.sender];
    documentId = nextDocumentId++;

    _documents[documentId] = Document({
      id: documentId,
      parentId: parentDocumentId,
      rootId: rootId,
      version: _versionsByRoot[rootId].length + 1,
      contentHash: contentHash,
      subject: rootDocument.subject,
      topic: topic,
      uri: uri,
      uploader: msg.sender,
      uploaderId: uploaderId,
      timestamp: block.timestamp,
      nextVersionId: 0,
      exists: true
    });

    parentDocument.nextVersionId = documentId;
    _versionsByRoot[rootId].push(documentId);
    latestVersionByRoot[rootId] = documentId;

    emit DocumentUploaded(
      documentId,
      parentDocumentId,
      rootId,
      _documents[documentId].version,
      contentHash,
      rootDocument.subject,
      topic,
      uri,
      msg.sender,
      uploaderId,
      block.timestamp
    );
  }

  function getDocument(uint256 documentId) external view returns (Document memory) {
    Document memory document = _documents[documentId];
    require(document.exists, "document not found");
    return document;
  }

  function getVersionHistory(uint256 documentId) external view returns (uint256[] memory) {
    Document memory document = _documents[documentId];
    require(document.exists, "document not found");
    return _versionsByRoot[document.rootId];
  }

  function getRootDocumentsBySubject(string calldata subject) external view returns (uint256[] memory) {
    return _rootDocumentsBySubject[_subjectKey(subject)];
  }

  function verifyDocumentHash(uint256 documentId, bytes32 localHash) external view returns (bool) {
    Document memory document = _documents[documentId];
    require(document.exists, "document not found");
    return document.contentHash == localHash;
  }

  function _ensureUploaderId(address uploader) private returns (uint256 uploaderId) {
    uploaderId = uploaderIds[uploader];
    if (uploaderId == 0) {
      uploaderId = nextUploaderId++;
      uploaderIds[uploader] = uploaderId;
    }
  }

  function _subjectKey(string memory subject) private pure returns (bytes32) {
    return keccak256(bytes(subject));
  }
}
