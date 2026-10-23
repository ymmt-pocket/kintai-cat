
/* KINTAI-CAT: pure attendance and append-only merge functions. */
(function(root){
'use strict';
const pad=n=>String(n).padStart(2,'0');
const HOLIDAYS={};
const names=['元日','成人の日','建国記念の日','天皇誕生日','春分の日','昭和の日','憲法記念日','みどりの日','こどもの日','海の日','山の日','敬老の日','秋分の日','スポーツの日','文化の日','勤労感謝の日'];
for(const [y,ds] of Object.entries({2026:['01-01','01-12','02-11','02-23','03-20','04-29','05-03','05-04','05-05','07-20','08-11','09-21','09-23','10-12','11-03','11-23'],2027:['01-01','01-11','02-11','02-23','03-21','04-29','05-03','05-04','05-05','07-19','08-11','09-20','09-23','10-11','11-03','11-23']}))ds.forEach((d,i)=>HOLIDAYS[y+'-'+d]=names[i]);
Object.assign(HOLIDAYS,{'2026-05-06':'振替休日','2026-09-22':'国民の休日','2027-03-22':'振替休日'});
const defaults={start:'09:00',end:'18:00',break:'01:00'};
function minutes(s){if(!/^\d{2}:\d{2}$/.test(s||''))return NaN;const [h,m]=s.split(':').map(Number);return h<24&&m<60?h*60+m:NaN;}
function duration(r){if(r.off||(!r.start&&!r.end))return 0;const a=minutes(r.start),b=minutes(r.end),c=minutes(r.break);if(!Number.isFinite(a+b+c))throw Error('開始・終了・休憩をすべて入力してください。');const span=b-a+(r.next?1440:0);if(span<0)throw Error('終了が開始より前です。日をまたぐ場合は「翌日終了」を選んでください。');if(c>span)throw Error('休憩が勤務時間より長くなっています。');return span-c;}
const time=n=>pad(Math.floor(n/60))+':'+pad(n%60);
function dates(month){const [y,m]=month.split('-').map(Number);return Array.from({length:new Date(y,m,0).getDate()},(_,i)=>month+'-'+pad(i+1));}
function weekday(d){return new Date(d+'T12:00:00').getDay();}
function blank(){return {start:'',end:'',break:'',next:false,off:true,company:false,lychee:false};}
function initial(d,template){return weekday(d)===0||weekday(d)===6||HOLIDAYS[d]||!template?blank():{...template,next:false,off:false,company:false,lychee:false};}
function heads(ops,key){const all=Object.values(ops).filter(o=>o.key===key);const parents=new Set(all.flatMap(o=>o.parents));return all.filter(o=>!parents.has(o.id)).sort((a,b)=>a.id.localeCompare(b.id));}
function value(ops,key){return heads(ops,key).at(-1)?.value;}
function validRecord(r){if(!r||typeof r!=='object')return false;return ['start','end','break'].every(k=>typeof r[k]==='string'&&(r[k]===''||Number.isFinite(minutes(r[k]))))&&['off','next','company','lychee'].every(k=>typeof r[k]==='boolean');}
function validOp(o){if(!o||typeof o.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(o.id)||!Array.isArray(o.parents)||!o.parents.every(p=>typeof p==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(p)&&p!==o.id)||typeof o.key!=='string')return false;
if(/^d:\d{4}-\d{2}-\d{2}$/.test(o.key)){const d=o.key.slice(2);return validDate(d)&&validRecord(o.value)&&Number.isFinite((()=>{try{return duration(o.value)}catch{return NaN}})());}
if(o.key==='settings'||/^m:\d{4}-(0[1-9]|1[0-2])$/.test(o.key)){return o.value===null&&o.key.startsWith('m:')||validSettings(o.value)&&Number.isFinite((()=>{try{return duration({...o.value,next:false,off:false})}catch{return NaN}})());}return false;}
function merge(a,b){const result={...a};for(const [id,o] of Object.entries(b)){if(id!==o.id||!validOp(o))throw Error('読み込むデータの形式が正しくありません。');if(result[id]&&JSON.stringify(result[id])!==JSON.stringify(o))throw Error('同じIDに異なる記録が見つかりました。同期を停止しました。');result[id]=o;}return result;}
function csv(month,rows){let sum=0;const out=[['月','日付','勤務開始','勤務終了','実働時間','総実働']];for(const [d,r]of rows){const n=duration(r);sum+=n;out.push([month.slice(5),d.slice(8),r.off?'':r.start,r.off?'':r.end,r.off?'':time(n),'']);}out.push(['','合計','','','',time(sum)]);return '\ufeff'+out.map(r=>r.join(',')).join('\r\n')+'\r\n';}
function validSettings(p){return p&&['start','end','break'].every(k=>Number.isFinite(minutes(p[k])))&&(!('weekStart' in p)||[0,1].includes(p.weekStart))&&(!('rules' in p)||(Array.isArray(p.rules)&&p.rules.length<=100&&p.rules.every(r=>r&&validDate(r.from)&&Number.isInteger(r.minutes)&&r.minutes>=0&&r.minutes<=1440)&&new Set(p.rules.map(r=>r.from)).size===p.rules.length));}
function validDate(d){return typeof d==='string'&&/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(d)&&dates(d.slice(0,7)).includes(d)||typeof d==='string'&&/^2100-(0[1-9]|1[0-2])-\d{2}$/.test(d)&&dates(d.slice(0,7)).includes(d);}
const api={validDate,validSettings,pad,HOLIDAYS,defaults,minutes,duration,time,dates,weekday,blank,initial,heads,value,validOp,merge,csv};if(typeof module!=='undefined')module.exports=api;root.K=api;
})(globalThis);

