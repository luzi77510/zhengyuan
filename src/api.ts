export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
export const STATIC_DEMO=import.meta.env.VITE_STATIC_DEMO==='true';
export const PROGRESS_KEY=STATIC_DEMO?'zhengyuan-pages-progress-v1':'zhengyuan-progress-v1';
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
 if(STATIC_DEMO){
  const {staticApi}=await import('./static-api');
  try{return await staticApi(path,options.method||'GET',options.body?JSON.parse(String(options.body)):{});}catch(e){if((e as {status?:number}).status)throw new ApiError((e as Error).message,(e as {status:number}).status);throw e;}
 }
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),15000);
 try{const res=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...options.headers},signal:control.signal,credentials:'same-origin'});const data=await res.json();if(!res.ok)throw new ApiError(data.error||'请求失败，请重试。',res.status);return data;}
 catch(e){if(e instanceof ApiError)throw e;throw new Error(navigator.onLine?'请求超时或服务暂时不可用，请重试。':'网络已断开，答案已在本机保留，请连接网络后重试。');}finally{clearTimeout(timer);}
}
export const post=<T=any>(path:string,body:unknown={})=>api<T>(path,{method:'POST',body:JSON.stringify(body)});
export function readProgress(){try{const p=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null');if(!p)return null;if(typeof p.id!=='string'||typeof p.versionId!=='string'||!Number.isFinite(p.startedAt)||Date.now()-p.startedAt>30*86400000||!Number.isInteger(p.current)||p.current<0||p.current>17||!p.answers||Object.keys(p.answers).some(k=>!/^Q([1-9]|1[0-8])$/.test(k)||!['A','B','C','D'].includes(p.answers[k]))){localStorage.removeItem(PROGRESS_KEY);sessionStorage.setItem('zy-expired','1');return null;}return p;}catch{localStorage.removeItem(PROGRESS_KEY);return null;}}
export function saveProgress(p:unknown){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(p));}catch{ /* 页面仍可作答；由调用方提示。 */ }}
