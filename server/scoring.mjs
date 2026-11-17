export const dimensionNames = ['情绪安全感','沟通共鸣度','价值观契合度','共同成长力','浪漫吸引力','边界与自由度'];
export const defaultRules = {groups:{TYPE_A:['D1','D6'],TYPE_B:['D2','D5'],TYPE_C:['D3','D4']},priority:['TYPE_A','TYPE_B','TYPE_C'],balancedDefault:'TYPE_A',easterEnabled:true,easterThreshold:15};
export function validateVersion(v) {
  const errors=[];
  if(!v || !Array.isArray(v.questions) || v.questions.length!==18) errors.push('发布必须恰好包含 18 道题。');
  const counts={};
  for(const [i,q] of (v?.questions||[]).entries()){
    if(q.id!==`Q${i+1}` || q.position!==i+1 || !q.enabled) errors.push(`第 ${i+1} 题必须按 Q1–Q18 顺序启用。`);
    if(typeof q.text!=='string'||!q.text.trim()||q.text.length>500) errors.push(`${q.id} 题干无效。`);
    counts[q.dimension]=(counts[q.dimension]||0)+1;
    if(q.dimension!==`D${Math.floor(i/3)+1}`) errors.push(`${q.id} 的所属维度与规定题序不符。`);
    if(!Array.isArray(q.options)||q.options.length!==4||q.options.some((o,j)=>o.id!=='ABCD'[j]||!o.text?.trim()||o.text.length>500||o.score!==j)) errors.push(`${q.id} 须有 A/B/C/D 四项，配分依次为 0/1/2/3。`);
  }
  for(let i=1;i<=6;i++) if(counts[`D${i}`]!==3) errors.push(`D${i} 必须有三题。`);
  const r=v?.rules;
  const codes=['TYPE_A','TYPE_B','TYPE_C'];
  if(!r||codes.some(c=>!Array.isArray(r.groups?.[c])||r.groups[c].length!==2)||new Set(codes.flatMap(c=>r.groups?.[c]||[])).size!==6||codes.flatMap(c=>r.groups?.[c]||[]).some(d=>!/^D[1-6]$/.test(d))) errors.push('三类组合各须有两个维度，六维各使用一次。');
  if(!r||!Array.isArray(r.priority)||r.priority.length!==3||codes.some(c=>!r.priority.includes(c))||!codes.includes(r.balancedDefault)) errors.push('同分优先级或完全同分默认类型无效。');
  if(!Number.isInteger(r?.easterThreshold)||r.easterThreshold<1||r.easterThreshold>18||typeof r?.easterEnabled!=='boolean') errors.push('彩蛋阈值应为 1–18 的整数。');
  for(const c of [...codes,'EASTER']){
    const t=v?.results?.[c];
    if(!t||!t.name?.trim()||t.name.length>30||!Array.isArray(t.keywords)||t.keywords.length!==4||t.keywords.some(k=>typeof k!=='string'||!k.trim()||k.length>12)||!t.comment?.trim()||!t.summary?.trim()||!Array.isArray(t.advice)||!t.advice.length||t.advice.some(a=>typeof a!=='string'||!a.trim())||!Array.isArray(t.portrait)||t.portrait.some(p=>!p.heading?.trim()||!p.text?.trim())||!t.illustrationAlt?.trim()) errors.push(`${c} 的文案不完整。`);
  }
  if(!v?.pages?.title?.trim()||v.pages.title.length>70||!v.pages.button?.trim()||!v.pages.intro?.trim()||!v.pages.about?.trim()||!v.pages.privacy?.trim()) errors.push('首页、说明和隐私文案不能为空。');
  for(const t of Object.values(v?.results||{})) if(t.image && !/^\/uploads\/[a-zA-Z0-9-]+\.(png|jpg|webp)$/.test(t.image)) errors.push('图片须由受控上传接口提供。');
  return [...new Set(errors)];
}
export function validateAnswers(questions,answers){
  if(!Array.isArray(answers)||answers.length!==18) throw new Error('请完整回答 18 道题。');
  const ids=new Set();
  return answers.map(a=>{
    if(!a || ids.has(a.question_id)) throw new Error('题号重复或答案无效。');
    ids.add(a.question_id);
    const q=questions.find(q=>q.id===a.question_id);
    const o=q?.options.find(o=>o.id===a.option_id);
    if(!q||!q.enabled||!o) throw new Error('题目或选项无效，请重新检查。');
    return {question_id:q.id,option_id:o.id,score:o.score,dimension:q.dimension};
  });
}
export function decideType(dimensions,rules=defaultRules){
  const combos=Object.fromEntries(Object.entries(rules.groups).map(([c,ds])=>[c,ds.reduce((n,d)=>n+dimensions[Number(d.slice(1))-1],0)]));
  const balanced=new Set(Object.values(combos)).size===1;
  const high=Math.max(...Object.values(combos));
  let candidates=Object.keys(combos).filter(c=>combos[c]===high);
  if(balanced) return {base_result_code:rules.balancedDefault,balanced,combos};
  if(candidates.length>1){
    const peak=c=>Math.max(...rules.groups[c].map(d=>dimensions[Number(d.slice(1))-1]));
    const max=Math.max(...candidates.map(peak));candidates=candidates.filter(c=>peak(c)===max);
  }
  return {base_result_code:rules.priority.find(c=>candidates.includes(c)),balanced,combos};
}
export function calculate(version,answers){
  const validated=validateAnswers(version.questions,answers);
  const dimensions=Array(6).fill(0),letters={A:0,B:0,C:0,D:0};
  for(const a of validated){dimensions[Number(a.dimension.slice(1))-1]+=a.score;letters[a.option_id]++;}
  const chosen=decideType(dimensions,version.rules);
  const is_easter_egg=version.rules.easterEnabled&&Math.max(...Object.values(letters))>=version.rules.easterThreshold;
  return {...chosen,dimensions,is_easter_egg,display_result_code:is_easter_egg?'EASTER':chosen.base_result_code};
}
