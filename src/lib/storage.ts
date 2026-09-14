import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

function useAzure() {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING?.trim());
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

function s3Client() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  return new S3Client({
    region: required("S3_REGION"),
    endpoint: endpoint || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY"),
      secretAccessKey: required("S3_SECRET_KEY"),
    },
  });
}

function s3Bucket() {
  return required("S3_BUCKET");
}

export function isStorageConfigured() {
  if (useAzure()) return true;
  return Boolean(
    process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY,
  );
}

async function ensureS3Bucket() {
  const s3 = s3Client();
  const name = s3Bucket();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: name }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: name }));
  }
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (useAzure()) {
    const container = await ensureAzureContainer();
    await container.getBlockBlobClient(key).uploadData(body, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return;
  }

  await ensureS3Bucket();
  await s3Client().send(
    new PutObjectCommand({
      Bucket: s3Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteObject(key: string) {
  if (useAzure()) {
    const container = await ensureAzureContainer();
    await container.getBlockBlobClient(key).deleteIfExists();
    return;
  }

  await s3Client().send(new DeleteObjectCommand({ Bucket: s3Bucket(), Key: key }));
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
  if (useAzure()) {
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

  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: s3Bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
    }),
    { expiresIn: 60 },
  );
}
