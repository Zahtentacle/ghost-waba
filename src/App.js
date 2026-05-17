import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem("ghost_"+k)); } catch { return null; } },
  set: (k,v) => localStorage.setItem("ghost_"+k, JSON.stringify(v))
};

const WEBHOOK_URL = "https://wawebhook-eexpcjbc.b4a.run";

const G = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  :root{
    --bg:#06070A;--s1:#0C0E13;--s2:#111420;--s3:#161A26;
    --b1:rgba(255,255,255,0.04);--b2:rgba(255,255,255,0.07);
    --t1:#C8D0DC;--t2:#4E5A6E;--t3:#252D3A;
    --ice:#A8C4D8;--ghost:rgba(168,196,216,0.08);--ghostborder:rgba(168,196,216,0.12);
    --red:rgba(248,113,113,0.9);--green:rgba(134,239,172,0.9);--yellow:rgba(251,191,36,0.9);
    --font:'Outfit',sans-serif;--mono:'JetBrains Mono',monospace;
  }
  body{background:var(--bg);color:var(--t1);font-family:var(--font);}
  ::-webkit-scrollbar{width:3px;}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}
  input,textarea,select,button{font-family:var(--font);outline:none;}
  ::placeholder{color:var(--t3);}
  @keyframes fadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  .spin{animation:spin 1s linear infinite;display:inline-block;}
`;

const fld = {width:"100%",padding:"9px 13px",background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:8,color:"var(--t1)",fontSize:13};
const pnl = {background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:12,padding:20};
const lbl = {color:"var(--t2)",fontSize:11,fontWeight:500,letterSpacing:"0.8px",textTransform:"uppercase",display:"block",marginBottom:6};

function Btn({onClick,children,variant="primary",disabled,sm,full}){
  const v={
    primary:{background:"var(--ghost)",border:"1px solid var(--ghostborder)",color:"var(--ice)"},
    flat:{background:"transparent",border:"1px solid var(--b2)",color:"var(--t2)"},
    green:{background:"rgba(134,239,172,0.06)",border:"1px solid rgba(134,239,172,0.2)",color:"var(--green)"},
    red:{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",color:"var(--red)"},
    yellow:{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",color:"var(--yellow)"},
  };
  return <button onClick={onClick} disabled={disabled} style={{...v[variant],padding:sm?"6px 14px":"9px 18px",borderRadius:8,fontSize:sm?12:13,fontWeight:500,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,opacity:disabled?0.4:1,transition:"all 0.18s",whiteSpace:"nowrap",width:full?"100%":"auto",justifyContent:full?"center":"flex-start"}}>{children}</button>;
}

function Field({label:lb,value,onChange,placeholder,type="text",mono,rows}){
  const base={...fld,fontFamily:mono?"var(--mono)":"var(--font)",fontSize:mono?12:13};
  return(
    <div style={{marginBottom:14}}>
      {lb&&<label style={lbl}>{lb}</label>}
      {rows?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...base,resize:"vertical",lineHeight:1.6}}/>
      :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base}/>}
    </div>
  );
}

function StatusDot({on,pulse}){
  return <div style={{width:7,height:7,borderRadius:"50%",background:on?"var(--green)":"var(--t3)",boxShadow:on?"0 0 8px rgba(134,239,172,0.5)":"none",animation:pulse?"pulse 2s infinite":"none",flexShrink:0}}/>;
}

// ── DIAGNOSTICS ───────────────────────────────────────────────────────
function Diagnostics({config}){
  const [results,setResults]=useState([]);
  const [running,setRunning]=useState(false);

  const checks=[
    {
      id:"token", label:"Access Token",
      run:async()=>{
        if(!config.token)return{ok:false,msg:"Token kosong — isi di Pengaturan"};
        const r=await fetch(`https://graph.facebook.com/v18.0/me?access_token=${config.token}`);
        const d=await r.json();
        return d.id?{ok:true,msg:"Token valid ✓"}:{ok:false,msg:"Token tidak valid: "+( d.error?.message||"Unknown")};
      }
    },
    {
      id:"phone", label:"Phone Number ID",
      run:async()=>{
        if(!config.phoneId)return{ok:false,msg:"Phone ID kosong — isi di Pengaturan"};
        if(!config.token)return{ok:false,msg:"Token diperlukan dulu"};
        const r=await fetch(`https://graph.facebook.com/v18.0/${config.phoneId}?access_token=${config.token}`);
        const d=await r.json();
        return d.display_phone_number?{ok:true,msg:"Nomor: "+d.display_phone_number+" ✓"}:{ok:false,msg:d.error?.message||"Phone ID tidak valid"};
      }
    },
    {
      id:"waba", label:"WABA ID",
      run:async()=>{
        if(!config.wabaId)return{ok:false,msg:"WABA ID kosong — isi di Pengaturan"};
        if(!config.token)return{ok:false,msg:"Token diperlukan dulu"};
        const r=await fetch(`https://graph.facebook.com/v18.0/${config.wabaId}?access_token=${config.token}`);
        const d=await r.json();
        return d.id?{ok:true,msg:"WABA terhubung ✓"}:{ok:false,msg:d.error?.message||"WABA ID tidak valid"};
      }
    },
    {
      id:"webhook", label:"Webhook Server",
      run:async()=>{
        try{
          const r=await fetch(WEBHOOK_URL+"/health");
          const d=await r.json();
          return d.status==="ok"?{ok:true,msg:`Server aktif · ${d.totalReceived} pesan diterima`}:{ok:false,msg:"Server error"};
        }catch{return{ok:false,msg:"Webhook tidak bisa diakses — cek Back4app"};}
      }
    },
    {
      id:"templates", label:"Template Approved",
      run:async()=>{
        if(!config.token||!config.wabaId)return{ok:false,msg:"Token & WABA ID diperlukan"};
        const r=await fetch(`https://graph.facebook.com/v18.0/${config.wabaId}/message_templates?access_token=${config.token}`);
        const d=await r.json();
        if(!d.data)return{ok:false,msg:d.error?.message||"Gagal ambil template"};
        const approved=d.data.filter(t=>t.status==="APPROVED");
        const pending=d.data.filter(t=>t.status==="PENDING");
        if(approved.length>0)return{ok:true,msg:`${approved.length} approved · ${pending.length} pending`};
        return{ok:false,msg:`Belum ada template approved · ${pending.length} masih pending (tunggu 1-3 hari)`};
      }
    },
  ];

  const runAll=async()=>{
    setRunning(true);setResults([]);
    for(const check of checks){
      setResults(p=>[...p,{id:check.id,label:check.label,status:"running"}]);
      try{
        const result=await check.run();
        setResults(p=>p.map(r=>r.id===check.id?{...r,status:result.ok?"ok":"fail",msg:result.msg}:r));
      }catch(e){
        setResults(p=>p.map(r=>r.id===check.id?{...r,status:"fail",msg:"Error: "+e.message}:r));
      }
    }
    setRunning(false);
  };

  const color={ok:"var(--green)",fail:"var(--red)",running:"var(--yellow)"};
  const icon={ok:"✓",fail:"✗",running:"·"};

  return(
    <div style={{padding:"32px 36px",overflowY:"auto",height:"100%",maxWidth:640}}>
      <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>Diagnostik</div>
      <div style={{color:"var(--t2)",fontSize:12,marginBottom:24}}>Cek semua koneksi & konfigurasi secara otomatis</div>

      <div style={{...pnl,marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontWeight:600}}>System Health Check</span>
          <Btn onClick={runAll} disabled={running}>{running?"Mengecek...":"▶ Jalankan Semua"}</Btn>
        </div>
        {results.length===0&&!running&&(
          <div style={{color:"var(--t3)",textAlign:"center",padding:"30px 0",fontSize:13}}>Klik "Jalankan Semua" untuk mulai diagnosis</div>
        )}
        {checks.map((check,i)=>{
          const r=results.find(x=>x.id===check.id);
          return(
            <div key={check.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:i<checks.length-1?"1px solid var(--b1)":"none"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:r?color[r.status]+"15":"var(--s2)",border:`1px solid ${r?color[r.status]+"30":"var(--b2)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:r?color[r.status]:"var(--t3)",flexShrink:0,animation:r?.status==="running"?"pulse 1s infinite":"none"}}>
                {r?icon[r.status]:"○"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:2}}>{check.label}</div>
                {r?.msg&&<div style={{fontSize:12,color:r.status==="ok"?"var(--t2)":color[r.status],fontFamily:"var(--mono)"}}>{r.msg}</div>}
              </div>
              {r?.status==="fail"&&(
                <Btn sm variant="yellow" onClick={()=>{
                  if(check.id==="token"||check.id==="phone"||check.id==="waba")alert("Buka tab Pengaturan dan isi kredensial yang benar.");
                  if(check.id==="webhook")alert("Buka Back4app → pastikan container status Available.");
                  if(check.id==="templates")alert("Template belum approved. Tunggu 1-3 hari atau buat template baru di tab Template.");
                }}>Fix →</Btn>
              )}
            </div>
          );
        })}
      </div>

      {results.length>0&&!running&&(
        <div style={{...pnl,background:results.every(r=>r.status==="ok")?"rgba(134,239,172,0.04)":"rgba(248,113,113,0.04)",borderColor:results.every(r=>r.status==="ok")?"rgba(134,239,172,0.15)":"rgba(248,113,113,0.15)"}}>
          <div style={{fontWeight:600,marginBottom:8,color:results.every(r=>r.status==="ok")?"var(--green)":"var(--red)"}}>
            {results.every(r=>r.status==="ok")?"✓ Semua sistem normal":"⚠ Ada masalah yang perlu diperbaiki"}
          </div>
          <div style={{color:"var(--t2)",fontSize:13}}>
            {results.filter(r=>r.status==="ok").length}/{results.length} komponen berjalan normal
          </div>
        </div>
      )}
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────
function Settings({config,setConfig}){
  const [form,setForm]=useState(config);
  const [msg,setMsg]=useState("");

  const save=()=>{
    setConfig(form);LS.set("config",form);
    setMsg("✓ Tersimpan");setTimeout(()=>setMsg(""),3000);
  };

  const ok=msg.startsWith("✓");
  return(
    <div style={{padding:"32px 36px",overflowY:"auto",height:"100%",maxWidth:600}}>
      <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>Pengaturan</div>
      <div style={{color:"var(--t2)",fontSize:12,marginBottom:24}}>Konfigurasi Meta WhatsApp Business API</div>
      {msg&&<div style={{background:ok?"rgba(134,239,172,0.06)":"rgba(248,113,113,0.06)",border:`1px solid ${ok?"rgba(134,239,172,0.15)":"rgba(248,113,113,0.15)"}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,fontFamily:"var(--mono)",color:ok?"var(--green)":"var(--red)"}}>{msg}</div>}
      <div style={{...pnl,marginBottom:14}}>
        <div style={{...lbl,marginBottom:16}}>Kredensial API</div>
        <Field label="Access Token" value={form.token} onChange={v=>setForm(p=>({...p,token:v}))} type="password" placeholder="EAABxxxx..." mono/>
        <Field label="Phone Number ID" value={form.phoneId} onChange={v=>setForm(p=>({...p,phoneId:v}))} placeholder="1078926971975097" mono/>
        <Field label="WABA ID" value={form.wabaId} onChange={v=>setForm(p=>({...p,wabaId:v}))} placeholder="789593244084667" mono/>
      </div>
      <div style={{...pnl,marginBottom:16}}>
        <div style={{...lbl,marginBottom:16}}>Webhook</div>
        <Field label="Webhook URL" value={form.webhookUrl} onChange={v=>setForm(p=>({...p,webhookUrl:v}))} placeholder="https://wawebhook-xxx.b4a.run/webhook" mono/>
        <Field label="Verify Token" value={form.verifyToken} onChange={v=>setForm(p=>({...p,verifyToken:v}))} placeholder="token123"/>
      </div>
      <Btn onClick={save}>Simpan Pengaturan</Btn>
    </div>
  );
}

// ── LIVE CHAT ─────────────────────────────────────────────────────────
function LiveChat({config,contacts,qrList}){
  const [active,setActive]=useState(null);
  const [history,setHistory]=useState(LS.get("history")||{});
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [modal,setModal]=useState(false);
  const [newNum,setNewNum]=useState("");
  const [lastSync,setLastSync]=useState(null);
  const endRef=useRef(null);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[history,active]);

  // Real-time polling dari Back4app
  const pollMessages=useCallback(async()=>{
    try{
      const r=await fetch(`${WEBHOOK_URL}/messages?since=${lastSync||""}`);
      const d=await r.json();
      if(d.messages&&d.messages.length>0){
        const newH={...history};
        d.messages.forEach(m=>{
          if(!newH[m.from])newH[m.from]=[];
          const exists=newH[m.from].find(x=>x.id===m.id);
          if(!exists)newH[m.from].unshift({id:m.id,from:"them",text:m.text,time:new Date(m.time).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),name:m.name});
        });
        setHistory(newH);LS.set("history",newH);
        setLastSync(new Date().toISOString());
      }
    }catch{}
  },[history,lastSync]);

  useEffect(()=>{
    const interval=setInterval(pollMessages,5000);
    return()=>clearInterval(interval);
  },[pollMessages]);

  const saveHistory=h=>{setHistory(h);LS.set("history",h);};

  const send=async(txt,to)=>{
    const num=to||active?.phone;
    if(!num||!txt.trim()||!config.token)return;
    setSending(true);
    const m={id:Date.now(),from:"me",text:txt,time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),status:"sending"};
    const newH={...history,[num]:[...(history[num]||[]),m]};
    saveHistory(newH);setInput("");
    try{
      const r=await fetch(`https://graph.facebook.com/v18.0/${config.phoneId}/messages`,{
        method:"POST",headers:{"Authorization":`Bearer ${config.token}`,"Content-Type":"application/json"},
        body:JSON.stringify({messaging_product:"whatsapp",to:num,type:"text",text:{body:txt}})
      });
      const d=await r.json();m.status=d.messages?"sent":"failed";
    }catch{m.status="failed";}
    saveHistory({...newH,[num]:newH[num].map(x=>x.id===m.id?m:x)});
    setSending(false);
  };

  const allContacts=[...contacts];
  Object.keys(history).forEach(phone=>{
    if(!allContacts.find(c=>c.phone===phone)){
      const msgs=history[phone];
      const name=msgs[0]?.name||phone;
      allContacts.push({id:phone,name,phone});
    }
  });

  const msgs=active?(history[active.phone]||[]):[];

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div style={{width:260,borderRight:"1px solid var(--b1)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--b1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={lbl}>Percakapan</span>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
              <StatusDot on={true} pulse={true}/>
              <span style={{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}}>LIVE · 5s</span>
            </div>
          </div>
          <button onClick={()=>setModal(true)} style={{background:"none",border:"none",color:"var(--t2)",cursor:"pointer",fontSize:20}}>+</button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {allContacts.length===0&&<div style={{padding:20,color:"var(--t3)",fontSize:12,textAlign:"center"}}>Belum ada percakapan</div>}
          {allContacts.map(c=>{
            const lastMsg=(history[c.phone]||[]).slice(-1)[0];
            return(
              <div key={c.id} onClick={()=>setActive(c)} style={{padding:"11px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:11,background:active?.id===c.id?"var(--ghost)":"transparent",borderBottom:"1px solid var(--b1)",borderLeft:active?.id===c.id?"2px solid var(--ice)":"2px solid transparent",transition:"all 0.15s"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"var(--s3)",border:"1px solid var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--ice)",flexShrink:0}}>{c.name.charAt(0).toUpperCase()}</div>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                  {lastMsg&&<div style={{fontSize:11,color:"var(--t3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastMsg.text}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {active?(
        <div style={{flex:1,display:"flex",flexDirection:"column",background:"var(--bg)"}}>
          <div style={{padding:"12px 20px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",gap:12,background:"var(--s1)"}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"var(--s3)",border:"1px solid var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--ice)"}}>{active.name.charAt(0).toUpperCase()}</div>
            <div><div style={{fontWeight:500,fontSize:14}}>{active.name}</div><div style={{color:"var(--t3)",fontSize:11,fontFamily:"var(--mono)"}}>{active.phone}</div></div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:6}}>
            {msgs.length===0&&<div style={{color:"var(--t3)",textAlign:"center",marginTop:60,fontSize:13}}>— tidak ada pesan —</div>}
            {msgs.map(m=>(
              <div key={m.id} style={{display:"flex",justifyContent:m.from==="me"?"flex-end":"flex-start",animation:"fadeUp 0.2s ease"}}>
                <div style={{maxWidth:"60%",padding:"9px 14px",background:m.from==="me"?"var(--ghost)":"var(--s2)",border:`1px solid ${m.from==="me"?"var(--ghostborder)":"var(--b2)"}`,borderRadius:m.from==="me"?"12px 12px 3px 12px":"12px 12px 12px 3px",fontSize:13,lineHeight:1.55}}>
                  <div>{m.text}</div>
                  <div style={{display:"flex",justifyContent:"flex-end",gap:4,marginTop:3,fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}}>
                    <span>{m.time}</span>
                    {m.from==="me"&&<span style={{color:m.status==="sent"?"var(--ice)":m.status==="failed"?"var(--red)":"var(--t3)"}}>{m.status==="sending"?"·":m.status==="sent"?"✓✓":"✗"}</span>}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endRef}/>
          </div>
          {qrList.length>0&&(
            <div style={{padding:"6px 16px",display:"flex",gap:6,overflowX:"auto",borderTop:"1px solid var(--b1)"}}>
              {qrList.map(q=><button key={q.id} onClick={()=>setInput(q.text)} style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:20,padding:"4px 12px",color:"var(--t2)",fontSize:11,whiteSpace:"nowrap",cursor:"pointer"}}>/{q.label}</button>)}
            </div>
          )}
          <div style={{padding:"12px 16px",borderTop:"1px solid var(--b1)",display:"flex",gap:8,background:"var(--s1)"}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(input)} placeholder="Ketik pesan — Enter untuk kirim" style={{...fld,flex:1}}/>
            <Btn onClick={()=>send(input)} disabled={!input.trim()||sending}>Kirim</Btn>
          </div>
        </div>
      ):(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
          <div style={{color:"var(--t3)",fontSize:28}}>💬</div>
          <div style={{color:"var(--t3)",fontSize:13}}>Pilih percakapan</div>
        </div>
      )}

      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99}} onClick={()=>setModal(false)}>
          <div style={{...pnl,width:340,border:"1px solid var(--b2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:600,marginBottom:16}}>Chat ke Nomor Baru</div>
            <Field label="Nomor WA (628xxx)" value={newNum} onChange={setNewNum} placeholder="6281234567890" mono/>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>{if(newNum){setActive({id:newNum,name:newNum,phone:newNum});setModal(false);setNewNum("");}}}>Buka Chat</Btn>
              <Btn variant="flat" onClick={()=>setModal(false)}>Batal</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BLAST ─────────────────────────────────────────────────────────────
function Blast({config,contacts}){
  const [templates,setTemplates]=useState(LS.get("templates")||[]);
  const [sel,setSel]=useState([]);
  const [tplName,setTplName]=useState("");
  const [freeMsg,setFreeMsg]=useState("");
  const [delay,setDelay]=useState(3);
  const [running,setRunning]=useState(false);
  const [log,setLog]=useState([]);
  const [stats,setStats]=useState({ok:0,fail:0});
  const [pct,setPct]=useState(0);
  const [syncing,setSyncing]=useState(false);

  const syncTpl=async()=>{
    if(!config.token||!config.wabaId){alert("Isi Token & WABA ID di Pengaturan!");return;}
    setSyncing(true);
    try{
      const r=await fetch(`https://graph.facebook.com/v18.0/${config.wabaId}/message_templates?access_token=${config.token}`);
      const d=await r.json();
      if(d.data){setTemplates(d.data);LS.set("templates",d.data);}
    }catch{}
    setSyncing(false);
  };

  const approved=templates.filter(t=>t.status==="APPROVED");

  const isOld=phone=>{
    const h=JSON.parse(localStorage.getItem("ghost_history")||"{}");
    const msgs=h[phone];
    if(!msgs||!msgs.length)return false;
    return(Date.now()-new Date(msgs[msgs.length-1].time||0))< 24*60*60*1000;
  };

  const run=async()=>{
    if(!config.token||!config.phoneId){alert("Isi Token & Phone ID di Pengaturan!");return;}
    const targets=contacts.filter(c=>sel.includes(c.id));
    if(!targets.length){alert("Pilih kontak dulu!");return;}
    setRunning(true);setLog([]);setStats({ok:0,fail:0});setPct(0);
    let ok=0,fail=0;
    for(let i=0;i<targets.length;i++){
      const c=targets[i];
      setPct(Math.round((i/targets.length)*100));
      const old=isOld(c.phone);
      let success=false;
      try{
        if(old&&freeMsg){
          const msg=freeMsg.replace(/\{\{nama\}\}/g,c.name).replace(/\{\{var1\}\}/g,c.var1||"").replace(/\{\{var2\}\}/g,c.var2||"");
          const r=await fetch(`https://graph.facebook.com/v18.0/${config.phoneId}/messages`,{method:"POST",headers:{"Authorization":`Bearer ${config.token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:c.phone,type:"text",text:{body:msg}})});
          const d=await r.json();success=!!d.messages;
        }else if(tplName){
          const params=[];
          if(c.name)params.push({type:"text",text:c.name});
          if(c.var1)params.push({type:"text",text:c.var1});
          const r=await fetch(`https://graph.facebook.com/v18.0/${config.phoneId}/messages`,{method:"POST",headers:{"Authorization":`Bearer ${config.token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:c.phone,type:"template",template:{name:tplName,language:{code:"id"},components:params.length?[{type:"body",parameters:params}]:[]}})});
          const d=await r.json();success=!!d.messages;
        }
      }catch{}
      if(success)ok++;else fail++;
      setStats({ok,fail});
      setLog(p=>[...p,{name:c.name,phone:c.phone,mode:old?"FREE":"TPL",success}]);
      await new Promise(r=>setTimeout(r,delay*1000));
    }
    setPct(100);setRunning(false);
    const logs=LS.get("blastlog")||[];
    logs.unshift({date:new Date().toLocaleString("id-ID"),ok,fail,total:targets.length});
    LS.set("blastlog",logs.slice(0,20));
  };

  return(
    <div style={{padding:"32px 36px",overflowY:"auto",height:"100%"}}>
      <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>Smart Blast</div>
      <div style={{color:"var(--t2)",fontSize:12,marginBottom:24}}>Kontak baru → Template · Kontak lama → Pesan bebas</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:20}}>
        <div>
          <div style={{...pnl,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={lbl}>Pilih Kontak ({sel.length}/{contacts.length})</span>
              <Btn sm variant="flat" onClick={()=>setSel(sel.length===contacts.length?[]:contacts.map(c=>c.id))}>{sel.length===contacts.length?"Batal":"Pilih Semua"}</Btn>
            </div>
            <div style={{maxHeight:200,overflowY:"auto"}}>
              {contacts.length===0&&<div style={{color:"var(--t3)",fontSize:12,padding:"12px 0"}}>Belum ada kontak — tambah di tab Kontak</div>}
              {contacts.map(c=>(
                <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--b1)",cursor:"pointer",fontSize:12}}>
                  <input type="checkbox" checked={sel.includes(c.id)} onChange={e=>setSel(p=>e.target.checked?[...p,c.id]:p.filter(x=>x!==c.id))} style={{accentColor:"var(--ice)",width:13,height:13}}/>
                  <span style={{flex:1}}>{c.name}</span>
                  <span style={{color:"var(--t3)",fontFamily:"var(--mono)",fontSize:11}}>{c.phone}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{...pnl,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={lbl}>Template (kontak BARU)</span>
              <Btn sm variant="flat" onClick={syncTpl} disabled={syncing}>{syncing?"Syncing...":"↻ Sync"}</Btn>
            </div>
            <select value={tplName} onChange={e=>setTplName(e.target.value)} style={{...fld,marginBottom:14}}>
              <option value="">— Pilih template approved —</option>
              {approved.map(t=><option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            {approved.length===0&&<div style={{color:"var(--yellow)",fontSize:11,fontFamily:"var(--mono)",marginBottom:14}}>⚠ Belum ada template approved · klik Sync atau tunggu approval</div>}
            <Field label="Pesan Bebas (kontak LAMA &lt; 24 jam)" value={freeMsg} onChange={setFreeMsg} placeholder={"Halo {{nama}}, ada info penting untuk kamu!"} rows={3}/>
            <div style={{color:"var(--t3)",fontSize:11,marginBottom:14}}>{"{{nama}}"} · {"{{var1}}"} · {"{{var2}}"}</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <label style={{...lbl,margin:0}}>Delay</label>
              <input type="number" value={delay} onChange={e=>setDelay(Number(e.target.value))} min={1} style={{...fld,width:60,textAlign:"center"}}/>
              <span style={{color:"var(--t2)",fontSize:12}}>detik</span>
            </div>
          </div>

          <Btn variant="green" onClick={run} disabled={running||!sel.length} full>
            {running?`Mengirim... ${pct}%`:`▶ Blast ke ${sel.length} Kontak`}
          </Btn>
          {running&&<div style={{marginTop:10,height:2,background:"var(--b2)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:"var(--ice)",transition:"width 0.3s"}}/></div>}
        </div>

        <div>
          <div style={{...pnl,marginBottom:14}}>
            <div style={{...lbl,marginBottom:12}}>Statistik</div>
            {[["Target",sel.length,"var(--t1)"],["Berhasil",stats.ok,"var(--green)"],["Gagal",stats.fail,"var(--red)"]].map(([k,v,c])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--b1)",fontSize:13}}>
                <span style={{color:"var(--t2)"}}>{k}</span>
                <span style={{fontFamily:"var(--mono)",color:c,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
          {log.length>0&&(
            <div style={pnl}>
              <div style={{...lbl,marginBottom:10}}>Log Real-time</div>
              <div style={{maxHeight:320,overflowY:"auto"}}>
                {log.map((r,i)=>(
                  <div key={i} style={{display:"flex",gap:8,padding:"4px 0",fontSize:11,fontFamily:"var(--mono)",borderBottom:"1px solid var(--b1)"}}>
                    <span style={{color:r.success?"var(--green)":"var(--red)"}}>{r.success?"OK ":"ERR"}</span>
                    <span style={{color:"var(--t2)"}}>[{r.mode}]</span>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CONTACTS ──────────────────────────────────────────────────────────
function Contacts({contacts,setContacts}){
  const [form,setForm]=useState({name:"",phone:"",tag:"",var1:"",var2:""});
  const [search,setSearch]=useState("");
  const [msg,setMsg]=useState("");

  const add=()=>{
    if(!form.name||!form.phone)return;
    const next=[...contacts,{id:Date.now(),...form}];
    setContacts(next);LS.set("contacts",next);
    setForm({name:"",phone:"",tag:"",var1:"",var2:""});
  };

  const del=id=>{const next=contacts.filter(c=>c.id!==id);setContacts(next);LS.set("contacts",next);};

  const importXLS=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const wb=XLSX.read(ev.target.result,{type:"binary"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1}).filter(r=>r.length>0);
      const newC=rows.slice(1).map(r=>({id:Date.now()+Math.random(),name:String(r[0]||""),phone:String(r[1]||""),tag:"excel",var1:String(r[2]||""),var2:String(r[3]||"")})).filter(r=>r.name&&r.phone);
      const next=[...contacts,...newC];setContacts(next);LS.set("contacts",next);
      setMsg(`✓ ${newC.length} kontak diimport dari Excel`);setTimeout(()=>setMsg(""),4000);
    };
    reader.readAsBinaryString(file);e.target.value="";
  };

  const importVCF=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const newC=[];
      ev.target.result.split("BEGIN:VCARD").forEach(card=>{
        const nm=card.match(/FN:(.+)/);const tel=card.match(/TEL[^:]*:(.+)/);
        if(nm&&tel){
          let phone=tel[1].trim().replace(/[\s\-\(\)]/g,"");
          if(phone.startsWith("0"))phone="62"+phone.slice(1);
          if(phone.startsWith("+"))phone=phone.slice(1);
          newC.push({id:Date.now()+Math.random(),name:nm[1].trim(),phone,tag:"vcf",var1:"",var2:""});
        }
      });
      const next=[...contacts,...newC];setContacts(next);LS.set("contacts",next);
      setMsg(`✓ ${newC.length} kontak diimport dari VCF`);setTimeout(()=>setMsg(""),4000);
    };
    reader.readAsText(file);e.target.value="";
  };

  const filtered=contacts.filter(c=>c.name?.toLowerCase().includes(search.toLowerCase())||c.phone?.includes(search));

  return(
    <div style={{padding:"32px 36px",overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div><div style={{fontSize:17,fontWeight:600,marginBottom:4}}>Database Kontak</div><div style={{color:"var(--t2)",fontSize:12}}>{contacts.length} kontak</div></div>
        <div style={{display:"flex",gap:8}}>
          <input type="file" id="xls-in" accept=".xlsx,.xls" style={{display:"none"}} onChange={importXLS}/>
          <input type="file" id="vcf-in" accept=".vcf" style={{display:"none"}} onChange={importVCF}/>
          <Btn sm variant="flat" onClick={()=>document.getElementById("xls-in").click()}>Import Excel</Btn>
          <Btn sm variant="flat" onClick={()=>document.getElementById("vcf-in").click()}>Import VCF</Btn>
        </div>
      </div>
      {msg&&<div style={{background:"rgba(134,239,172,0.06)",border:"1px solid rgba(134,239,172,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,fontFamily:"var(--mono)",color:"var(--green)"}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:20}}>
        <div style={pnl}>
          <div style={{...lbl,marginBottom:16}}>Tambah Manual</div>
          <Field label="Nama" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Nama Lengkap"/>
          <Field label="Nomor WA" value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="6281234567890" mono/>
          <Field label="Tag" value={form.tag} onChange={v=>setForm(p=>({...p,tag:v}))} placeholder="vip, member..."/>
          <Field label="Variabel 1" value={form.var1} onChange={v=>setForm(p=>({...p,var1:v}))} placeholder="nama produk / info"/>
          <Field label="Variabel 2" value={form.var2} onChange={v=>setForm(p=>({...p,var2:v}))} placeholder="link / kode promo"/>
          <Btn onClick={add} disabled={!form.name||!form.phone}>Tambah</Btn>
        </div>
        <div style={pnl}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kontak..." style={{...fld,marginBottom:14}}/>
          <div style={{overflowY:"auto",maxHeight:420}}>
            {filtered.length===0?<div style={{color:"var(--t3)",textAlign:"center",padding:"40px 0",fontSize:13}}>— tidak ada kontak —</div>
            :filtered.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--b1)"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:"var(--s3)",border:"1px solid var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--ice)",flexShrink:0}}>{c.name?.charAt(0)?.toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500}}>{c.name}</div>
                  <div style={{color:"var(--t3)",fontSize:11,fontFamily:"var(--mono)"}}>{c.phone}</div>
                </div>
                {c.tag&&<span style={{background:"rgba(168,196,216,0.1)",color:"var(--ice)",border:"1px solid rgba(168,196,216,0.2)",borderRadius:5,padding:"2px 7px",fontSize:11}}>{c.tag}</span>}
                <button onClick={()=>del(c.id)} style={{background:"none",border:"none",color:"var(--t3)",cursor:"pointer",fontSize:14}}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────
const NAV=[
  {id:"chat",icon:"💬",label:"Live Chat"},
  {id:"blast",icon:"📢",label:"Blast"},
  {id:"contacts",icon:"👥",label:"Kontak"},
  {id:"diag",icon:"🔍",label:"Diagnostik"},
  {id:"settings",icon:"⚙️",label:"Pengaturan"},
];

export default function App(){
  const [page,setPage]=useState("chat");
  const [config,setConfig]=useState(LS.get("config")||{token:"",phoneId:"",wabaId:"",webhookUrl:"",verifyToken:"token123"});
  const [contacts,setContacts]=useState(LS.get("contacts")||[]);
  const qrList=LS.get("qr")||[];

  return(
    <>
      <style>{G}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        <div style={{width:200,background:"var(--s1)",borderRight:"1px solid var(--b1)",display:"flex",flexDirection:"column",padding:"20px 0",flexShrink:0}}>
          <div style={{padding:"0 16px 20px",borderBottom:"1px solid var(--b1)",marginBottom:8}}>
            <div style={{fontSize:16,fontWeight:700,color:"var(--ice)",letterSpacing:1}}>GHOST</div>
            <div style={{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}}>WABA · v2.0</div>
          </div>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{width:"100%",padding:"11px 16px",border:"none",background:page===n.id?"var(--ghost)":"transparent",color:page===n.id?"var(--t1)":"var(--t2)",display:"flex",alignItems:"center",gap:10,fontSize:13,fontWeight:page===n.id?600:400,cursor:"pointer",borderLeft:page===n.id?"2px solid var(--ice)":"2px solid transparent",transition:"all 0.15s",textAlign:"left"}}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
          <div style={{flex:1}}/>
          <div style={{padding:"12px 16px",borderTop:"1px solid var(--b1)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <StatusDot on={!!config.token}/>
              <span style={{fontSize:11,color:"var(--t2)"}}>{config.token?"API Aktif":"Belum Setup"}</span>
            </div>
          </div>
        </div>
        <div style={{flex:1,overflow:"hidden"}}>
          {page==="chat"&&<LiveChat config={config} contacts={contacts} qrList={qrList}/>}
          {page==="blast"&&<Blast config={config} contacts={contacts}/>}
          {page==="contacts"&&<Contacts contacts={contacts} setContacts={setContacts}/>}
          {page==="diag"&&<Diagnostics config={config}/>}
          {page==="settings"&&<Settings config={config} setConfig={setConfig}/>}
        </div>
      </div>
    </>
  );
              }
