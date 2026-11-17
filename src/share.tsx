import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,Download,Copy,Share2,Sparkles,RefreshCw} from 'lucide-react';
import QRCode from 'qrcode';
import {useResult} from './pages';
import {useSite} from './main';
import {LoveArt} from './Art';
import {Button,Notice,Loading,ErrorView} from './ui';
import {post} from './api';
import type {Result} from './types';
const font='"PingFang SC","Microsoft YaHei",sans-serif';
function wrapped(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,max:number,lineHeight:number){let line='',row=0;for(const char of text){if(ctx.measureText(line+char).width>max&&line){ctx.fillText(line,x,y+row*lineHeight);row++;line=char;}else line+=char;}if(line)ctx.fillText(line,x,y+row*lineHeight);return row+1;}
const loadImage=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('插画加载失败，请重试。'));i.src=url;});
async function makePoster(r:Result,origin:string,nickname:string,svg:SVGSVGElement){
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;const c=canvas.getContext('2d')!;
 c.fillStyle='#fff9f5';c.fillRect(0,0,1080,1440);
 const glow=c.createRadialGradient(540,470,20,540,470,620);glow.addColorStop(0,'#eee4fb');glow.addColorStop(1,'#fff9f5');c.fillStyle=glow;c.fillRect(0,0,1080,1440);
 c.strokeStyle='#e2d7ea';c.lineWidth=2;c.strokeRect(38,38,1004,1364);c.textAlign='left';c.fillStyle='#8d6aac';c.font=`26px ${font}`;c.fillText('✉  正缘画像',80,102);c.textAlign='right';c.font='16px Georgia';c.fillText('LETTERS TO LOVE',1000,102);
 c.textAlign='center';c.fillStyle='#776582';c.font=`26px ${font}`;c.fillText(nickname?`${nickname}的理想长期伴侣画像`:'我的理想长期伴侣画像是',540,186);
 const t=r.displayTemplate;let size=70;c.font=`500 ${size}px ${font}`;while(c.measureText(t.name).width>880){size--;c.font=`500 ${size}px ${font}`;}c.fillStyle='#68448c';c.fillText(t.name,540,282);
 c.font=`24px ${font}`;c.fillStyle='#8a719c';c.fillText(t.keywords.join('  ·  '),540,337);
 if(r.is_easter_egg){c.font=`21px ${font}`;c.fillText(`基础画像 · ${r.template.name}`,540,381);}
 let image:HTMLImageElement;let svgUrl='';
 try{if(t.image)image=await loadImage(t.image);else{const clone=svg.cloneNode(true) as SVGSVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');svgUrl=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));image=await loadImage(svgUrl);}const box={x:255,y:r.is_easter_egg?390:355,w:570,h:435},scale=Math.min(box.w/image.naturalWidth,box.h/image.naturalHeight);c.drawImage(image,box.x+(box.w-image.naturalWidth*scale)/2,box.y+(box.h-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);}finally{if(svgUrl)URL.revokeObjectURL(svgUrl);}
 c.fillStyle='#65516f';let quoteSize=30;c.font=`${quoteSize}px ${font}`;while(c.measureText(r.template.summary).width>840*3&&quoteSize>18){quoteSize--;c.font=`${quoteSize}px ${font}`;}wrapped(c,r.template.summary,540,837,840,quoteSize*1.7);
 c.strokeStyle='#e5dbea';c.beginPath();c.moveTo(100,955);c.lineTo(980,955);c.stroke();
 const cx=303,cy=1133,radius=104,point=(i:number,n:number)=>[cx+Math.sin(i*Math.PI/3)*radius*n,cy-Math.cos(i*Math.PI/3)*radius*n];
 for(const n of [1/3,2/3,1]){c.beginPath();for(let i=0;i<6;i++){const [x,y]=point(i,n);i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.strokeStyle='#dcd0e8';c.stroke();}
 for(let i=0;i<6;i++){const [x,y]=point(i,1);c.beginPath();c.moveTo(cx,cy);c.lineTo(x,y);c.stroke();}
 c.beginPath();for(let i=0;i<6;i++){const [x,y]=point(i,r.dimensions[i]/9);i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fillStyle='#a78bfa44';c.fill();c.strokeStyle='#9b78ca';c.lineWidth=3;c.stroke();
 c.font=`17px ${font}`;c.fillStyle='#74657c';for(let i=0;i<6;i++){const [x,y]=point(i,1.42);c.fillText(r.dimensionNames[i],x,y+6);}c.font=`19px ${font}`;c.fillText('六维关系偏好 · 0–9 分',303,1325);
 const qr=await QRCode.toCanvas(origin+'/',{width:164,margin:2,errorCorrectionLevel:'M',color:{dark:'#564067',light:'#fff9f5'}});c.drawImage(qr,738,1043);c.fillStyle='#786283';c.font=`21px ${font}`;c.fillText('扫一扫，探索你的画像',820,1249);c.font=`17px ${font}`;c.fillText('愿你在爱里，也自在做自己',820,1290);
 c.fillStyle='#8a7d91';c.font=`19px ${font}`;c.fillText('仅供娱乐与自我探索参考 · 不预测现实恋爱或未来关系',540,1370);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('海报导出失败，请重试。')),'image/png'));return blob;
}
export function SharePage(){
 const {result:r,error,reload}=useResult(),{publicOrigin,localPreview}=useSite(),[nickname,setNickname]=useState(''),[url,setUrl]=useState(''),[blob,setBlob]=useState<Blob|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),art=useRef<HTMLDivElement>(null),generation=useRef(0);
 const log=(kind:string)=>r&&post('/events',{result_id:r.id,kind,event_id:crypto.randomUUID()}).catch(()=>{});
 const generate=async()=>{if(!r||!art.current)return;const task=++generation.current;setBusy(true);setFailed(false);setMessage('');try{const b=await makePoster(r,publicOrigin,nickname,art.current.querySelector('svg')!);if(task!==generation.current)return;setBlob(b);setUrl(URL.createObjectURL(b));log('poster_success');}catch(e){setFailed(true);setMessage((e as Error).message);}finally{if(task===generation.current)setBusy(false);}};
 useEffect(()=>{if(r)generate();return ()=>{generation.current++;};},[r]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 if(error)return <ErrorView message={error} retry={reload}/>;if(!r)return <Loading/>;
 const text=`我测出了自己的正缘画像：${r.displayTemplate.name}。你更适合什么样的人？来测测看。 ${publicOrigin}/`;
 return <main className="share-main wrap"><Link to={'/result/'+r.id} className="text-button"><ArrowLeft size={16}/>返回结果</Link><div className="share-layout"><div className="poster-preview">{url?<img src={url} alt={`专属分享海报：${r.displayTemplate.name}，${r.template.summary}`} width="1080" height="1440"/>:<div className="poster-loading">{busy?<Loading/>:<p>海报暂未生成</p>}</div>}</div><div className="share-controls"><span className="eyebrow">KEEP THIS LITTLE DISCOVERY</span><h1>把关于爱的发现，<br/>装进一封信里。</h1><p>保存属于你的关系画像，<br/>也可以邀请朋友一起探索。</p><label className="field-label">海报昵称 <span>可选 · 最多 16 字</span><input value={nickname} maxLength={32} onChange={e=>setNickname(Array.from(e.target.value).slice(0,16).join(''))} placeholder="写下你想被称呼的名字" autoComplete="off"/></label><p className="fineprint">昵称仅在浏览器生成海报时使用，不会上传。</p><Button variant="secondary" loading={busy} onClick={generate}><RefreshCw size={16}/>{url?'更新海报':'重新生成'}</Button><div className="share-buttons"><Button disabled={!url||busy} onClick={()=>{const a=document.createElement('a');a.href=url;a.download=`正缘画像-${r.displayTemplate.name}.png`;a.click();setFailed(false);setMessage('已发起图片下载。如浏览器未下载，可长按或右键海报保存图片。');}}><Download size={17}/>保存图片 · PNG</Button><Button variant="secondary" onClick={async()=>{log('share_click');try{await navigator.clipboard.writeText(text);setFailed(false);setMessage('分享文案已复制。');}catch{setFailed(true);setMessage('浏览器暂不支持复制，请从下方文本框手动复制。');}}}><Copy size={16}/>复制分享文案</Button>{!!navigator.share&&<Button variant="secondary" disabled={!blob} onClick={async()=>{if(!blob)return;log('share_click');try{const file=new File([blob],'正缘画像.png',{type:'image/png'});await navigator.share(navigator.canShare?.({files:[file]})?{files:[file],title:'我的正缘画像',text}:{title:'我的正缘画像',text,url:publicOrigin});}catch(e){if((e as Error).name!=='AbortError'){setFailed(true);setMessage('系统分享暂不可用，可以保存图片后自行分享。');}}}}><Share2 size={16}/>系统分享</Button>}</div>{message&&<Notice error={failed}>{message}</Notice>}<textarea className="share-copy" aria-label="分享文案" readOnly value={text}/><div className="share-tips"><Sparkles size={17}/><div>1080 × 1440 高清信笺<p>手机浏览器可长按图片保存。海报仅包含结果与公共首页入口，不包含你的原始答案。</p>{localPreview&&<p>当前二维码指向本机预览地址；对外分享前，请在 .env 配置公开域名。</p>}</div></div></div></div><div ref={art} className="poster-art-source" aria-hidden="true"><LoveArt kind={r.display_result_code}/></div></main>;
}
