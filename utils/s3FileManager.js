const logger = require('../classes').Logger(__filename);
const { S3Client, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({
  region: process.env.s3_REGION,
  credentials: {
    accessKeyId: process.env.s3_ACCESS_KEY,
    secretAccessKey: process.env.s3_SECRET_KEY,
  },
});

/**
 * Delete a single file from S3
 * @param {string} key - The key of the file to delete
 */
const deleteFileS3 = async (key) => {
  const params = {
    Bucket: process.env.s3_BUCKET,
    Key: key.split('.amazonaws.com/')[1],
  };

  try {
    // Check if the file exists
    const headCommand = new HeadObjectCommand(params);
    await s3.send(headCommand);

    // If it exists, delete it
    const deleteCommand = new DeleteObjectCommand(params);
    await s3.send(deleteCommand);

    logger.info(`File ${key} deleted successfully.`);
  } 
  catch (error) {
    if (error.name === 'NotFound') {
      logger.warn(`File ${key} does not exist.`);
    } 
    else {
      logger.error(`Error deleting file ${key}:`, error);
    }
  }
};

/**
 * Delete multiple files from S3
 * @param {string[]} keys - Array of file keys to delete
 */
const deleteFiles = async (keys) => {
  await Promise.all(keys.map(key => deleteFileS3(key)));
};

/**
 * Cleanup S3 files in the background
 * @param {string | string[]} keys - A single file key (string) or an array of file keys to delete
 */
const cleanupS3Files = (keys) => {
  const fileKeys = Array.isArray(keys) ? keys : [keys];
  deleteFiles(fileKeys).catch(error => {
    logger.error('Error during S3 file cleanup:', error);
  });
};

module.exports = {
  deleteFileS3,
  deleteFiles,
  cleanupS3Files,
};  