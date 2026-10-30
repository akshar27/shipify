const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

// Local development: with no bucket configured, files go to backend/uploads/<folder>/ (already served at /uploads).
const saveLocally = async (file, folder) => {
  const safeName = path.basename(file.originalname).replace(/[^A-Za-z0-9._-]/g, "_");
  const dir = path.join(__dirname, "..", "uploads", folder);
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${safeName}`;
  await fs.promises.writeFile(path.join(dir, name), file.buffer);
  const origin = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${origin}/uploads/${folder}/${name}`;
};

exports.uploadToS3 = async (file, folder) => {
  if (!process.env.AWS_BUCKET_NAME) return saveLocally(file, folder);
  const fileName = `${folder}/${Date.now()}-${file.originalname}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };

  const uploadResult = await s3.upload(params).promise();
  return uploadResult.Location;
};
