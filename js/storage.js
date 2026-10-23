
'use strict';
const CLIENT_ID='1033103340250-u1saakrvufc5db9hkv2lilaupd8k0nb2.apps.googleusercontent.com';
function uuid(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
const SCOPE='https://www.googleapis.com/auth/drive.appdata';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fresh=()=>({ops:{},synced:[],downloads:[],lastSync:''});
let verified=false,retain=false,migration=false,email='',cacheError='',localSaved=false,everLoaded=false;
let account='guest',db=fresh(),month=localDate().slice(0,7),filter='all',token='',expires=0,busy=false,authBusy=false,storageOK=true,toastTimer,queueTimer,editing=null,editParents=[],lastError='';
function key(a=account){return 'kintai-cat:v1:'+a;}

function prefKey(a=account){return 'kintai-cat:retain:'+a;}
function read(a=account){const raw=localStorage.getItem(key(a));if(!raw)return fresh();const x=JSON.parse(raw);if(!x||!x.ops||!Array.isArray(x.synced)||!Array.isArray(x.downloads)||!x.synced.every(v=>typeof v==='string')||!x.downloads.every(v=>typeof v==='string'))throw Error('端末の記録を読み込めません。既存の保存内容は上書きしません。');x.ops=K.merge({},x.ops);return {...fresh(),...x};}
function combine(a,b){return {ops:K.merge(a.ops,b.ops),synced:[...new Set([...a.synced,...b.synced])],downloads:[...new Set([...a.downloads,...b.downloads])],lastSync:[a.lastSync||'',b.lastSync||''].sort().at(-1)};}

function currentCache(){if(!retain||cacheError)return fresh();return read();}
function persist(candidate=db){let next=candidate;
  try{if(retain&&!cacheError)next=combine(read(),candidate);}catch(e){cacheError=e.message;}
  next.ops=Object.fromEntries(Object.entries(next.ops).sort(([a],[b])=>a.localeCompare(b)));next.synced.sort();next.downloads.sort();db=next;localSaved=false;
  if(retain&&!cacheError){try{localStorage.setItem(key(),JSON.stringify(next));localSaved=true;}catch{cacheError='端末への保存に失敗しました。入力はこの画面に保持しています。Drive同期またはバックアップを行ってください。';}}
  return db;
}
function requireSession(){if(!verified||authBusy)throw Error('Googleへの接続を確認してください。');}
function pending(){const done=new Set(db.synced);return Object.values(db.ops).filter(o=>!done.has(o.id));}
function safeToLeave(){return !pending().length||(retain&&localSaved&&!cacheError);}
function setRetention(enabled){requireSession();if(busy)throw Error('同期完了後に変更してください。');
  if(!enabled&&pending().length)throw Error('未同期の記録があります。Driveへの同期を完了してから端末保存を解除してください。');
  if(!enabled&&!confirm('このアカウントの端末内の記録を削除し、今後はこのブラウザーに残さない設定にします。Driveの記録は残ります。続けますか？'))return;
  if(enabled){if(cacheError)throw Error(cacheError);localStorage.setItem(prefKey(),'yes');retain=true;persist(db);if(cacheError){render();throw Error(cacheError);}}
  else{localStorage.setItem(prefKey(),'no');localStorage.removeItem(key());localStorage.removeItem('kintai-cat:label:'+account);localStorage.removeItem('kintai-cat:lastAccount');retain=false;localSaved=false;cacheError='';}
  migration=false;render();toast(enabled?'このブラウザーに記録を残します':'このブラウザーの記録を削除しました');
}
async function api(path,options={}){if(!token||Date.now()>=expires){token='';throw Error('Googleへの再接続が必要です。「Googleに接続」を押してください。');}const response=await fetch(path.startsWith('https:')?path:'https://www.googleapis.com/drive/v3/'+path,{...options,headers:{...options.headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(45000)});if(!response.ok){if(response.status===401){token='';throw Error('Googleへの再接続が必要です。入力した記録は現在の画面に保持しています。');}let detail='';try{detail=(await response.json()).error?.message||'';}catch{}throw Error('Drive同期に失敗しました ('+response.status+')。'+detail);}return response.json();}
async function downloadRemote(){let page='',files=[];do{const params=new URLSearchParams({spaces:'appDataFolder',q:"trashed = false and name contains 'kintai-cat-v1-'",fields:'nextPageToken,files(id,name)',pageSize:'1000'});if(page)params.set('pageToken',page);const result=await api('files?'+params);files.push(...(result.files||[]));page=result.nextPageToken||'';}while(page);
const seen=new Set(db.downloads);for(const f of files){if(seen.has(f.id))continue;const batch=await api('files/'+encodeURIComponent(f.id)+'?alt=media');if(batch.app!=='kintai-cat'||batch.version!==1||!batch.ops)throw Error('Driveの記録形式を確認できません。同期を停止しました。');const ops=K.merge(db.ops,batch.ops);persist({...db,ops,synced:[...db.synced,...Object.keys(batch.ops)],downloads:[...db.downloads,f.id]});}}
async function sync(){if(busy||authBusy)return;if(!verified||account==='guest'||!token){location.hash='settings';toast('Googleに接続すると共有できます');return;}busy=true;lastError='';renderStatus();try{await downloadRemote();const todo=pending();if(todo.length){const snapshot=Object.fromEntries(todo.map(o=>[o.id,o]));const boundary='kintai_'+uuid().replaceAll('-','');const metadata={name:'kintai-cat-v1-'+uuid()+'.json',parents:['appDataFolder'],mimeType:'application/json'};const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify({app:'kintai-cat',version:1,ops:snapshot})+'\r\n--'+boundary+'--';const file=await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});persist({...db,synced:[...db.synced,...Object.keys(snapshot)],downloads:[...db.downloads,file.id]});}
await downloadRemote();persist({...db,lastSync:new Date().toISOString()});everLoaded=true;lastError='';}catch(e){lastError=e.name==='TimeoutError'?'接続がタイムアウトしました。入力は保持しています。再同期してください。':e.message;toast(lastError);}finally{busy=false;render();if(!lastError&&pending().length)scheduleSync();}}
function scheduleSync(){clearTimeout(queueTimer);if(token)queueTimer=setTimeout(sync,1400);}
