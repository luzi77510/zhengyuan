import seed from '../server/seed-data.json';
import {createStaticApi} from './static-store';
import type {Version} from './types';
const version:Version={...seed,id:'pages-v1.0'};
version.pages.privacy='这是 GitHub Pages 静态演示版。无需注册，不收集真实姓名、手机号、生日或精确位置。\n\n答题、计分、进度、结果快照和可选昵称均在当前浏览器处理，不会提交到本项目的服务器。进度与结果通过本地存储保存，最长 30 天；打开网站时清理过期记录。清除浏览器数据后将无法恢复，结果链接也仅在生成结果的浏览器中有效。\n\n你可以点击本页“删除我的全部答题记录”立即删除本浏览器中的测试数据。海报只包含画像、分布图和公开首页二维码，不包含原始答案或私有结果链接。\n\n本演示版没有管理员登录、服务端校验或跨设备保存，也不采集访问和分享行为统计。GitHub 作为静态托管服务可能按其隐私政策处理必要的访问日志。\n\n本测试仅供娱乐与自我探索参考，不作心理诊断或未来关系预测。';
export const staticApi=createStaticApi(localStorage,version,{publicOrigin:new URL(import.meta.env.BASE_URL,location.origin).href});
