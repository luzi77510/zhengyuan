import './env.mjs';
import express from 'express';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {db,hash,seed,cleanup,transaction,normalizeVersion,passwordHash,passwordCheck} from './db.mjs';
import {calculate,validateVersion,validateAnswers} from './scoring.mjs';
seed();cleanup();setInterval(cleanup,3600000).unref();
const app=express(),port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const production=process.argv.includes('--production');
const secure=process.env.COOKIE_SECURE==='true';
const publicOrigin=process.env.PUBLIC_ORIGIN?.replace(/\/$/,'');
const cookieOptions=`Path=/; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;
const fail=(status,message)=>Object.assign(new Error(message),{status});
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')));
const rateBuckets=new Map();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});
  if(req.path.startsWith('/api'))res.set('Cache-Control','no-store');
  if(['POST','PUT','DELETE','PATCH'].includes(req.method)){
    const origin=req.headers.origin;
    const allowed=[publicOrigin,`http://localhost:${port}`,`http://127.0.0.1:${port}`].filter(Boolean);
    if(origin&&!allowed.includes(origin))return next(fail(403,'来源校验失败，请从本站重试。'));
    const key=`${req.socket.remoteAddress}:${req.path.includes('login')?'login':'api'}`,now=Date.now();
    let b=rateBuckets.get(key);if(!b||now-b.start>60000){b={start:now,n:0};rateBuckets.set(key,b);}b.n++;
    if(b.n>(req.path.includes('login')?10:150))return next(fail(429,'操作过于频繁，请稍后再试。'));
    if(rateBuckets.size>10000)for(const [k,v]of rateBuckets)if(now-v.start>60000)rateBuckets.delete(k);
  }next();
});
app.use(express.json({limit:'3mb'}));
app.use('/api',(req,res,next)=>{
  let token=cookies(req).zy_owner;
  let owner=token&&db.prepare('SELECT id FROM owners WHERE token_hash=?').get(hash(token));
  if(!owner){token=randomBytes(32).toString('base64url');owner={id:randomUUID()};db.prepare('INSERT INTO owners VALUES (?,?,?)').run(owner.id,hash(token),Date.now());res.append('Set-Cookie',`zy_owner=${token}; ${cookieOptions}; Max-Age=2592000`);}
  req.ownerId=owner.id;next();
});
const getPublished=()=>{const v=db.prepare("SELECT * FROM test_versions WHERE status='published'").get();return {...JSON.parse(v.snapshot),id:v.id};};
const getSession=(req,id)=>{
  const s=db.prepare('SELECT * FROM answer_sessions WHERE id=? AND owner_id=?').get(id,req.ownerId);
  if(!s||s.started_at<Date.now()-30*86400000)throw fail(404,'记录不存在、已过期或不属于当前设备。');return s;
};
const event=(owner,version,kind,key,session=null)=>db.prepare('INSERT OR IGNORE INTO analytics_events(owner_id,session_id,version_id,kind,dedup_key,created_at) VALUES (?,?,?,?,?,?)').run(owner,session,version,kind,key,Date.now());
app.get('/api/bootstrap',(req,res)=>{const v=getPublished();event(req.ownerId,v.id,'visit',`visit:${req.ownerId}:${v.id}`);res.json({version:v,publicOrigin:publicOrigin||`http://localhost:${port}`,contact:process.env.CONTACT_EMAIL||'',localPreview:!publicOrigin||/localhost|127\.0\.0\.1/.test(publicOrigin)});});
app.post('/api/sessions',(req,res)=>{
  const key=req.body.idempotency_key;
  if(typeof key!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(key))throw fail(400,'会话标识无效。');
  const old=db.prepare('SELECT * FROM answer_sessions WHERE idempotency_key=? AND owner_id=?').get(key,req.ownerId);
  if(old)return res.json({id:old.id,version:JSON.parse(db.prepare('SELECT snapshot FROM test_versions WHERE id=?').get(old.version_id).snapshot),versionId:old.version_id,startedAt:old.started_at});
  const v=getPublished(),id=randomUUID(),startedAt=Date.now();
  transaction(()=>{db.prepare('INSERT INTO answer_sessions(id,owner_id,version_id,started_at,idempotency_key) VALUES (?,?,?,?,?)').run(id,req.ownerId,v.id,startedAt,key);event(req.ownerId,v.id,'visit',`visit:${req.ownerId}:${v.id}`);event(req.ownerId,v.id,'start',`start:${id}`,id);});
  res.status(201).json({id,version:v,versionId:v.id,startedAt});
});
app.get('/api/sessions/:id',(req,res)=>{const s=getSession(req,req.params.id);res.json({id:s.id,versionId:s.version_id,version:JSON.parse(db.prepare('SELECT snapshot FROM test_versions WHERE id=?').get(s.version_id).snapshot),startedAt:s.started_at,resultId:db.prepare('SELECT id FROM result_snapshots WHERE session_id=?').get(s.id)?.id});});
app.post('/api/sessions/:id/submit',(req,res)=>{
  const s=getSession(req,req.params.id),v=JSON.parse(db.prepare('SELECT snapshot FROM test_versions WHERE id=?').get(s.version_id).snapshot);
  let answers;try{answers=validateAnswers(v.questions,req.body.answers);}catch(e){throw fail(400,e.message);}
  const r=transaction(()=>{
    const prior=db.prepare('SELECT id,snapshot FROM result_snapshots WHERE session_id=?').get(s.id);if(prior)return {id:prior.id,...JSON.parse(prior.snapshot)};
    const score=calculate(v,req.body.answers),id=randomBytes(24).toString('base64url'),now=Date.now();
    const snapshot={...score,versionId:s.version_id,createdAt:now,expiresAt:s.started_at+30*86400000,template:v.results[score.base_result_code],displayTemplate:v.results[score.display_result_code],dimensionNames:v.dimensionNames};
    for(const a of answers)db.prepare('INSERT INTO answers VALUES (?,?,?,?)').run(s.id,a.question_id,a.option_id,a.score);
    db.prepare('INSERT INTO result_snapshots VALUES (?,?,?,?)').run(id,s.id,JSON.stringify(snapshot),now);
    db.prepare("UPDATE answer_sessions SET completed_at=?,status='completed' WHERE id=?").run(now,s.id);
    event(req.ownerId,s.version_id,'complete',`complete:${s.id}`,s.id);return {id,...snapshot};
  });res.json(r);
});
app.get('/api/results/:id',(req,res)=>{
  const r=db.prepare('SELECT r.*,s.owner_id,s.started_at FROM result_snapshots r JOIN answer_sessions s ON r.session_id=s.id WHERE r.id=? AND s.owner_id=?').get(req.params.id,req.ownerId);
  if(!r||r.started_at<Date.now()-30*86400000)throw fail(404,'结果不存在、已过期或不属于当前设备。');res.json({id:r.id,...JSON.parse(r.snapshot)});
});
app.post('/api/events',(req,res)=>{
  const {result_id,kind,event_id}=req.body;
  if(!['poster_success','share_click'].includes(kind)||!/^[-a-zA-Z0-9]{16,80}$/.test(event_id||''))throw fail(400,'事件无效。');
  const r=db.prepare('SELECT s.* FROM result_snapshots r JOIN answer_sessions s ON r.session_id=s.id WHERE r.id=? AND s.owner_id=?').get(result_id,req.ownerId);
  if(!r)throw fail(404,'结果不可用。');event(req.ownerId,r.version_id,kind,`${kind}:${event_id}`,r.id);res.json({ok:true});
});
app.delete('/api/my-data',(req,res)=>{transaction(()=>db.prepare('DELETE FROM owners WHERE id=?').run(req.ownerId));res.append('Set-Cookie',`zy_owner=; ${cookieOptions}; Max-Age=0`);res.json({ok:true});});
const audit=(req,action,detail='')=>db.prepare('INSERT INTO audit_logs(admin_id,username,action,detail,created_at) VALUES (?,?,?,?,?)').run(req.admin.id,req.admin.username,action,String(detail).slice(0,500),Date.now());
function requireAdmin(req,res,next){const t=cookies(req).zy_admin;const a=t&&db.prepare('SELECT a.* FROM admin_sessions s JOIN admin_roles a ON s.admin_id=a.id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1').get(hash(t),Date.now());if(!a)return next(fail(401,'管理员登录已过期，请重新登录。'));req.admin=a;next();}
const roles=(...r)=>(req,res,next)=>r.includes(req.admin.role)?next():next(fail(403,'当前账号没有此操作权限。'));
const safeAdmin=a=>({id:a.id,username:a.username,role:a.role,can_export_details:!!a.can_export_details,active:!!a.active});
app.post('/api/admin/login',(req,res)=>{
  const {username,password}=req.body;
  const a=typeof username==='string'&&db.prepare('SELECT * FROM admin_roles WHERE username=? AND active=1').get(username);
  if(!a||typeof password!=='string'||password.length>200||!passwordCheck(password,a.password_hash))throw fail(401,'账号或密码不正确。');
  const t=randomBytes(32).toString('base64url');db.prepare('INSERT INTO admin_sessions VALUES (?,?,?)').run(hash(t),a.id,Date.now()+8*3600000);res.append('Set-Cookie',`zy_admin=${t}; ${cookieOptions}; Max-Age=28800`);req.admin=a;audit(req,'登录');res.json(safeAdmin(a));
});
app.use('/api/admin',requireAdmin);
app.get('/api/admin/me',(req,res)=>res.json(safeAdmin(req.admin)));
app.post('/api/admin/logout',(req,res)=>{db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hash(cookies(req).zy_admin||''));res.append('Set-Cookie',`zy_admin=; ${cookieOptions}; Max-Age=0`);res.json({ok:true});});
app.get('/api/admin/versions',(req,res)=>res.json(db.prepare('SELECT id,status,created_at,published_at,operator FROM test_versions ORDER BY created_at DESC').all()));
app.get('/api/admin/draft',roles('super','editor'),(req,res)=>{const d=db.prepare("SELECT * FROM test_versions WHERE status='draft' ORDER BY created_at DESC LIMIT 1").get();const p=getPublished();res.json(d?{id:d.id,snapshot:JSON.parse(d.snapshot)}:{id:null,snapshot:p});});
app.put('/api/admin/draft',roles('super','editor'),(req,res)=>{
  const {section,value}=req.body;
  if(!['questions','results','rules','pages'].includes(section))throw fail(400,'保存模块无效。');
  if(section==='rules'&&req.admin.role!=='super')throw fail(403,'只有超级管理员可以修改规则。');
  if(JSON.stringify(value).length>150000)throw fail(400,'草稿过大。');
  const d=db.prepare("SELECT * FROM test_versions WHERE status='draft' LIMIT 1").get();const v=d?JSON.parse(d.snapshot):getPublished();v[section]=value;
  const id=d?.id||`draft-${randomUUID().slice(0,8)}`;
  if(d)db.prepare('UPDATE test_versions SET snapshot=?,operator=? WHERE id=?').run(JSON.stringify(v),req.admin.username,id);
  else db.prepare('INSERT INTO test_versions VALUES (?,?,?,?,?,?)').run(id,'draft',JSON.stringify(v),Date.now(),null,req.admin.username);
  audit(req,'保存草稿',section);res.json({id,snapshot:v,errors:validateVersion(v)});
});
app.post('/api/admin/validate',roles('super','editor'),(req,res)=>{const d=db.prepare("SELECT snapshot FROM test_versions WHERE status='draft' LIMIT 1").get();const v=d?JSON.parse(d.snapshot):getPublished();res.json({errors:validateVersion(v)});});
app.post('/api/admin/try-score',roles('super'),(req,res)=>{const d=db.prepare("SELECT snapshot FROM test_versions WHERE status='draft' LIMIT 1").get();const v=d?JSON.parse(d.snapshot):getPublished();const errors=validateVersion(v);if(errors.length)throw fail(400,errors.join(' '));try{res.json(calculate(v,req.body.answers));}catch(e){throw fail(400,e.message);}});
app.post('/api/admin/publish',roles('super'),(req,res)=>{
  const d=db.prepare("SELECT * FROM test_versions WHERE status='draft' LIMIT 1").get();if(!d)throw fail(400,'请先保存草稿。');const v=JSON.parse(d.snapshot),errors=validateVersion(v);if(errors.length)throw fail(400,errors.join(' '));
  const id=`v${Date.now()}`;transaction(()=>{db.prepare("UPDATE test_versions SET status='archived' WHERE status='published'").run();db.prepare("UPDATE test_versions SET status='archived' WHERE id=?").run(d.id);db.prepare('INSERT INTO test_versions VALUES (?,?,?,?,?,?)').run(id,'published',JSON.stringify(v),Date.now(),Date.now(),req.admin.username);normalizeVersion(id,v);audit(req,'发布版本',id);});res.json({id});
});
app.post('/api/admin/rollback',roles('super'),(req,res)=>{
  const v=db.prepare("SELECT * FROM test_versions WHERE id=? AND status='archived' AND published_at IS NOT NULL").get(req.body.id);if(!v)throw fail(400,'可回滚的版本不存在。');
  transaction(()=>{db.prepare("UPDATE test_versions SET status='archived' WHERE status='published'").run();db.prepare("UPDATE test_versions SET status='published' WHERE id=?").run(v.id);audit(req,'回滚版本',v.id);});res.json({ok:true});
});
app.post('/api/admin/upload',roles('super','editor'),(req,res)=>{
  const {data,alt}=req.body;if(typeof data!=='string'||typeof alt!=='string'||!alt.trim()||alt.length>150)throw fail(400,'请上传图片并填写替代文字。');
  const m=data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw fail(400,'仅支持 PNG、JPEG、WebP 图片。');const b=Buffer.from(m[2],'base64');
  const valid=m[1]==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  if(b.length>2*1024*1024||b.length<20||!valid)throw fail(400,'图片格式无效或超过 2MB。');
  mkdirSync('data/uploads',{recursive:true});const file=`${randomUUID()}.${m[1]==='jpeg'?'jpg':m[1]}`;writeFileSync(resolve('data/uploads',file),b);audit(req,'上传图片',file);res.json({url:`/uploads/${file}`,alt});
});
app.get('/api/admin/accounts',roles('super'),(req,res)=>res.json(db.prepare('SELECT id,username,role,can_export_details,active FROM admin_roles').all().map(safeAdmin)));
app.post('/api/admin/accounts',roles('super'),(req,res)=>{
  const {id,username,password,role,can_export_details,active=true}=req.body;
  if(typeof username!=='string'||!/^[a-zA-Z0-9_-]{3,40}$/.test(username)||!['super','editor','viewer'].includes(role))throw fail(400,'账号需 3–40 位字母、数字或下划线，角色必须有效。');
  if(password&&(typeof password!=='string'||password.length<12||password.length>128))throw fail(400,'密码需要 12–128 个字符。');
  const old=id&&db.prepare('SELECT * FROM admin_roles WHERE id=?').get(id);
  if(id&&!old)throw fail(404,'账号不存在。');
  if(old?.role==='super'&&(role!=='super'||!active)&&db.prepare("SELECT COUNT(*) n FROM admin_roles WHERE role='super' AND active=1").get().n<=1)throw fail(400,'须至少保留一位有效超级管理员。');
  if(!old&&!password)throw fail(400,'新账号必须设置密码。');
  try{if(old){db.prepare('UPDATE admin_roles SET username=?,password_hash=?,role=?,can_export_details=?,active=? WHERE id=?').run(username,password?passwordHash(password):old.password_hash,role,can_export_details?1:0,active?1:0,id);if(password||role!==old.role||!active)db.prepare('DELETE FROM admin_sessions WHERE admin_id=?').run(id);}else db.prepare('INSERT INTO admin_roles VALUES (?,?,?,?,?,?)').run(randomUUID(),username,passwordHash(password),role,can_export_details?1:0,active?1:0);}catch(e){if(e.code?.includes('CONSTRAINT'))throw fail(400,'账号名已存在。');throw e;}
  audit(req,old?'修改账号':'创建账号',username);res.json({ok:true});
});
app.get('/api/admin/logs',roles('super'),(req,res)=>res.json(db.prepare('SELECT username,action,detail,created_at FROM audit_logs ORDER BY id DESC LIMIT 200').all()));
function statistics(query){
  const from=query.from?Date.parse(`${query.from}T00:00:00+08:00`):Date.now()-30*86400000;
  const to=query.to?Date.parse(`${query.to}T23:59:59.999+08:00`):Date.now();
  if(!Number.isFinite(from)||!Number.isFinite(to)||from>to)throw fail(400,'日期范围无效。');
  const version=typeof query.version==='string'?query.version:'';
  const events=db.prepare('SELECT * FROM analytics_events WHERE created_at BETWEEN ? AND ? AND (?=\'\' OR version_id=?)').all(from,to,version,version);
  const visitors=new Set(events.filter(e=>e.kind==='visit').map(e=>`${e.owner_id}:${e.version_id}`));
  const cohort=events.filter(e=>visitors.has(`${e.owner_id}:${e.version_id}`));
  const sessions=db.prepare('SELECT s.*,r.snapshot FROM answer_sessions s LEFT JOIN result_snapshots r ON r.session_id=s.id WHERE s.started_at BETWEEN ? AND ? AND (?=\'\' OR s.version_id=?)').all(from,to,version,version).filter(s=>visitors.has(`${s.owner_id}:${s.version_id}`));
  const completed=sessions.filter(s=>s.completed_at&&s.completed_at<=to),visitorPeople=new Set(cohort.filter(e=>e.kind==='visit').map(e=>e.owner_id)).size,startPeople=new Set(sessions.map(s=>s.owner_id)).size,completePeople=new Set(completed.map(s=>s.owner_id)).size;
  const distribution={TYPE_A:0,TYPE_B:0,TYPE_C:0},means=Array(6).fill(0);let eggs=0;
  for(const s of completed){const r=JSON.parse(s.snapshot);distribution[r.base_result_code]++;if(r.is_easter_egg)eggs++;r.dimensions.forEach((n,i)=>means[i]+=n);}
  return {visitors:visitorPeople,starts:startPeople,completions:completePeople,startRate:visitorPeople?startPeople/visitorPeople:null,completionRate:startPeople?completePeople/startPeople:null,sessionCount:sessions.length,completedSessions:completed.length,averageMs:completed.length?completed.reduce((n,s)=>n+s.completed_at-s.started_at,0)/completed.length:null,distribution,eggRate:completed.length?eggs/completed.length:null,dimensionMeans:means.map(n=>completed.length?n/completed.length:null),posterSuccess:cohort.filter(e=>e.kind==='poster_success').length,shareClicks:cohort.filter(e=>e.kind==='share_click').length,from,to,version,details:completed};
}
app.get('/api/admin/stats',(req,res)=>{const {details,...data}=statistics(req.query);res.json(data);});
const safeCsv=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
app.get('/api/admin/export-preview',(req,res)=>{
  const detail=req.query.detail==='true';if(detail&&req.admin.role!=='super'&&!req.admin.can_export_details)throw fail(403,'明细导出需要单独授权。');if(!detail&&req.admin.role!=='super')throw fail(403,'当前角色无导出权限。');
  const s=statistics(req.query);res.json({count:detail?s.details.length:14,fields:detail?['version','started_at','completed_at','base_result_code','is_easter_egg']:['metric','value']});
});
app.get('/api/admin/export',(req,res)=>{
  const detail=req.query.detail==='true';if(detail&&req.admin.role!=='super'&&!req.admin.can_export_details)throw fail(403,'明细导出需要单独授权。');if(!detail&&req.admin.role!=='super')throw fail(403,'当前角色无导出权限。');
  const s=statistics(req.query);let fields=detail?['version','started_at','completed_at','base_result_code','is_easter_egg']:['metric','value'];
  if(req.query.fields){const chosen=String(req.query.fields).split(',');if(chosen.some(f=>!fields.includes(f))||!chosen.length)throw fail(400,'导出字段无效。');fields=chosen;}
  let rows=detail?s.details.map(d=>({version:d.version_id,started_at:new Date(d.started_at).toISOString(),completed_at:new Date(d.completed_at).toISOString(),...JSON.parse(d.snapshot)})):Object.entries(s).filter(([k])=>['visitors','starts','completions','startRate','completionRate','sessionCount','completedSessions','averageMs','eggRate','posterSuccess','shareClicks'].includes(k)).map(([metric,value])=>({metric,value}));
  if(!detail)rows.push(...Object.entries(s.distribution).map(([metric,value])=>({metric,value})));
  audit(req,detail?'导出授权明细':'导出聚合统计',`版本 ${s.version||'全部'}，${rows.length} 行`);
  res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="zhengyuan-statistics.csv"'}).send('\uFEFF'+[fields,...rows.map(r=>fields.map(f=>r[f]))].map(r=>r.map(safeCsv).join(',')).join('\r\n'));
});
app.use('/api',(req,res)=>res.status(404).json({error:'接口不存在。'}));
app.use('/uploads',express.static(resolve('data/uploads'),{dotfiles:'deny',immutable:true,maxAge:'30d'}));
if(production){
  if(!existsSync('dist/index.html'))throw new Error('请先运行 pnpm build。');
  app.use(express.static(resolve('dist')));app.get('/{*path}',(req,res)=>res.sendFile(resolve('dist/index.html')));
}else{
  const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
}
app.use((err,req,res,next)=>{if(res.headersSent)return next(err);const status=err.status||500;if(status>=500)console.error('服务端错误：',err.message);res.status(status).json({error:status>=500?'服务暂时不可用，答案仍保留，请重试。':err.message});});
const server=app.listen(port,host,()=>console.log(`正缘画像已启动：http://localhost:${port}\n数据库：${resolve(process.env.DB_PATH||'data/zhengyuan.sqlite')}\n模式：${production?'生产构建':'本地开发预览'}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被占用，可在 .env 修改 PORT。`:e.message);process.exit(1);});
