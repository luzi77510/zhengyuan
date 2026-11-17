import './env.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,mkdirSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { randomBytes,scryptSync,timingSafeEqual,createHash,randomUUID } from 'node:crypto';
const path=resolve(process.env.DB_PATH||'data/zhengyuan.sqlite');mkdirSync(dirname(path),{recursive:true});
export const db=new DatabaseSync(path);
db.exec(readFileSync(new URL('./migrations/001-initial.sql',import.meta.url),'utf8'));
export const hash=t=>createHash('sha256').update(t).digest('hex');
export function passwordHash(p){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(p,salt,64).toString('hex')}`;}
export function passwordCheck(p,h){try{const [s,k]=h.split(':');return timingSafeEqual(Buffer.from(k,'hex'),scryptSync(p,s,64));}catch{return false;}}
export function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
export function normalizeVersion(id,v){
  for(let i=0;i<6;i++) db.prepare('INSERT OR IGNORE INTO dimensions VALUES (?,?)').run(`D${i+1}`,v.dimensionNames[i]);
  for(const q of v.questions){
    db.prepare('INSERT INTO questions VALUES (?,?,?,?,?,?)').run(id,q.id,q.dimension,q.position,q.text,q.enabled?1:0);
    for(const o of q.options) db.prepare('INSERT INTO options VALUES (?,?,?,?,?)').run(id,q.id,o.id,o.text,o.score);
  }
  for(const [c,t] of Object.entries(v.results)) db.prepare('INSERT INTO result_templates VALUES (?,?,?)').run(id,c,JSON.stringify(t));
}
export function seed(){
  if(db.prepare('SELECT id FROM test_versions LIMIT 1').get())return;
  const v=JSON.parse(readFileSync(new URL('./seed-data.json',import.meta.url),'utf8'));
  transaction(()=>{db.prepare('INSERT INTO test_versions VALUES (?,?,?,?,?,?)').run('v1.0','published',JSON.stringify(v),Date.now(),Date.now(),'初始化');normalizeVersion('v1.0',v);});
}
export function cleanup(){
  const cutoff=Date.now()-30*86400000;
  transaction(()=>{
    db.prepare('DELETE FROM answer_sessions WHERE started_at < ?').run(cutoff);
    db.prepare('DELETE FROM analytics_events WHERE created_at < ?').run(cutoff);
    db.prepare('DELETE FROM owners WHERE created_at < ? AND id NOT IN (SELECT owner_id FROM answer_sessions)').run(cutoff);
    db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
    db.prepare('DELETE FROM audit_logs WHERE created_at < ?').run(Date.now()-180*86400000);
  });
}
export function initAdmin(username='admin',password=randomBytes(15).toString('base64url')){
  if(db.prepare('SELECT id FROM admin_roles LIMIT 1').get())return null;
  db.prepare('INSERT INTO admin_roles VALUES (?,?,?,?,?,?)').run(randomUUID(),username,passwordHash(password),'super',1,1);return {username,password};
}
