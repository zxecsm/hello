import sparkMd5 from 'spark-md5';

self.onmessage = async function (e) {
  const spark = new sparkMd5.ArrayBuffer();

  const res = [];
  const { chunks } = e.data;

  for (let i = 0; i < chunks.length; i++) {
    const buf = await getFileReader(chunks[i]);
    spark.append(buf);

    res.push({
      file: chunks[i],
      filename: `_${i}`,
    });

    self.postMessage({
      type: 'progress',
      value: chunks.length === 1 ? 1 : (i + 1) / chunks.length,
    });
  }

  self.postMessage({ type: 'result', value: res, HASH: spark.end() });
  self.close(); // 完成后关闭 Worker
};

function getFileReader(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = (e) => {
      fileReader.onload = null;
      fileReader.onerror = null;
      resolve(e.target.result);
    };

    fileReader.onerror = (err) => {
      fileReader.onload = null;
      fileReader.onerror = null;
      reject(err);
    };

    fileReader.readAsArrayBuffer(file);
  });
}
