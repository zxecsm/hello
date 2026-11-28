import express from 'express';

import resp from '../../utils/web/response.js';
import { asyncHandler } from '../../utils/web/customMiddleware.js';
import { getHealthStatus } from '../../utils/system/healthStatus.js';

const route = express.Router();

// 健康检查：仅管理员可访问，返回服务运行状态、缓存、数据库和配置概况
route.get(
  '/',
  asyncHandler(async (_, res) => {
    if (!res.locals.hello.isRoot) {
      return resp.forbidden(res, '无权访问')();
    }

    res.setHeader('Cache-Control', 'no-store');

    resp.success(res, 'ok', await getHealthStatus())();
  }),
);

export default route;
