import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function azureContainerName() {
  return process.env.AZURE_STORAGE_CONTAINER?.trim() || "session-files";
}

function azureService() {
  return BlobServiceClient.fromConnectionString(required("AZURE_STORAGE_CONNECTION_STRING"));
}

async function ensureAzureContainer() {
  const container = azureService().getContainerClient(azureContainerName());
  await container.createIfNotExists();
  return container;
}

export function isStorageConfigured() {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING?.trim());
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const container = await ensureAzureContainer();
  await container.getBlockBlobClient(key).uploadData(body, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

export async function deleteObject(key: string) {
  const container = await ensureAzureContainer();
  await container.getBlockBlobClient(key).deleteIfExists();
}

function azureSharedKeyCredential(): StorageSharedKeyCredential {
  const conn = required("AZURE_STORAGE_CONNECTION_STRING");
  const accountMatch = /AccountName=([^;]+)/i.exec(conn);
  const keyMatch = /AccountKey=([^;]+)/i.exec(conn);
  if (!accountMatch || !keyMatch) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING must include AccountName and AccountKey.");
  }
  return new StorageSharedKeyCredential(accountMatch[1], keyMatch[1]);
}

export async function presignedDownloadUrl(key: string, fileName: string) {
  const container = await ensureAzureContainer();
  const blob = container.getBlockBlobClient(key);
  const credential = azureSharedKeyCredential();
  const expiresOn = new Date(Date.now() + 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: azureContainerName(),
      blobName: key,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
      contentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
    },
    credential,
  ).toString();
  return `${blob.url}?${sas}`;
}
