import {initAdmin} from './db.mjs';
import {writeFileSync} from 'node:fs';
const a=initAdmin(process.argv[2]||'admin',process.argv[3]);
if(a){writeFileSync('first-login.txt',`本机管理员账号（请妥善保管，不要提交到版本库）\n登录地址：http://localhost:4173/admin/login\n账号：${a.username}\n密码：${a.password}\n\n使用后台“账号权限”修改密码。此文件仅供本机初次登录。\n`);console.log('管理员已初始化。凭据保存在 first-login.txt。');}else console.log('已有管理员，不覆盖现有账号。');
