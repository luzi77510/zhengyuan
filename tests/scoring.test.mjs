import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,decideType,validateVersion,validateAnswers} from '../server/scoring.mjs';
const v=JSON.parse(readFileSync(new URL('../server/seed-data.json',import.meta.url),'utf8'));
const answers=letters=>Array.from(letters).map((c,i)=>({question_id:'Q'+(i+1),option_id:c}));
const byDimensions=ds=>ds.flatMap(n=>{const a=[];for(let i=0;i<3;i++){const k=Math.min(3,n);a.push('ABCD'[k]);n-=k;}return a;}).join('');
test('真实初始化数据满足严格发布校验',()=>assert.deepEqual(validateVersion(v),[]));
test('18 题、72 选项与提供的规范逐字相同',()=>{
 const md=readFileSync(new URL('../docs/requirements.md',import.meta.url),'utf8');
 for(const q of v.questions){assert.ok(md.includes(`**${q.id}｜${q.text}**`));for(const o of q.options)assert.ok(md.includes(`- ${o.id}. ${o.text}`));}
 for(const c of ['TYPE_A','TYPE_B','TYPE_C'])for(const key of ['comment','portraitOriginal','adviceOriginal','summary'])assert.ok(md.includes(v.results[c][key]));
});
for(const letter of ['A','D'])test(`全 ${letter} 的均衡与彩蛋规则`,()=>{const r=calculate(v,answers(letter.repeat(18)));assert.deepEqual(r.dimensions,Array(6).fill(letter==='A'?0:9));assert.equal(r.base_result_code,'TYPE_A');assert.equal(r.balanced,true);assert.equal(r.display_result_code,'EASTER');});
for(const [ds,expected] of [[[0,3,3,3,3,6],'TYPE_A'],[[5,4,1,1,2,1],'TYPE_A'],[[2,6,1,1,0,4],'TYPE_B'],[[3,3,1,1,3,3],'TYPE_A']])test(`六维 [${ds}] 正确判定 ${expected}`,()=>{const r=calculate(v,answers(byDimensions(ds)));assert.deepEqual(r.dimensions,ds);assert.equal(r.base_result_code,expected);});
test('完全同分分支先于单维最大值比较',()=>assert.equal(decideType([0,3,3,3,3,6]).balanced,true));
test('14 次不触发，15 次触发，完整 18 题边界',()=>{assert.equal(calculate(v,answers('A'.repeat(14)+'BCDB')).is_easter_egg,false);assert.equal(calculate(v,answers('A'.repeat(15)+'BCD')).is_easter_egg,true);});
test('缺题、多题、重复题和非法选项均被拒绝',()=>{const a=answers('A'.repeat(18));for(const bad of [a.slice(1),[...a,a[0]],[...a.slice(1),a[1]],[{question_id:'Q1',option_id:'X'},...a.slice(1)]])assert.throws(()=>validateAnswers(v.questions,bad));});
test('停用、错误配分与重复维度不能发布',()=>{for(const mutate of [x=>x.questions[0].enabled=false,x=>x.questions[0].options[0].score=8,x=>x.rules.groups.TYPE_A=['D1','D1']]){const x=structuredClone(v);mutate(x);assert.ok(validateVersion(x).length);}});
