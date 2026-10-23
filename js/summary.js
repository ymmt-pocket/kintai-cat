/* Time calculations use integer minutes, JST calendar dates and start-date attribution. */
(function(root){
 const shift=(d,n)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
 const confirmed=r=>!r.off&&!!r.start&&!!r.end&&(r.company||r.lychee);
 function standard(d,p){const rules=(p.rules||[]).filter(r=>r.from<=d).sort((a,b)=>a.from.localeCompare(b.from));return rules.at(-1)?.minutes??480;}
 function total(rows,p){return rows.reduce((a,[d,r])=>{const n=K.duration(r);a.forecast+=n;if(confirmed(r)){a.actual+=n;a.overtime+=Math.max(0,n-standard(d,p));a.days++;}else if(!r.off&&r.start)a.pending++;return a;},{forecast:0,actual:0,overtime:0,days:0,pending:0});}
 function weeks(m,getRow,p){const first=m+'-01',last=K.dates(m).at(-1),weekday=new Date(first+'T12:00:00Z').getUTCDay(),start=p.weekStart??1;let d=shift(first,-((weekday-start+7)%7));const result=[];while(d<=last){const dates=Array.from({length:7},(_,i)=>shift(d,i));result.push({start:d,end:dates[6],...total(dates.map(x=>[x,getRow(x)]),p)});d=shift(d,7);}return result;}
 const api={shift,confirmed,standard,total,weeks};root.Summary=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
function renderSummary(){
 const p=prefs();$('#summaryMonth').textContent=month.replace('-','年 ')+'月';
 const weeks=Summary.weeks(month,row,p),start=weeks[0].start,end=weeks.at(-1).end;
 const relevant=conflicts().some(k=>k==='settings'||k.startsWith('d:')&&k.slice(2)>=start&&k.slice(2)<=end||k.startsWith('m:')&&k.slice(2)>=start.slice(0,7)&&k.slice(2)<=end.slice(0,7));
 $('#summaryConflict').hidden=!relevant;
 const t=Summary.total(monthRows(),p);
 for(const [id,value] of Object.entries({summaryActual:K.time(t.actual),summaryOvertime:K.time(t.overtime),summaryForecast:K.time(t.forecast),summaryPending:t.pending+' 日'}))$('#'+id).textContent=relevant?'—':value;
 $('#weeklyList').innerHTML=relevant?'<p class="muted">勤怠・設定の重複した変更を解決すると、集計を表示します。</p>':weeks.map(w=>`<article class="week-card"><div class="week-title"><strong>${esc(w.start.slice(5).replace('-','/'))} – ${esc(w.end.slice(5).replace('-','/'))}</strong><span class="tag">${w.days} 日確定</span></div><div class="week-values"><span>確定実働<strong>${K.time(w.actual)}</strong></span><span>所定超過<strong>${K.time(w.overtime)}</strong></span></div><div class="week-track" aria-hidden="true"><i style="width:${w.forecast?Math.min(100,w.actual/w.forecast*100):0}%"></i></div><p class="footnote">未確定 ${w.pending} 日 · 見込み ${K.time(w.forecast)}</p></article>`).join('');
 if(!$('#summarySettings').contains(document.activeElement)){$('#weekStart').value=String(p.weekStart??1);if(!$('#ruleFrom').value)$('#ruleFrom').value=localDate();$('#standardHours').value=K.time(Summary.standard($('#ruleFrom').value,p));}
 $('#ruleHistory').textContent='設定履歴：'+((p.rules||[]).length?(p.rules||[]).slice().sort((a,b)=>a.from.localeCompare(b.from)).map(r=>r.from+'〜 '+K.time(r.minutes)).join(' ／ '):'標準 08:00／日');
}
