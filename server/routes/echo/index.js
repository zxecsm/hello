import express from 'express';
import { formatDate } from '../../utils/utils.js';
import { _d } from '../../data/data.js';
import resp from '../../utils/response.js';
import { asyncHandler, openCors } from '../../utils/customMiddleware.js';
const route = express.Router();

route.all(
  '/',
  openCors,
  asyncHandler((req, res) => {
    if (!_d.pubApi.echoApi) {
      return resp.forbidden(res, '接口未开放')();
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

    resp.success(res, '获取回显成功', response)();
  }),
);

export default route;
