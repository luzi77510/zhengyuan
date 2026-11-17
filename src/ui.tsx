import {useEffect,useRef,type ReactNode} from 'react';
import {ArrowRight,LoaderCircle,X} from 'lucide-react';
import {Link} from 'react-router-dom';
export function Button({children,loading=false,variant='',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{loading?:boolean;variant?:string}){return <button {...props} className={`button ${variant} ${props.className||''}`} disabled={props.disabled||loading}>{loading?<LoaderCircle size={18} className="spin"/>:null}{children}</button>;}
export function Notice({children,error=false}:{children:ReactNode;error?:boolean}){return <div className={'notice '+(error?'error':'')} role={error?'alert':'status'}>{children}</div>;}
export function Loading(){return <div className="loading"><LoaderCircle className="spin"/><p>正在展开这封信…</p></div>;}
export function ErrorView({message,retry}:{message:string;retry?:()=>void}){return <div className="error-view"><span className="eyebrow">A LITTLE PAUSE</span><h1>这封信暂时没有打开</h1><p>{message}</p><div className="button-row">{retry&&<Button onClick={retry}>重新加载</Button>}<Link className="button secondary" to="/">返回首页 <ArrowRight size={17}/></Link></div></div>;}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();const x=ref.current;return ()=>{if(x?.open)x.close();};},[]);
 return <dialog ref={ref} className="modal" onCancel={e=>{e.preventDefault();onClose();}}><button className="icon-button modal-close" aria-label="关闭弹窗" onClick={onClose}><X size={20}/></button><span className="eyebrow">A LETTER FOR YOU</span><h2>{title}</h2>{children}</dialog>;
}
