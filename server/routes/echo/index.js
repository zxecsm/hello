import express from 'express';
import { formatDate, openCors } from '../../utils/utils.js';
import { _d } from '../../data/data.js';
import resp from '../../utils/response.js';
const route = express.Router();

route.all('/', openCors, (req, res) => {
  try {
    if (!_d.pubApi.echoApi) {
      return resp.forbidden(res, '接口未开放')(req);
    }

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

    resp.success(res, '获取回显成功', response)(req, JSON.stringify(response), 1);
  } catch (error) {
    resp.error(res)(req, error);
  }
});

export default route;
