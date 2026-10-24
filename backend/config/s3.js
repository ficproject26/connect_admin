const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

let s3ClientInstance = null;

function getS3Client() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  if (!region || !bucket) {
    throw new Error('[AWS S3] AWS_REGION and AWS_S3_BUCKET must be configured in environment variables.');
  }
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({ region });
  }
  return s3ClientInstance;
}

/**
 * Uploads a file buffer or path to AWS S3.
 * Returns { key, url } with a secure pre-signed view URL for the private S3 object.
 */
async function uploadToS3(fileBufferOrPath, folder = 'admin_uploads', filenameHint = 'document.pdf') {
  try {
    const bucket = process.env.AWS_S3_BUCKET;
    const client = getS3Client();

    let buffer;
    if (Buffer.isBuffer(fileBufferOrPath)) {
      buffer = fileBufferOrPath;
    } else if (typeof fileBufferOrPath === 'string') {
      if (fs.existsSync(fileBufferOrPath)) {
        buffer = fs.readFileSync(fileBufferOrPath);
        filenameHint = path.basename(fileBufferOrPath);
      } else if (fileBufferOrPath.startsWith('data:')) {
        const match = fileBufferOrPath.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          buffer = Buffer.from(match[2], 'base64');
          filenameHint = `upload.${match[1].split('/')[1] || 'jpg'}`;
        } else {
          throw new Error('Malformed base64 data string');
        }
      } else {
        throw new Error('Invalid file path or data provided for S3 upload');
      }
    } else {
      throw new Error('File payload must be a Buffer or file path string');
    }

    const ext = path.extname(filenameHint).toLowerCase() || '.jpg';
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.webp') mimeType = 'image/webp';

    const safeFolder = String(folder || 'admin_uploads').replace(/[^a-zA-Z0-9_-]/g, '_');
    const randSuffix = crypto.randomBytes(8).toString('hex');
    const objectKey = `${safeFolder}/${Date.now()}-${randSuffix}${ext}`;

    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType
    });

    await client.send(putCommand);

    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey
    });

    const presignedUrl = await getSignedUrl(client, getCommand, { expiresIn: 604800 });

    return {
      success: true,
      key: objectKey,
      url: presignedUrl,
      secure_url: presignedUrl
    };
  } catch (err) {
    console.error('[AWS S3 Admin Upload Error]:', err.message);
    throw new Error(`Failed to upload file to AWS S3: ${err.message}`);
  }
}

async function getPresignedUrl(key, expiresIn = 3600) {
  if (!key || typeof key !== 'string') return '';
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const bucket = process.env.AWS_S3_BUCKET;
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key.replace(/^\/+/, '')
  });
  return await getSignedUrl(client, command, { expiresIn });
}

module.exports = {
  getS3Client,
  uploadToS3,
  uploadToCloudinary: uploadToS3,
  getPresignedUrl
};
