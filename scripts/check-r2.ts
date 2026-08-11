/**
 * Confirms the R2 credentials and bucket work end to end:
 * head the bucket, write a probe object, read it back, delete it.
 *
 *   npm run check:r2
 */
import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}

async function main() {
  const bucket = process.env.R2_BUCKET!;
  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  console.log(`endpoint: ${process.env.R2_ENDPOINT}`);
  console.log(`bucket:   ${bucket}\n`);

  try {
    const { Buckets } = await client.send(new ListBucketsCommand({}));
    console.log('buckets visible to this key:', Buckets?.map((b) => b.Name).join(', ') || '(none)');
  } catch (e) {
    console.log('could not list buckets:', e instanceof Error ? e.message : e);
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`PASS  bucket "${bucket}" exists and is reachable`);
  } catch (e) {
    console.error(`FAIL  bucket "${bucket}": ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  const key = `_healthcheck/${Date.now()}.txt`;
  const body = 'mvttc r2 connectivity probe';

  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain' }),
  );
  console.log('PASS  write');

  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await got.Body!.transformToString();
  console.log(text === body ? 'PASS  read back matches' : `FAIL  read back: "${text}"`);

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log('PASS  delete\n');
  console.log('R2 is ready.');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
