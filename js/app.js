function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),5000);}
function reportError(e){lastError=e.message||String(e);toast(lastError);renderStatus();}
function makeOp(k,v,parents){return {id:uuid(),key:k,value:v,parents:parents||K.heads(db.ops,k).map(o=>o.id),at:new Date().toISOString()};}
function commit(entries){requireSession();db=combine(db,currentCache());const copy={...db,ops:{...db.ops}};for(const entry of entries){const o=makeOp(entry.key,entry.value,entry.parents);if(!K.validOp(o))throw Error('記録を確認してください。入力形式が正しくありません。');copy.ops[o.id]=o;}persist(copy);lastError='';render();scheduleSync();}
function prefs(){return K.value(db.ops,'settings')||K.defaults;}
function template(m=month){const v=K.value(db.ops,'m:'+m);return v===undefined?((+m.slice(0,4)===2026||+m.slice(0,4)===2027)?prefs():null):v;}
function row(d){return K.value(db.ops,'d:'+d)||K.initial(d,template(d.slice(0,7)));}
function monthRows(){return K.dates(month).map(d=>[d,row(d)]);}
function freezeMonth(){return K.heads(db.ops,'m:'+month).length?[]:[{key:'m:'+month,value:template()}];}
function conflicts(){return [...new Set(Object.values(db.ops).map(o=>o.key))].filter(k=>K.heads(db.ops,k).length>1);}
function hasMonthConflicts(){return conflicts().some(k=>k==='settings'||k==='m:'+month||k.startsWith('d:'+month));}
function render(){
if(!verified){renderStatus();return;}
const rows=monthRows(),work=rows.filter(([,r])=>!r.off&&r.start&&r.end),total=rows.reduce((n,[,r])=>n+K.duration(r),0),parts=K.time(total).split(':');
$('#year').value=month.slice(0,4);$('#month').value=month.slice(5);$('#totalHours').textContent=parts[0];$('#totalMinutes').textContent=':'+parts[1];$('#workingDays').textContent=work.length+' 日分の勤務';
for(const p of ['company','lychee']){const count=work.filter(([,r])=>r[p]).length;$('#'+p+'Count').textContent=count;$('#'+p+'Denom').textContent='/ '+work.length+' 日';$('#'+p+'Progress').style.width=(work.length?count/work.length*100:0)+'%';$('#'+p+'Remaining').textContent=work.length===count?'すべて記載済み ✓':'あと '+(work.length-count)+' 日';}
$('#holidayNotice').hidden=[2026,2027].includes(+month.slice(0,4));
const bad=conflicts();$('#conflictNotice').hidden=!bad.length;$('#conflictNotice').textContent=bad.length+' 件の変更が重なっています。黄色の日を開いて内容を選んで保存してください。標準時間・月の設定が重なった場合は、設定から保存し直してください。';
$('#dayList').innerHTML=rows.filter(([,r])=>filter==='all'||filter==='work'&&!r.off||filter==='pending'&&!r.off&&(!r.company||!r.lychee)).map(([d,r])=>{
const off=r.off||!r.start,holiday=K.HOLIDAYS[d],conflict=K.heads(db.ops,'d:'+d).length>1;
return `<div class="day-row ${K.weekday(d)%6===0||holiday?'weekend ':''}${d===localDate()?'today ':''}${conflict?'conflict':''}"><button class="date-btn" data-edit="${d}" aria-label="${d}を編集"><strong>${d.slice(8)}</strong><small>(${['日','月','火','水','木','金','土'][K.weekday(d)]})</small>${holiday?'<em>'+esc(holiday)+'</em>':''}</button><button class="hours-btn" data-edit="${d}">${off?'お休み':esc(r.start)+' — '+esc(r.end)+(r.next?' ⁺¹':'')}<small>${conflict?'⚠ 変更を確認':off?'ゆっくり、ひと休み。':'休憩 '+esc(r.break)+' ・ '+(r.company||r.lychee?'確定':d<localDate()?'未確定':'予定')}</small></button><span class="daily-hours">${off?'—':K.time(K.duration(r))}</span>${['company','lychee'].map(p=>`<button class="check-btn ${r[p]?'checked':''}" data-check="${d}" data-field="${p}" aria-label="${d} ${p==='company'?'自社勤怠':'Lychee記載'}済み" aria-pressed="${r[p]}" ${off?'disabled':''}>${r[p]?'○':'·'}</button>`).join('')}</div>`;
}).join('')||'<p class="empty">この条件の記録はありません。猫もひと休み。</p>';
$$('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter===filter));
$('#exportTitle').textContent=month.replace('-','年 ')+'月 の勤務';$('#exportTotal').textContent=K.time(total);const p=prefs();if(!$('#defaultsForm').contains(document.activeElement)){$('#defaultStart').value=p.start;$('#defaultEnd').value=p.end;$('#defaultBreak').value=p.break;}renderStatus();renderSummary();
}
function changeMonth(delta){const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+delta,1);setMonth(d.getFullYear()+'-'+K.pad(d.getMonth()+1));}
function setMonth(m){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)&&!/^2100-(0[1-9]|1[0-2])$/.test(m))return;month=m;render();}
function clockValue(v){v=v.trim();return /^\d{4}$/.test(v)?v.slice(0,2)+':'+v.slice(2):v;}
$$('input[inputmode=numeric]').forEach(el=>el.addEventListener('blur',()=>{el.value=clockValue(el.value);if(el.id.startsWith('edit'))updateEditTotal();}));
function readEditor(){return {start:clockValue($('#editStart').value),end:clockValue($('#editEnd').value),break:clockValue($('#editBreak').value),next:$('#editNext').checked,off:$('#editOff').checked,company:$('#editCompany').checked,lychee:$('#editLychee').checked};}
function setEditor(r){$('#editStart').value=r.start;$('#editEnd').value=r.end;$('#editBreak').value=r.break;$('#editNext').checked=r.next;$('#editOff').checked=r.off;$('#editCompany').checked=r.company;$('#editLychee').checked=r.lychee;updateEditTotal();}
function updateEditTotal(){const r=readEditor();for(const id of ['editStart','editEnd','editBreak','editNext','editCompany','editLychee'])$('#'+id).disabled=r.off;try{$('#editTotal').textContent=K.time(K.duration(r));$('#editError').textContent='';}catch(e){$('#editTotal').textContent='—';$('#editError').textContent=e.message;}}
function openEditor(d){requireSession();if(!K.validDate(d))throw Error('日付を確認してください。');editing=d;editParents=K.heads(db.ops,'d:'+d).map(o=>o.id);$('#editTitle').textContent=Number(d.slice(5,7))+'月'+Number(d.slice(8))+'日（'+['日','月','火','水','木','金','土'][K.weekday(d)]+'）';const hs=K.heads(db.ops,'d:'+d);$('#conflictChoices').hidden=hs.length<2;$('#conflictChoices').innerHTML=hs.length>1?'別の端末で変更が重なりました。採用する内容を選び、保存してください。'+hs.map((o,i)=>`<button type="button" class="button secondary" data-choice="${i}">${o.value.off?'勤務なし':esc(o.value.start)+'〜'+esc(o.value.end)+' / 休憩 '+esc(o.value.break)} / 自社${o.value.company?'○':'未'}・Lychee${o.value.lychee?'○':'未'}</button>`).join(''):'';$$('[data-choice]').forEach(b=>b.onclick=()=>setEditor(hs[+b.dataset.choice].value));setEditor(row(d));$('#editor').showModal();}
$('#editForm').addEventListener('input',updateEditTotal);
$('#editForm').onsubmit=e=>{e.preventDefault();try{let r=readEditor();if(r.off)r=K.blank();K.duration(r);const old=row(editing);if((old.start!==r.start||old.end!==r.end||old.break!==r.break||old.next!==r.next||old.off!==r.off)&&(old.company||old.lychee)){if(!confirm('報告済みの勤務時間を変更します。報告チェックを外して保存しますか？'))return;r.company=false;r.lychee=false;}commit([...freezeMonth(),{key:'d:'+editing,value:r,parents:editParents}]);$('#editor').close();toast(retain&&localSaved?'端末に保存しました。Driveへ同期します 🐾':'入力を受け付けました。Driveへ同期します 🐾');}catch(e){$('#editError').textContent=e.message;}};
$('#closeEditor').onclick=()=>$('#editor').close();$('#resetDay').onclick=()=>setEditor(K.initial(editing,template()));
$('#dayList').onclick=e=>{const edit=e.target.closest('[data-edit]'),check=e.target.closest('[data-check]');try{if(edit)openEditor(edit.dataset.edit);if(check){const d=check.dataset.check;if(K.heads(db.ops,'d:'+d).length>1){openEditor(d);return;}const r={...row(d)};r[check.dataset.field]=!r[check.dataset.field];commit([...freezeMonth(),{key:'d:'+d,value:r}]);}}catch(err){reportError(err);}};
$('#todayEdit').onclick=()=>{setMonth(localDate().slice(0,7));openEditor(localDate());};
$('#year').innerHTML=Array.from({length:101},(_,i)=>`<option value="${2000+i}">${2000+i}年</option>`).join('');$('#month').innerHTML=Array.from({length:12},(_,i)=>`<option value="${K.pad(i+1)}">${K.pad(i+1)}月</option>`).join('');
for(const id of ['year','month'])$('#'+id).onchange=()=>setMonth($('#year').value+'-'+$('#month').value);
$('.prev-month').onclick=()=>changeMonth(-1);$('.next-month').onclick=()=>changeMonth(1);$('#goCurrent').onclick=()=>setMonth(localDate().slice(0,7));
$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
$('#defaultsForm').onsubmit=e=>{e.preventDefault();try{const p={...prefs(),start:clockValue($('#defaultStart').value),end:clockValue($('#defaultEnd').value),break:clockValue($('#defaultBreak').value)};K.duration({...p,next:false,off:false});commit([...freezeMonth(),{key:'settings',value:p}]);toast('これから作る月の標準時間を保存しました');}catch(e){reportError(e);}};
$('#applyDefaults').onclick=()=>{try{if(![2026,2027].includes(+month.slice(0,4)))throw Error('この年の祝日は未登録です。日ごとに勤務を入力してください。');if(confirm(month+' の未編集の平日に標準時間を適用しますか？')){commit([{key:'m:'+month,value:prefs()}]);toast('未編集の平日に適用しました');}}catch(e){reportError(e);}};
$('#clearMonth').onclick=()=>{try{if(confirm(month+' の勤務時間と報告チェックをすべてクリアします。ほかの月は残ります。続けますか？')){commit([{key:'m:'+month,value:null},...K.dates(month).map(d=>({key:'d:'+d,value:K.blank()}))]);toast('この月の記録をクリアしました');}}catch(e){reportError(e);}};

function accountLabel(){return email||'Googleアカウント';}
function renderStatus(){
 const connected=!!token&&Date.now()<expires;
 const label=!verified?'Googleに接続':busy?'Drive保存中…':lastError?'同期を確認':pending().length?'Drive未同期':db.lastSync?'Drive同期済み':'Drive読込待ち';
 $('#syncLabel').textContent=label;$('#syncTop').classList.toggle('online',verified&&connected&&!busy&&!lastError&&!pending().length);
 for(const id of ['connect','loginConnect','syncNow','disconnect','retainDevice','deleteLocal','confirmMigration'])$('#'+id).disabled=busy||authBusy;
 $('#connect').textContent=connected?'Googleアカウントを変更':'Googleに再接続';
 $('#loginConnect').textContent=authBusy?'Googleに接続中…':'Googleで接続する';
 $('#loginMessage').textContent=!verified?lastError:'';
 $('#accountText').textContent=verified?'記録の保存先：'+accountLabel():'';
 $('#syncDetail').textContent=lastError||(db.lastSync?'最終同期 '+new Date(db.lastSync).toLocaleString('ja-JP')+' / 未同期 '+pending().length+' 件':'Googleドライブから記録を読み込みます。');
 $('#deviceStatus').textContent=cacheError||(retain?(localSaved?'端末保存済み':'端末保存を準備中'):'端末保存 OFF・この画面を閉じると未同期の入力は失われます');
 $('#retainDevice').checked=retain;$('#migrationNotice').hidden=!migration;
 $('#localWarning').hidden=!cacheError;$('#localWarning').textContent=cacheError;
 $('#saveBanner').hidden=!verified||(!pending().length&&!lastError&&!cacheError&&!busy);
 $('#saveBanner').textContent=cacheError||lastError||(busy?'Googleドライブに保存しています…':pending().length+' 件がDrive未同期です。'+(retain&&localSaved?'端末には保存済みです。':'同期が終わるまで画面を閉じないでください。'));
 $('#copyGuest').hidden=!verified;
}
function navigate(){
 let name=location.hash.slice(1);if(!['home','summary','export','settings','login'].includes(name))name='home';
 if(!verified)name='login';else if(name==='login')name='home';
 $$('.page').forEach(p=>p.hidden=p.id!==name);$('.bottom-nav').hidden=!verified;$('#syncTop').hidden=!verified;
 $$('[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===name));
 if(verified)render();else renderStatus();
}
$('#loginConnect').onclick=connect;$('#connect').onclick=connect;$('#disconnect').onclick=logout;
$('#syncNow').onclick=()=>token&&Date.now()<expires?sync():connect();$('#syncTop').onclick=()=>{location.hash='settings';};
$('#retainDevice').onchange=e=>{try{setRetention(e.target.checked);}catch(err){reportError(err);}renderStatus();};
$('#deleteLocal').onclick=()=>{try{setRetention(false);}catch(e){reportError(e);}};
$('#confirmMigration').onclick=()=>{try{setRetention(true);}catch(e){reportError(e);}};
$('#copyGuest').onclick=()=>{try{requireSession();const guest=read('guest');const keys=[...new Set(Object.values(guest.ops).map(o=>o.key))];if(!keys.length){toast('旧版の未接続記録はありません');return;}if(!confirm('旧版の未接続記録を現在のGoogleアカウントにコピーします。自分の記録であることを確認してください。'))return;commit(keys.flatMap(k=>K.heads(guest.ops,k).map(o=>({key:k,value:o.value,parents:[]}))));toast('旧版の未接続記録をコピーしました');}catch(e){reportError(e);}};
window.addEventListener('hashchange',navigate);
window.addEventListener('online',()=>{if(verified&&token)sync();});
window.addEventListener('focus',()=>{if(verified&&token&&!$('#editor').open)sync();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&verified&&token&&!$('#editor').open)sync();});
window.addEventListener('beforeunload',e=>{if(verified&&(!safeToLeave()||$('#editor').open)){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{
 if(!verified)return;
 if(e.key===prefKey()||e.key===key()){
   try{if(localStorage.getItem(prefKey())==='no'){retain=false;localSaved=false;migration=false;}else if(retain&&e.key===key()&&e.newValue){db=combine(db,read());localSaved=true;scheduleSync();}render();}catch(err){cacheError=err.message;renderStatus();}
 }
});
navigate();
$('#summaryPrev').onclick=()=>changeMonth(-1);$('#summaryNext').onclick=()=>changeMonth(1);
$('#ruleFrom').onchange=()=>{if(K.validDate($('#ruleFrom').value))$('#standardHours').value=K.time(Summary.standard($('#ruleFrom').value,prefs()));};
$('#summarySettings').onsubmit=e=>{e.preventDefault();try{requireSession();const from=$('#ruleFrom').value,minutes=K.minutes(clockValue($('#standardHours').value)),weekStart=Number($('#weekStart').value);if(!K.validDate(from)||!Number.isFinite(minutes)||![0,1].includes(weekStart))throw Error('適用開始日と所定時間を確認してください。');const rules=[...(prefs().rules||[]).filter(r=>r.from!==from),{from,minutes}].sort((a,b)=>a.from.localeCompare(b.from));commit([{key:'settings',value:{...prefs(),rules,weekStart}}]);toast('集計ルールを保存しました');}catch(err){reportError(err);}};
