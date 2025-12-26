const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const multerS3 = require("multer-s3");
const s3 = new S3Client({
  region: process.env.s3_REGION,
  credentials: {
    accessKeyId: process.env.s3_ACCESS_KEY,
    secretAccessKey: process.env.s3_SECRET_KEY,
  },
});
const images = [];

const imageFilter = (req, file, cb) => {
  console.log(
    "Uploading file:",
    file.originalname,
    "with mimetype:",
    file.mimetype
  );

  if (
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/gif" ||
    file.mimetype === "image/svg+xml" ||
    file.mimetype === "application/octet-stream"
  ) {
    cb(null, true);
  } else {
    cb(
      "Please upload only image file. (jpg, jpeg, png, gif, svg and svga)",
      false
    );
  }
};

const storage = multerS3({
  s3: s3,
  bucket: process.env.s3_BUCKET,
  acl: "public-read",
  key: function (req, file, cb) {
    let originalFile = file.originalname,
      ext = "";
    // console.log(file);
    if (path.extname(file.originalname).length) {
      ext = path.extname(file.originalname);
      originalFile = originalFile.split(ext)[0];
    } else {
      ext = "." + file.mimetype.split("/")[1];
    }

    let fileName = originalFile + "-" + uuidv4() + ext;
    if (file.fieldname === "file") {
      req.body.image = `${process.env.s3_BUCKET_URL}/${fileName}`;
    } else if (file.fieldname === "files") {
      images.push(`${process.env.s3_BUCKET_URL}/${fileName}`);
      req.body.images = images;
    } else if (file.fieldname === "resource") {
      req.body.resourceImage = `${process.env.s3_BUCKET_URL}/${fileName}`;
    } else if (file.fieldname === "thumbnail") {
      req.body.thumbnailImage = `${process.env.s3_BUCKET_URL}/${fileName}`;
    }

    cb(null, fileName);
  },
});

const imageStorage = multer({ storage: storage, fileFilter: imageFilter });

module.exports = imageStorage;
