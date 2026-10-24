const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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
    // Uses EC2 IAM Role credential provider chain automatically if no static keys in env
    s3ClientInstance = new S3Client({ region });
  }
  return s3ClientInstance;
}

// In-memory cache for presigned viewing URLs to eliminate redundant AWS signing requests (TTL: 1 hour)
const presignedUrlCache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of presignedUrlCache.entries()) {
    if (entry.expiresAt <= now) {
      presignedUrlCache.delete(k);
    }
  }
}, 10 * 60 * 1000).unref?.();

// Comprehensive MIME allowlist supporting Images, Documents, and Audio
const ALLOWED_MIME_MAP = {
  // Images (Max 15MB)
  'image/jpeg': { ext: 'jpg', category: 'image', maxSizeBytes: 15 * 1024 * 1024 },
  'image/jpg': { ext: 'jpg', category: 'image', maxSizeBytes: 15 * 1024 * 1024 },
  'image/png': { ext: 'png', category: 'image', maxSizeBytes: 15 * 1024 * 1024 },
  'image/webp': { ext: 'webp', category: 'image', maxSizeBytes: 15 * 1024 * 1024 },
  'image/gif': { ext: 'gif', category: 'image', maxSizeBytes: 15 * 1024 * 1024 },
  'image/avif': { ext: 'avif', category: 'image', maxSizeBytes: 15 * 1024 * 1024 },
  'image/svg+xml': { ext: 'svg', category: 'image', maxSizeBytes: 5 * 1024 * 1024 },

  // Documents (Max 25MB)
  'application/pdf': { ext: 'pdf', category: 'document', maxSizeBytes: 25 * 1024 * 1024 },
  'application/msword': { ext: 'doc', category: 'document', maxSizeBytes: 25 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', category: 'document', maxSizeBytes: 25 * 1024 * 1024 },
  'application/vnd.ms-excel': { ext: 'xls', category: 'document', maxSizeBytes: 25 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', category: 'document', maxSizeBytes: 25 * 1024 * 1024 },
  'text/csv': { ext: 'csv', category: 'document', maxSizeBytes: 10 * 1024 * 1024 },
  'text/plain': { ext: 'txt', category: 'document', maxSizeBytes: 10 * 1024 * 1024 },

  // Audio (Max 25MB)
  'audio/webm': { ext: 'webm', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'video/webm': { ext: 'webm', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/mpeg': { ext: 'mp3', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/mp3': { ext: 'mp3', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/wav': { ext: 'wav', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/x-wav': { ext: 'wav', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/wave': { ext: 'wav', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/m4a': { ext: 'm4a', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/x-m4a': { ext: 'm4a', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/mp4': { ext: 'm4a', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/ogg': { ext: 'ogg', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'application/ogg': { ext: 'ogg', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 },
  'audio/aac': { ext: 'aac', category: 'audio', maxSizeBytes: 25 * 1024 * 1024 }
};

const EXTENSION_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  webm: 'audio/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/m4a',
  ogg: 'audio/ogg',
  aac: 'audio/aac'
};

function detectMagicBytes(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  // PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
  // WebM (EBML)
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return 'audio/webm';
  // MP3 ID3
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio/mpeg';
  // RIFF (WAV or WEBP)
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf.length >= 12) {
    const sub = buf.toString('ascii', 8, 12);
    if (sub === 'WEBP') return 'image/webp';
    if (sub === 'WAVE') return 'audio/wav';
  }
  // OGG
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return 'audio/ogg';
  // Office OpenXML / ZIP
  if (buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04) return 'application/zip';
  return null;
}

function extractS3Key(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  const trimmed = urlOrKey.trim();

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('https://res.cloudinary.com/')) {
    return null;
  }

  const mediaMatch = trimmed.match(/\/api\/(?:media|uploads)\/s3\/([^?#]+)/i);
  if (mediaMatch && mediaMatch[1]) {
    return decodeURIComponent(mediaMatch[1]).replace(/^\/+/, '');
  }

  const cfDomain = (process.env.AWS_CLOUDFRONT_URL || process.env.CLOUDFRONT_URL || '').replace(/https?:\/\//i, '').replace(/\/+$/, '');
  if (cfDomain && trimmed.includes(cfDomain)) {
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      return decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    } catch {}
  }

  if (trimmed.includes('amazonaws.com')) {
    try {
      const parsed = new URL(trimmed);
      let p = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
      const parts = p.split('/');
      if (parts.length > 1 && ['products', 'vendor_uploads', 'admin_uploads', 'subadmin_docs', 'connect_uploads', 'voice_notes', 'kyc', 'documents', 'banners', 'categories', 'general', 'profiles', 'thumbnails', 'field_visits', 'tasks'].includes(parts[1])) {
        p = parts.slice(1).join('/');
      }
      return p;
    } catch {
      const match = trimmed.match(/amazonaws\.com\/([^?#]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).replace(/^\/+/, '');
      }
    }
  }

  if (/^[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-\.]+\.(jpg|jpeg|png|webp|gif|avif|svg|pdf|doc|docx|xls|xlsx|csv|txt|webm|mp3|wav|m4a|ogg|aac)$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function getDurableImageUrl(objectKey) {
  if (!objectKey) return '';
  const cleanKey = objectKey.replace(/^\/+/, '');
  const cloudfrontDomain = process.env.AWS_CLOUDFRONT_URL || process.env.CLOUDFRONT_URL;
  if (cloudfrontDomain) {
    const cfBase = cloudfrontDomain.startsWith('http') ? cloudfrontDomain : `https://${cloudfrontDomain}`;
    return `${cfBase.replace(/\/+$/, '')}/${cleanKey}`;
  }
  const backendBase = process.env.BACKEND_URL || 'https://admin-api.ficapp.in';
  return `${backendBase.replace(/\/+$/, '')}/api/media/s3/${cleanKey}`;
}

function resolveDurableImageUrl(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
  if (trimmed.startsWith('https://res.cloudinary.com/')) return trimmed;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) return trimmed;
  if (trimmed.includes('/api/media/s3/') || trimmed.includes('/api/uploads/s3/')) return trimmed;
  const cfDomain = (process.env.AWS_CLOUDFRONT_URL || process.env.CLOUDFRONT_URL || '').replace(/https?:\/\//i, '').replace(/\/+$/, '');
  if (cfDomain && trimmed.includes(cfDomain)) return trimmed;
  const key = extractS3Key(trimmed);
  if (key) return getDurableImageUrl(key);
  return trimmed;
}

async function getPresignedUrl(key, expiresIn = 3600) {
  if (!key || typeof key !== 'string') return '';
  const cleanKey = extractS3Key(key) || key.replace(/^\/+/, '');
  const cacheKey = `${cleanKey}:${expiresIn}`;
  const cached = presignedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.url;
  }
  const bucket = process.env.AWS_S3_BUCKET;
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: cleanKey
  });
  const signedUrl = await getSignedUrl(client, command, { expiresIn });
  presignedUrlCache.set(cacheKey, {
    url: signedUrl,
    expiresAt: Date.now() + (expiresIn - 60) * 1000
  });
  return signedUrl;
}

async function getObjectStream(key) {
  try {
    const bucket = process.env.AWS_S3_BUCKET;
    const client = getS3Client();
    const cleanKey = key.replace(/^\/+/, '');
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: cleanKey
    });
    const response = await client.send(command);
    return {
      success: true,
      body: response.Body,
      contentType: response.ContentType || 'application/octet-stream',
      contentLength: response.ContentLength,
      etag: response.ETag
    };
  } catch (err) {
    return {
      success: false,
      error: err.name === 'NoSuchKey' ? 'Object not found in S3 bucket' : (err.message || 'Failed to fetch object from S3')
    };
  }
}

/**
 * Uploads a file buffer, path, or base64 string to AWS S3.
 * Returns a hybrid result object that coerces to the durable URL string when cast to string,
 * guaranteeing 100% backward compatibility for legacy callers expecting a string URL.
 */
async function uploadToS3(fileBufferOrPath, folder = 'admin_uploads', filenameHint = 'document.pdf') {
  try {
    let buffer;
    let hint = filenameHint;

    if (Buffer.isBuffer(fileBufferOrPath)) {
      buffer = fileBufferOrPath;
    } else if (typeof fileBufferOrPath === 'string') {
      const trimmed = fileBufferOrPath.trim();
      if (trimmed.startsWith('https://res.cloudinary.com/')) {
        return {
          success: true,
          url: trimmed,
          secure_url: trimmed,
          key: trimmed,
          publicId: trimmed,
          toString() { return trimmed; },
          [Symbol.toPrimitive]() { return trimmed; }
        };
      }
      if (trimmed.includes('/api/media/s3/')) {
        return {
          success: true,
          url: trimmed,
          secure_url: trimmed,
          key: extractS3Key(trimmed) || trimmed,
          publicId: extractS3Key(trimmed) || trimmed,
          toString() { return trimmed; },
          [Symbol.toPrimitive]() { return trimmed; }
        };
      }
      if (trimmed.includes('amazonaws.com')) {
        const existingKey = extractS3Key(trimmed);
        if (existingKey) {
          const durableUrl = getDurableImageUrl(existingKey);
          return {
            success: true,
            url: durableUrl,
            secure_url: durableUrl,
            key: existingKey,
            publicId: existingKey,
            toString() { return durableUrl; },
            [Symbol.toPrimitive]() { return durableUrl; }
          };
        }
      }
      if (fs.existsSync(trimmed)) {
        buffer = fs.readFileSync(trimmed);
        hint = path.basename(trimmed);
      } else if (trimmed.startsWith('data:')) {
        const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          buffer = Buffer.from(match[2], 'base64');
          const extFromMime = ALLOWED_MIME_MAP[match[1].toLowerCase()]?.ext || 'jpg';
          hint = `upload.${extFromMime}`;
        } else {
          throw new Error('Malformed base64 data string');
        }
      } else {
        throw new Error('Invalid file path or data provided for S3 upload');
      }
    } else {
      throw new Error('File payload must be a Buffer or file path string');
    }

    let ext = path.extname(hint || '').replace('.', '').toLowerCase() || 'jpg';
    let mimeType = EXTENSION_TO_MIME[ext] || 'application/octet-stream';

    // Magic bytes check
    const magicMime = detectMagicBytes(buffer);
    if (magicMime && ALLOWED_MIME_MAP[magicMime]) {
      mimeType = magicMime;
      ext = ALLOWED_MIME_MAP[magicMime].ext;
    }

    const mimeConfig = ALLOWED_MIME_MAP[mimeType] || { category: 'file', maxSizeBytes: 25 * 1024 * 1024, ext };
    if (!ALLOWED_MIME_MAP[mimeType]) {
      throw new Error(`File format '${mimeType}' is not supported. Supported categories: Images, Documents, Audio.`);
    }

    if (buffer.length > mimeConfig.maxSizeBytes) {
      const maxMb = Math.round(mimeConfig.maxSizeBytes / (1024 * 1024));
      throw new Error(`Payload size exceeds maximum limit of ${maxMb} MB for ${mimeConfig.category}s.`);
    }

    const bucket = process.env.AWS_S3_BUCKET;
    const client = getS3Client();

    const safeFolder = String(folder || 'admin_uploads').replace(/[^a-zA-Z0-9_-]/g, '_');
    const randSuffix = crypto.randomBytes(8).toString('hex');
    const objectKey = `${safeFolder}/${Date.now()}-${randSuffix}.${ext}`;

    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        'original-name': encodeURIComponent(path.basename(hint || 'file')),
        category: mimeConfig.category
      }
    });

    await client.send(putCommand);

    const durableUrl = getDurableImageUrl(objectKey);

    const resultObj = {
      success: true,
      url: durableUrl,
      secure_url: durableUrl,
      key: objectKey,
      publicId: objectKey,
      category: mimeConfig.category,
      mimeType,
      extension: ext,
      size: buffer.length,
      originalName: hint,
      toString() { return durableUrl; },
      [Symbol.toPrimitive]() { return durableUrl; }
    };

    return resultObj;
  } catch (err) {
    console.error('[AWS S3 Admin Upload Error]:', err.message);
    throw new Error(`Failed to upload file to AWS S3: ${err.message}`);
  }
}

module.exports = {
  getS3Client,
  uploadToS3,
  uploadToCloudinary: uploadToS3,
  getPresignedUrl,
  getDurableImageUrl,
  resolveDurableImageUrl,
  extractS3Key,
  getObjectStream,
  ALLOWED_MIME_MAP,
  EXTENSION_TO_MIME,
  detectMagicBytes
};
