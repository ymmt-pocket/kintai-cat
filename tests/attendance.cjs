const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const root=path.join(__dirname,'../js');const K=require(path.join(root,'attendance.js'));global.K=K;const S=require(path.join(root,'summary.js'));
const r={...K.defaults,off:false,next:false,company:false,lychee:false};
const op=(id,key,value,parents=[])=>({id,key,value,parents,at:'2026-10-24T00:00:00Z'});
assert.equal(K.duration(r),480);assert.equal(K.duration({...r,start:'22:00',end:'06:00',next:true}),420);assert.throws(()=>K.duration({...r,break:'10:00'}));assert.throws(()=>K.duration({...r,start:'22:00',end:'06:00'}));assert.equal(K.time(10080),'168:00');assert.equal(K.dates('2028-02').length,29);assert.equal(K.validDate('2026-02-30'),false);assert.equal(K.validDate('2026-13-01'),false);
assert.equal(K.initial('2026-10-12',K.defaults).off,true);assert.equal(K.initial('2027-03-22',K.defaults).off,true);
const rows=K.dates('2026-10').map(d=>[d,K.initial(d,K.defaults)]);const csv=K.csv('2026-10',rows).trimEnd().slice(1).split('\r\n').map(x=>x.split(','));assert.equal(csv.length,33);assert.equal(csv.at(-1)[5],'168:00');assert.ok(csv.slice(1,-1).every(x=>x[5]===''));assert.ok(csv.every(x=>x.length===6));
assert.equal(S.total(rows,K.defaults).actual,0);assert.equal(S.total(rows,K.defaults).forecast,10080);
const rr=[['2026-10-01',{...r,end:'19:00',company:true}],['2026-10-02',{...r,end:'17:00',lychee:true}],['2026-10-05',{...r,end:'20:00'}]];
assert.equal(S.total(rr,{}).actual,960);assert.equal(S.total(rr,{}).overtime,60);assert.equal(S.total(rr,{}).pending,1);assert.equal(S.total(rr,{rules:[{from:'2026-10-02',minutes:360}]}).overtime,120);
const ww=S.weeks('2026-10',d=>d==='2026-09-30'?{...r,company:true}:K.blank(),{});assert.equal(ww[0].start,'2026-09-28');assert.equal(ww.at(-1).end,'2026-11-01');assert.equal(ww[0].actual,480);assert.equal(S.weeks('2026-10',()=>K.blank(),{weekStart:0})[0].start,'2026-09-27');
assert.equal(K.validOp(op('invalid1','settings',{...K.defaults,weekStart:7})),false);assert.equal(K.validOp(op('invalid2','settings',{...K.defaults,rules:[{from:'2026-02-30',minutes:480}]})),false);
const a=op('aaaaaaaa','d:2026-10-01',r),b=op('bbbbbbbb',a.key,{...r,end:'19:00'},[a.id]),c=op('cccccccc',a.key,{...r,end:'20:00'},[a.id]);assert.equal(K.heads(K.merge({[a.id]:a},{[b.id]:b,[c.id]:c}),a.key).length,2);
console.log('PASS calculations: confirmation OR, overtime without offset, effective rules, month-crossing weeks, holidays, leap years, 6-column CSV, invalid input, conflicts');
const drives=new Map();let offline=false,uploadCount=0;
async function fetchMock(url,opts){if(offline)throw Error('network offline');const acct=opts.headers.Authorization.replace('Bearer token-','');if(!drives.has(acct))drives.set(acct,[]);const files=drives.get(acct);let data;
if(url.includes('/about?'))data={user:{permissionId:acct,emailAddress:acct+'@example.test'}};
else if(url.includes('upload/drive')){const boundary=opts.headers['Content-Type'].split('boundary=')[1],parts=opts.body.split('--'+boundary),payload=JSON.parse(parts[2].split('\r\n\r\n')[1].trim());data={id:'file'+(++uploadCount)};files.push({...data,payload});}
else if(url.includes('alt=media')){const id=url.split('/files/')[1].split('?')[0];data=files.find(f=>f.id===id).payload;}
else if(url.includes('/files?'))data={files:files.map(f=>({id:f.id,name:'kintai-cat-v1-test.json'}))};else throw Error('unexpected '+url);
return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};}
function device(memory=new Map()){
const nodes=new Map(),events={};const node=()=>({value:'',textContent:'',innerHTML:'',hidden:false,checked:false,open:false,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},contains(){return false},close(){this.open=false},showModal(){this.open=true},replaceChildren(){this.innerHTML='';this.textContent=''}});
const document={activeElement:null,querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},querySelectorAll(sel){return sel==='.page'?['login','home','summary','export','settings'].map(id=>Object.assign(document.querySelector('#'+id),{id})):[]},addEventListener(){}};
let ctx;const google={accounts:{oauth2:{initTokenClient(opts){return {requestAccessToken(){ctx.authPromise=opts.callback({access_token:'token-'+ctx.loginAccount,expires_in:3600});}};}}}};
ctx=vm.createContext({console,crypto:crypto.webcrypto,document,window:{addEventListener:(type,fn)=>events[type]=fn,google},google,location:{hash:'#summary?user=victim'},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>{if(ctx.quota)throw Error('quota exceeded');memory.set(k,String(v))},removeItem:k=>memory.delete(k)},setTimeout:()=>0,clearTimeout(){},Intl,Date,URL,URLSearchParams,AbortSignal,Uint8Array,fetch:fetchMock,confirm:()=>true,loginAccount:'one',Blob});
for(const f of ['attendance','summary','storage','auth','export','app'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const run=code=>vm.runInContext(code,ctx);return {run,memory,nodes,events,ctx,login:async id=>{ctx.loginAccount=id;run('connect()');await ctx.authPromise;}};
}
(async()=>{
const A=device(),B=device();assert.equal(A.run('verified'),false);assert.equal(A.nodes.get('#login').hidden,false);assert.throws(()=>A.run("commit([{key:'d:2026-10-01',value:K.blank()}])"));assert.equal(A.run('Object.keys(db.ops).length'),0);
await A.login('one');await B.login('one');assert.equal(A.run('verified'),true);assert.equal(A.run('retain'),false);assert.equal(A.memory.size,0);
A.run("commit([...freezeMonth(),{key:'d:2026-10-01',value:{...K.defaults,end:'19:00',off:false,next:false,company:true,lychee:false}}])");assert.equal(A.memory.size,0);assert.equal(A.run('safeToLeave()'),false);A.run('logout()');assert.equal(A.run('verified'),true);
await A.run('sync()');assert.equal(A.run('pending().length'),0);await B.run('sync()');assert.equal(B.run("row('2026-10-01').end"),'19:00');
A.run('setRetention(true)');assert.equal(A.run('retain'),true);assert.equal(B.run('retain'),false);assert.ok(![...A.memory.values()].some(x=>x.includes('token-one')));
A.run("commit([{key:'d:2026-10-01',value:{...row('2026-10-01'),end:'20:00'}}])");B.run("commit([{key:'d:2026-10-01',value:{...row('2026-10-01'),end:'21:00'}}])");await Promise.all([A.run('sync()'),B.run('sync()')]);await A.run('sync()');await B.run('sync()');assert.equal(A.run("K.heads(db.ops,'d:2026-10-01').length"),2);
A.run("commit([{key:'d:2026-10-01',value:{...row('2026-10-01'),end:'20:00'}}])");await A.run('sync()');await B.run('sync()');assert.equal(B.run("K.heads(db.ops,'d:2026-10-01').length"),1);
offline=true;B.run("commit([{key:'d:2026-10-02',value:{...K.defaults,end:'19:30',off:false,next:false,company:false,lychee:true}}])");await B.run('sync()');assert.ok(B.run('pending().length')>0);assert.throws(()=>B.run('setRetention(false)'));offline=false;
await B.login('two');assert.equal(B.run('account'),'one');assert.ok(B.run('pending().length')>0);await B.login('one');await A.run('sync()');assert.equal(A.run("row('2026-10-02').end"),'19:30');
await B.login('two');assert.equal(B.run('account'),'two');assert.equal(B.run('Object.keys(db.ops).length'),0);await B.login('one');assert.equal(B.run("row('2026-10-02').end"),'19:30');
A.run('logout()');assert.equal(A.run('verified'),false);assert.equal(A.nodes.get('#dayList').innerHTML,'');assert.equal(A.nodes.get('#login').hidden,false);assert.ok(A.memory.has('kintai-cat:v1:one'));
const reload=device(A.memory);assert.equal(reload.run('verified'),false);assert.equal(reload.run('Object.keys(db.ops).length'),0);await reload.login('one');assert.equal(reload.run("row('2026-10-02').end"),'19:30');reload.run('setRetention(false)');assert.equal(reload.memory.has('kintai-cat:v1:one'),false);
const legacyMap=new Map([['kintai-cat:v1:legacy',JSON.stringify({ops:{[a.id]:a},synced:[],downloads:[],lastSync:''})],['kintai-cat:lastAccount','legacy']]);const L=device(legacyMap);assert.equal(L.run('Object.keys(db.ops).length'),0);await L.login('legacy');assert.equal(L.run('migration'),true);assert.equal(L.run("row('2026-10-01').start"),'09:00');assert.equal(L.run('pending().length'),0);L.run('setRetention(true)');assert.equal(L.run('migration'),false);
L.ctx.quota=true;L.run("commit([{key:'d:2026-10-03',value:{...K.defaults,off:false,next:false,company:true,lychee:false}}])");assert.ok(L.run('cacheError'));assert.equal(L.run('safeToLeave()'),false);await L.run('sync()');assert.equal(L.run('pending().length'),0);
// Reported-time edits reset both report flags.
B.run("openEditor('2026-10-01');$('#editStart').value='09:00';$('#editEnd').value='22:00';$('#editBreak').value='01:00';$('#editForm').onsubmit({preventDefault(){}})");assert.equal(B.run("row('2026-10-01').company"),false);assert.equal(B.run("row('2026-10-01').lychee"),false);
// Invalid routes do not grant identity; different account caches never load before Google verification.
const C=device(new Map([['kintai-cat:lastAccount','one'],['kintai-cat:v1:one',JSON.stringify({ops:{[a.id]:a},synced:[],downloads:[]})]]));C.run("location.hash='settings';navigate()");assert.equal(C.nodes.get('#login').hidden,false);await C.login('three');assert.equal(C.run('Object.keys(db.ops).length'),0);
console.log('PASS integration: Google account verification, direct route gate, memory-only mode, per-device retention, logout safeguards, legacy migration, account isolation, concurrent Drive edits, retry, storage failure, report-reset');
})().catch(e=>{console.error(e);process.exitCode=1});
