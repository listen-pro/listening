// 只打包用到的三个模块:内核、登录、PostgreSQL(rdb)。全量包约 900KB,这样约 460KB。
import cloudbase from '@cloudbase/js-sdk/app';
import { registerAuth } from '@cloudbase/js-sdk/auth';
import { registerMySQL } from '@cloudbase/js-sdk/mysql';

registerAuth(cloudbase);
registerMySQL(cloudbase); // 同时注册 app.rdb()
window.cloudbase = cloudbase;
