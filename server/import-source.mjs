import {readFileSync,writeFileSync} from 'node:fs';
import {dimensionNames,defaultRules} from './scoring.mjs';
const raw=readFileSync(new URL('../docs/requirements.md',import.meta.url),'utf8');
const questions=[...raw.matchAll(/\*\*Q(\d+)｜([^\n]+)\*\*\r?\n\r?\n([\s\S]*?)所属维度：(D\d)/g)].map(m=>({id:`Q${m[1]}`,position:Number(m[1]),text:m[2].trim(),dimension:m[4],enabled:true,options:[...m[3].matchAll(/- ([ABCD])\. (.+)/g)].map(x=>({id:x[1],text:x[2].trim(),score:'ABCD'.indexOf(x[1])}))}));
const results={};
for(const m of raw.matchAll(/\*\*结果 ([ABC])：([^\n]+)\*\*\r?\n\r?\n([\s\S]*?)(?=\*\*结果 |$)/g)){
  const field=k=>m[3].match(new RegExp(k+'：([^\\r\\n]+)'))?.[1]||'';
  const code=`TYPE_${m[1]}`;
  const portrait=field('画像分析');
  const summaries={A:[{heading:'性格与日常',text:'你容易被细节里的可靠打动：记得约定、及时回应、说到做到。'},{heading:'关系与节奏',text:'长期相处中，你需要的是安全感与个人空间并存。对方既能让你感到被在乎，也不会用爱之名控制你。'}],B:[{heading:'性格与吸引',text:'你容易被真诚表达、独特魅力和精神交流吸引。'},{heading:'沟通与浪漫',text:'对你而言，沟通不是汇报行程，而是彼此进入对方世界的方式；浪漫也不一定昂贵，重要的是用心与回应。'}],C:[{heading:'性格与行动',text:'你容易欣赏有责任感、有行动力、愿意持续学习的人。'},{heading:'目标与支持',text:'你重视长期目标和价值观共识，也希望彼此成为队友：既能分享成果，也能在困难时一起想办法。'}]};
  const advice={A:['给变化留一点空间，留意自己是否把“稳定”误解成“永远不能有变化”。','把期待说清楚，通过持续沟通共同建立信任，避免要求对方随时满足所有期待。'],B:['除了心动与共鸣，也留意对方在责任、稳定和现实协作中的行动。','遇到分歧时一起处理问题，把愿意沟通也视作同频的一部分。'],C:['一起规划未来，也留意别让关系变成项目管理或绩效考核。','给彼此成长的空间，留一些柔软的相处时刻，记得享受当下。']};
  results[code]={name:m[2].trim(),keywords:field('关键词').split('、'),comment:field('结果评语'),portrait:summaries[m[1]],portraitOriginal:portrait,advice:advice[m[1]],adviceOriginal:field('相处建议'),summary:field('结果总结'),illustrationAlt:{A:'月光与暖灯下，两个并肩相伴的人',B:'星轨连接两颗心，信笺与音符轻轻共鸣',C:'两人沿着并行道路向远山前行，路旁长出新芽'}[m[1]],image:''};
}
results.EASTER={name:'宇宙限定款',keywords:['直觉','坚定','自在','独特'],comment:'你有一种很稳定的恋爱直觉。比起追逐标准答案，你更相信自己真正舒服的相处方式。',portrait:[],advice:['相信自己的感受，也给了解彼此留一些空间。'],summary:'比起标准答案，你更相信真正舒服的相处方式。',illustrationAlt:'环绕信笺的星环徽章',image:''};
const v={dimensionNames,rules:defaultRules,questions,results,pages:{title:'想知道你的正缘是什么样子吗？',subtitle:'18 道题，看看什么样的人更适合与你长久相伴。',button:'开始寻找我的正缘',intro:'每个人心里，都藏着一份关于爱情的想象。有人渴望被坚定选择，有人期待灵魂同频，也有人希望两个人能一起成长、一起看更大的世界。\n\n所谓正缘，不一定是最耀眼、最完美的那个人，而是那个与你的节奏合拍、愿意理解彼此，也能让你自在做自己的人。\n\n接下来，请凭第一直觉回答 18 道小问题。没有标准答案，也不用刻意选择“正确”的选项。完成后，你将获得一份专属于你的理想伴侣画像，看看什么样的人更可能与你长久相伴。',about:'这是一份关于理想长期伴侣相处风格的娱乐性自我探索测试。18 道情境题，约需 3–5 分钟。请凭第一直觉作答，没有标准答案。\n\n选项 A/B/C/D 的基础配分为 0/1/2/3，每三题形成一个维度，六维分数均为 0–9。三类组合分用于匹配本次作答的画像。分数不代表关系能力、人格优劣或科学诊断；选项字母也没有固定的心理学含义。\n\n三类组合完全同分时默认稳稳相伴型，并提示均衡偏好；两类同分先比较核心单维最高分，再按稳稳相伴、灵魂共振、并肩成长排序。同一字母出现至少 15 次时展示“宇宙限定款”，基础类型仍然保留。\n\n测试不预测具体伴侣、婚期或现实恋爱结局。你始终可以用自己的感受理解这份结果。',privacy:'本地体验无需注册，不收集真实姓名、手机号、生日或精确位置。\n\n服务使用随机匿名身份 Cookie，保存版本、答案、结果快照、开始及完成时间、必要的访问与海报按钮事件，用于恢复体验、生成结果和聚合统计。可选昵称只用于浏览器海报生成，不上传服务器。\n\n原始会话、答案、结果及对应事件自开始起保存 30 天；服务启动及每小时自动清理。浏览器进度同样最多保存 30 天。管理员会话 8 小时过期，管理操作日志保存 180 天。本地数据库位于项目 data 文件夹，数据仅在此服务保存。\n\n你可以通过本页“删除我的全部答题记录”立即删除当前设备匿名身份对应的服务端记录与本地进度。删除后历史链接失效。清除身份 Cookie 可能导致无法再验证旧记录的所有权，剩余记录会按期清理。\n\n这份预览仅供本机使用。正式上线前，运营方需要填写实际联系方式、配置 HTTPS 和域名，并按部署说明保护数据。'}};
if(questions.length!==18)throw new Error('题库解析失败');
writeFileSync(new URL('./seed-data.json',import.meta.url),JSON.stringify(v,null,2));console.log('已逐字导入 18 道题及三类结果原文。');
