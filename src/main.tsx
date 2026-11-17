import React,{createContext,useContext,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,HashRouter,Routes,Route,Link,NavLink,useLocation} from 'react-router-dom';
import {Mail,ArrowUpRight,Heart,ShieldCheck} from 'lucide-react';
import type {Version} from './types';
import {api,PROGRESS_KEY,STATIC_DEMO} from './api';
import {Loading,ErrorView,Button,Modal,Notice} from './ui';
import {Home,Test,ResultPage} from './pages';
import {SharePage} from './share';
import {AdminApp,AdminLogin} from './admin';
import './styles.css';
import './readability.css';
type Context={version:Version;publicOrigin:string;contact:string;localPreview:boolean};
const SiteContext=createContext<Context>(null!);export const useSite=()=>useContext(SiteContext);
const SiteRouter=STATIC_DEMO?HashRouter:BrowserRouter;
function StaticAdmin(){return <main className="information"><span className="eyebrow">GITHUB PAGES DEMO</span><h1>管理后台需要运行后端服务</h1><p className="lead">当前站点是浏览器演示版，答题、计分和结果保存在当前设备，不提供后台登录、正式统计或跨设备保存。</p><div className="prose"><p>如需完整管理后台和服务端校验，请按仓库 README 启动 Node.js + SQLite 服务版本。两种运行模式的记录互相独立。</p></div><Link className="button" to="/">返回首页</Link></main>;}
function Header(){return <header className="site-header wrap"><Link to="/" className="brand"><span className="brand-icon"><Mail size={22} strokeWidth={1.5}/></span><span>正缘画像<small>LETTERS TO LOVE</small></span></Link><nav aria-label="主导航"><NavLink to="/" end>首页</NavLink><NavLink to="/about">测试说明</NavLink><NavLink to="/privacy">隐私说明</NavLink></nav><span className="header-note">写给每一个期待爱的人 <span>✧</span></span></header>;}
function Footer(){return <footer className="site-footer wrap"><Link to="/" className="footer-brand"><Heart size={15}/> 正缘画像 <span>愿你在爱里，也自在做自己。</span></Link><div><Link to="/about">测试说明 <ArrowUpRight size={12}/></Link><Link to="/privacy">隐私说明 <ShieldCheck size={12}/></Link><Link to="/admin/login">管理入口</Link></div><p>本测试仅供娱乐与自我探索参考，不代表对现实恋爱或未来关系的确定预测。</p></footer>;}
function Information({privacy=false}:{privacy?:boolean}){
 const site=useSite(),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 return <main className="information"><span className="eyebrow">{privacy?'YOUR PRIVACY MATTERS':'BEFORE YOU BEGIN'}</span><h1>{privacy?'让探索，安心发生':'关于这场关系探索'}</h1><p className="lead">{privacy?'你的答案属于你，我们认真对待这份信任。':'比起遇见谁，先更了解自己。'}</p><div className="prose">{(privacy?site.version.pages.privacy:site.version.pages.about).split('\n\n').map((s,i)=><p key={i}>{s}</p>)}</div>{privacy?<><p className="fineprint">运营联系：{site.contact||'当前为本机预览，运营联系方式尚未配置。'}</p><Button variant="secondary danger" onClick={()=>setConfirm(true)}>删除我的全部答题记录</Button>{notice&&<Notice>{notice}</Notice>}</>:<Link className="button" to="/test">开始我的探索 <ArrowUpRight size={18}/></Link>}{confirm&&<Modal title="删除当前设备的全部记录？" onClose={()=>setConfirm(false)}><p>答题记录、结果链接和未完成进度都会永久删除。此操作无法撤销。</p><div className="button-row"><Button variant="secondary" onClick={()=>setConfirm(false)}>保留记录</Button><Button loading={busy} onClick={async()=>{setBusy(true);try{await api('/my-data',{method:'DELETE'});localStorage.removeItem(PROGRESS_KEY);sessionStorage.removeItem('zy-start-key');setConfirm(false);setNotice('你的答题记录已删除。');}catch(e){setNotice((e as Error).message);setConfirm(false);}finally{setBusy(false);}}}>确认删除</Button></div></Modal>}</main>;
}
function ScrollTop(){const {pathname}=useLocation();useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[pathname]);return null;}
function App(){const [site,setSite]=useState<Context|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);useEffect(()=>{api('/bootstrap').then(setSite).catch(e=>setError(e.message));},[retry]);
 if(!site)return error?<ErrorView message={error} retry={()=>{setError('');setRetry(retry+1);}}/>:<Loading/>;
 return <SiteContext.Provider value={site}><ScrollTop/><Routes><Route path="/admin/login" element={STATIC_DEMO?<StaticAdmin/>:<AdminLogin/>}/><Route path="/admin/*" element={STATIC_DEMO?<StaticAdmin/>:<AdminApp/>}/><Route path="*" element={<><Header/>{STATIC_DEMO&&<aside className="static-demo-banner wrap" role="note">浏览器演示版 · 数据仅保存在当前浏览器 <Link to="/privacy">了解保存方式 ↗</Link></aside>}<Routes><Route path="/" element={<Home/>}/><Route path="/test" element={<Test/>}/><Route path="/result/:id" element={<ResultPage/>}/><Route path="/share/:id" element={<SharePage/>}/><Route path="/privacy" element={<Information privacy/>}/><Route path="/about" element={<Information/>}/><Route path="*" element={<ErrorView message="这个地址没有对应的信件。"/>}/></Routes><Footer/></>}/></Routes></SiteContext.Provider>;
}
class Boundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<ErrorView message="页面遇到了异常。刷新后可恢复有效期内的答题进度。" retry={()=>location.reload()}/>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<SiteRouter><Boundary><App/></Boundary></SiteRouter>);
