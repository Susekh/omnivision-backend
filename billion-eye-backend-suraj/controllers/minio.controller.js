const { getObject } = require('../services/minio.service');

const getImageFromMinio = async (req, res) => {
  const { bucket, year, filename } = req.params;
  const key = `${year}/${filename}`;
  const stream = await getObject(bucket, key);

  if (!stream) {
    return res.status(404).json({ message: 'Image not found' });
  }

  res.setHeader('Content-Type', 'image/jpeg'); // Or use mime if needed
  stream.pipe(res);
};

module.exports = { getImageFromMinio };
