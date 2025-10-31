import express from 'express';
import { _err, _success, formatDate } from '../../utils/utils.js';
import { _d } from '../../data/data.js';
const route = express.Router();

route.all('/', (req, res) => {
  try {
    if (!_d.pubApi.echoApi) {
      return _err(res, '接口未开放')(req);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') return res.sendStatus(204);

    const contentType = req.headers['content-type'] || '';
    const isFileUpload = contentType.startsWith('multipart/form-data');

    const response = {
      timestamp: formatDate(),
      method: req.method,
      path: req.originalUrl,
      query: req.query,
      headers: req.headers,
      body: isFileUpload ? null : req.body,
    };

    if (isFileUpload) {
      response.message = '文件上传请求已略过（未处理 multipart/form-data）';
    }

    if (req.headers['x-debug'] === 'true') {
      response.debug = { rawBody: req.rawBody || null };
    }

    _success(res, '获取回显成功', response)(req, JSON.stringify(response), 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
