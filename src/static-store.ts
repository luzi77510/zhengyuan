import {calculate} from '../server/scoring.mjs';
import type {Result,Version} from './types';

const KEY='zhengyuan-pages-demo-v1';
const TTL=30*86400000;
type Session={id:string;versionId:string;version:Version;startedAt:number;idempotencyKey:string;resultId?:string};
type State={sessions:Record<string,Session>;results:Record<string,Result>};
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;

/** Explicit browser-only demo adapter. Never used by the full-stack build. */
export function createStaticApi(storage:StorageLike,initialVersion:Version,options:{publicOrigin:string;now?:()=>number;uuid?:()=>string}){
 const now=options.now||Date.now,uuid=options.uuid||(()=>crypto.randomUUID());
 function read():State{
  let state:State={sessions:{},results:{}};
  try{const saved=JSON.parse(storage.getItem(KEY)||'null');if(saved&&typeof saved.sessions==='object'&&saved.sessions&&typeof saved.results==='object'&&saved.results)state=saved;}catch{storage.removeItem(KEY);}
  for(const [id,s] of Object.entries(state.sessions))if(!s||!Number.isFinite(s.startedAt)||s.startedAt+TTL<=now())delete state.sessions[id];
  const active=new Set(Object.values(state.sessions).map(s=>s.resultId).filter(Boolean));
  for(const id of Object.keys(state.results))if(!active.has(id))delete state.results[id];
  write(state);return state;
 }
 function write(state:State){try{storage.setItem(KEY,JSON.stringify(state));}catch{throw new Error('浏览器无法保存演示记录。请允许本站本地存储，或释放空间后重试。');}}
 return async function staticApi(path:string,method='GET',body:Record<string,any>={}):Promise<any>{
  if(path.startsWith('/admin'))throw new Error('GitHub Pages 演示版未接入管理后台，请使用 Node 服务版本。');
  const state=read();
  if(path==='/bootstrap'&&method==='GET')return {version:structuredClone(initialVersion),publicOrigin:options.publicOrigin.replace(/\/$/,''),contact:'',localPreview:/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(options.publicOrigin),staticDemo:true};
  if(path==='/sessions'&&method==='POST'){
   if(typeof body.idempotency_key!=='string'||!/^[\w-]{16,80}$/.test(body.idempotency_key))throw new Error('会话标识无效。');
   const prior=Object.values(state.sessions).find(s=>s.idempotencyKey===body.idempotency_key);
   if(prior)return structuredClone(prior);
   const id=uuid(),session:Session={id,versionId:initialVersion.id||'pages-v1.0',version:structuredClone(initialVersion),startedAt:now(),idempotencyKey:body.idempotency_key};
   state.sessions[id]=session;write(state);return structuredClone(session);
  }
  const sessionPath=path.match(/^\/sessions\/([^/]+)(\/submit)?$/);
  if(sessionPath){
   const session=state.sessions[sessionPath[1]];
   if(!session)throw Object.assign(new Error('演示记录不存在或已过期，请重新开始。'),{status:404});
   if(!sessionPath[2]&&method==='GET')return structuredClone(session);
   if(sessionPath[2]&&method==='POST'){
    const score=calculate(session.version,body.answers);
    if(session.resultId)return structuredClone(state.results[session.resultId]);
    const id=uuid(),result:Result={id,...score,versionId:session.versionId,createdAt:now(),expiresAt:session.startedAt+TTL,template:structuredClone(session.version.results[score.base_result_code]),displayTemplate:structuredClone(session.version.results[score.display_result_code]),dimensionNames:[...session.version.dimensionNames]};
    state.results[id]=result;session.resultId=id;write(state);return structuredClone(result);
   }
  }
  const resultPath=path.match(/^\/results\/([^/]+)$/);
  if(resultPath&&method==='GET'){
   const result=state.results[resultPath[1]];
   if(!result)throw Object.assign(new Error('演示结果仅保存在生成它的浏览器中，可能已过期或被清除。'),{status:404});
   return structuredClone(result);
  }
  if(path==='/my-data'&&method==='DELETE'){storage.removeItem(KEY);return {ok:true};}
  // No visitor collection, fake statistics or pretend server-side analytics.
  if(path==='/events'&&method==='POST')return {ok:true,recorded:false};
  throw new Error('演示模式暂不支持此操作。');
 };
}
