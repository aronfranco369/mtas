import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 over the S3-compatible API. The bucket is private: objects are
 * only ever reached through short-lived presigned URLs or streamed server-side,
 * because these are individually identifiable trainee assessment records.
 */

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;

  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials are not configured (see .env.example).');
  }

  client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

function bucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error('R2_BUCKET is not configured.');
  return b;
}

export async function uploadPdf(key: string, body: Buffer, downloadName: string) {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: 'application/pdf',
      // Preserves the college's existing "Name - Assessor - Date.pdf" convention
      // for whatever the user actually saves.
      ContentDisposition: `attachment; filename="${downloadName.replace(/"/g, '')}"`,
    }),
  );
}

export async function getPdf(key: string): Promise<Buffer> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

/** Removes a stored report — used when an administrator clears an assessment. */
export async function deletePdf(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Short-lived URL. 15 minutes is long enough to click, short enough to matter. */
export async function presignPdf(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/** Used by the setup check to confirm credentials and bucket before deploying. */
export async function verifyBucket(): Promise<void> {
  await r2().send(new HeadBucketCommand({ Bucket: bucket() }));
}
