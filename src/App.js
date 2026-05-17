import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem("ghost_"+k)); } catch { return null; } },
  set: (k,v) => localStorage.setItem("ghost_"+k, JSON.stringify(v))
};

const G = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  :root{
    --bg:#06070A;--s1:#0C0E13;--s2:#111420;--s3:#161A26;
    --b1:rgba(255,255,255,0.04);--b2:rgba(255,255,255,0.07);
    --t1:#C8D0DC;--t2:#4E5A6E;--t3:#252D3A;
    --ice:#A8C4D8;--ghost:rgba(168,196,216,0.08);--ghostborder:rgba(168,196,216,0.12);
    --red:rgba(248,113,113,0.9);--green:rgba(134,239,172,0.9);
    --font:'Outfit',sans-serif;--mono:'JetBrains Mono',monospace;
  }
  body{background:var(--bg);color:var(--t1);font-family:var(--font);}
  ::-webkit-scrollbar{width:3px;}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}
  input,textarea,select,button{font-family:var(--font);outline:none;}
  ::placeholder{color:var(--t3);}
`;

const field = {width:"100%",padding:"9px 13px",background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:8,color:"var(--t1)",fontSize:13};
const panel = {background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:12,padding:20};
const label = {color:"var(--t2)",fontSize:11,fontWeight:500,letterSpacing:"0.8px",textTransform:"uppercase",display:"block",marginBottom:6};

function Btn({onClick,children,variant="primary",disabled,sm}){
  const v={
    primary:{background:"var(--ghost)",border:"1px solid var(--ghostborder)",color:"var(--ice)"},
    flat:{background:"transparent",border:"1px solid var(--b2)",color:"var(--t2)"},
    green:{background:"rgba(134,239,172,0.06)",border:"1px solid rgba(134,239,172,0.2)",color:"var(--green)"},
    red:{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",color:"var(--red)"},
  };
  return <button onClick={onClick} disabled={disabled} style={{...v[variant],padding:sm?"6px 14px":"9px 18px",borderRadius:8,fontSize:sm?12:13,fontWeight:500,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,opacity:disabled?0.4:1,transition:"all 0.18s",whiteSpace:"nowrap"}}>{children}</button>;
}

function Field({label:lbl,value,onChange,placeholder,type="text",mono,rows}){
  const base={...field,fontFamily:mono?"var(--mono)":"var(--font)",fontSize:mono?12:13};
  return(
    <div style={{marginBottom:14}}>
      {lbl&&<label style={label}>{lbl}</label>}
      {rows
        ?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...base,resize:"vertical",lineHeight:1.6}}/>
        :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base}/>
      }
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────
function Settings({config,setConfig}){
  const [form,setForm]=useState(config);
  const [msg,setMsg]=useState("");
  const [testing,setTesting]=useState(false);

  const save=()=>{setConfig(form);LS.set("config",form);setMsg("✓ Tersimpan");setTimeout(()=>setMsg(""),3000);};

  const test=async()=>{
    if(!form.token||!form.phoneId)return;
    setTesting(true);setMsg("");
    try{
      const r=await fetch(`https://graph.facebook.com/v18.0/${form.phoneId}?access_token=${form.token}`);
      const d=await r.json();
      setMsg(d.display_phone_number?`✓ Terhubung — ${d.display_phone_number}`:`✗ ${d.error?.message||"Gagal"}`);
    }catch{setMsg("✗ Koneksi gagal");}
    setTesting(false);
  };

  const ok=msg.startsWith("✓");
  return(
    <div style={{padding:"32px 36px",overflowY:"auto",height:"100%",maxWidth:600}}>
      <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>Pengaturan</div>
      <div style={{color:"var(--t2)",fontSize:12,marginBottom:24}}>Konfigurasi Meta WhatsApp Business API</div>
      {msg&&<div style={{background:ok?"rgba(134,239,172,0.06)":"rgba(248,113,113,0.06)",border:`1px solid ${ok?"rgba(134,239,172,0.15)":"rgba(248,113,113,0.15)"}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,fontFamily:"var(--mono)",color:ok?"var(--green)":"var(--red)"}}>{msg}</div>}
      <div style={{...panel,marginBottom:14}}>
        <div style={{...label,marginBottom:16}}>Kredensial API</div>
        <Field label="Access Token" value={form.token} onChange={v=>setForm(p=>({...p,token:v}))} placeholder="EAABxxxx..." type="password" mono/>
        <Field label="Phone Number ID" value={form.phoneId} onChange={v=>setForm(p=>({...p,phoneId:v}))} placeholder="1078926971975097" mono/>
        <Field label="WABA ID" value={form.wabaId} onChange={v=>setForm(p=>({...p,wabaId:v}))} placeholder="789593244084667" mono/>
      </div>
      <div style={{...panel,marginBottom:16}}>
        <div style={{...label,marginBottom:16}}>Webhook</div>
        <Field label="Webhook URL" value={form.webhookUrl} onChange={v=>setForm(p=>({...p,webhookUrl:v}))} placeholder="https://wawebhook-xxx.b4a.run/webhook" mono/>
        <Field label="Verify Token" value={form.verifyToken} onChange={v=>setForm(p=>({...p,verifyToken:v}))} placeholder="token123"/>
      </div>
      <div style={{display:"flex",gap:10}}>
        <Btn onClick={save}>Simpan</Btn>
        <Btn variant="flat" onClick={test} disabled={testing||!form.token||!form.phoneId}>{testing?"Testing...":"Test Koneksi"}</Btn>
      </div>
    </div>
  );
}

// ── LIVE CHAT ─────────────────────────────────────────────────────────
function LiveChat({config,contacts,qrList}){
  const [active,setActive]=useState(null);
  const [history,setHistory]=useState(LS.get("history")||{});
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [newNum,setNewNum]=useState("");
  const [modal,setModal]=useState(false);
  const endRef=useRef(null);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[history,active]);

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
      const d=await r.json();
      m.status=d.messages?"sent":"failed";
    }catch{m.status="failed";}
    saveHistory({...newH,[num]:newH[num].map(x=>x.id===m.id?m:x)});
    setSending(false);
  };

  const msgs=active?(history[active.phone]||[]):[];

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Rail */}
      <div style={{width:260,borderRight:"1px solid var(--b1)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--b1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={label}>Percakapan</span>
          <button onClick={()=>setModal(true)} style={{background:"none",border:"none",color:"var(--t2)",cursor:"pointer",fontSize:20}}>+</button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {contacts.length===0&&<div style={{padding:20,color:"var(--t3)",fontSize:12,textAlign:"center"}}>Tambah kontak dulu</div>}
          {contacts.map(c=>(
            <div key={c.id} onClick={()=>setActive(c)} style={{padding:"11px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:11,background:active?.id===c.id?"var(--ghost)":"transparent",borderBottom:"1px solid var(--b1)",borderLeft:active?.id===c.id?"2px solid var(--ice)":"2px solid transparent",transition:"all 0.15s"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"var(--s3)",border:"1px solid var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--ice)",flexShrink:0}}>{c.name.charAt(0).toUpperCase()}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                <div style={{color:"var(--t3)",fontSize:11,fontFamily:"var(--mono)"}}>{c.phone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      {active?(
        <div style={{flex:1,display:"flex",flexDirection:"column",background:"var(--bg)"}}>
          <div style={{padding:"12px 20px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",gap:12,background:"var(--s1)"}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"var(--s3)",border:"1px solid var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--ice)"}}>{active.name.charAt(0).toUpperCase()}</div>
            <div><div style={{fontWeight:500,fontSize:14}}>{active.name}</div><div style={{color:"var(--t3)",fontSize:11,fontFamily:"var(--mono)"}}>{active.phone}</div></div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:6}}>
            {msgs.length===0&&<div style={{color:"var(--t3)",textAlign:"center",marginTop:60,fontSize:13}}>— tidak ada pesan —</div>}
            {msgs.map(m=>(
              <div key={m.id} style={{display:"flex",justifyContent:m.from==="me"?"flex-end":"flex-start"}}>
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
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(input)} placeholder="Ketik pesan — Enter untuk kirim" style={{...field,flex:1}}/>
            <Btn onClick={()=>send(input)} disabled={!input.trim()||sending}>Kirim</Btn>
          </div>
        </div>
      ):(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
          <div style={{color:"var(--t3)",fontSize:28}}>💬</div>
          <div style={{color:"var(--t3)",fontSize:13}}>Pilih kontak</div>
        </div>
      )}

      {/* Modal */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99}} onClick={()=>setModal(false)}>
          <div style={{...panel,width:340,border:"1px solid var(--b2)"}} onClick={e=>e.stopPropagation()}>
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
function Blast({config,contacts,templates}){
  const [sel,setSel]=useState([]);
  const [tplName,setTplName]=useState("");
  const [freeMsg,setFreeMsg]=useState("");
  const [delay,setDelay]=useState(3);
  const [running,setRunning]=useState(false);
  const [log,setLog]=useState([]);
  const [stats,setStats]=useState({ok:0,fail:0});
  const [pct,setPct]=useState(0);

  const approved=templates.filter(t=>t.status==="APPROVED");

  const isOld=phone=>{
    const h=JSON.parse(localStorage.getItem("ghost_history")||"{}");
    const msgs=h[phone];
    if(!msgs||!msgs.length)return false;
    return(Date.now()-msgs[msgs.length-1].id)<24*60*60*1000;
  };

  const run=async()=>{
    if(!config.token||!config.phoneId)return alert("Isi Token & Phone ID dulu!");
    const targets=contacts.filter(c=>sel.includes(c.id));
    if(!targets.length)return alert("Pilih kontak dulu!");
    setRunning(true);setLog([]);setStats({ok:0,fail:0});
    let ok=0,fail=0;
    for(let i=0;i<targets.length;i++){
      const c=targets[i];
      setPct(Math.round((i/targets.length)*100));
      const old=isOld(c.phone);
      let success=false;
      try{
        let body;
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
      setLog(p=>[...p,{name:c.name,mode:old?"FREE":"TPL",success}]);
      await new Promise(r=>setTimeout(r,delay*1000));
    }
    setPct(100);setRunning(false);
  };

  return(
    <div style={{padding:"32px 36px",overflowY:"auto",height:"100%"}}>
      <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>Smart Blast</div>
      <div style={{color:"var(--t2)",fontSize:12,marginBottom:24}}>Kontak baru → Template · Kontak lama → Pesan bebas</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:20}}>
        <div>
          <div style={{...panel,marginBottom:14}}>
            <div style={{...label,marginBottom:12}}>Pilih Kontak ({sel.length}/{contacts.length})</div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <Btn sm variant="flat" onClick={()=>setSel(sel.length===contacts.length?[]:contacts.map(c=>c.id))}>{sel.length===contacts.length?"Batal Semua":"Pilih Semua"}</Btn>
            </div>
            <div style={{maxHeight:200,overflowY:"auto"}}>
              {contacts.length===0&&<div style={{color:"var(--t3)",fontSize:12,padding:"12px 0"}}>Belum ada kontak</div>}
              {contacts.map(c=>(
                <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--b1)",cursor:"pointer",fontSize:12}}>
                  <input type="checkbox" checked={sel.includes(c.id)} onChange={e=>setSel(p=>e.target.checked?[...p,c.id]:p.filter(x=>x!==c.id))} style={{accentColor:"var(--ice)",width:13,height:13}}/>
                  <span style={{flex:1}}>{c.name}</span>
                  <span style={{color:"var(--t3)",fontFamily:"var(--mono)",fontSize:11}}>{c.phone}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{...panel,marginBottom:14}}>
            <div style={{...label,marginBottom:12}}>Pesan</div>
            <div style={{marginBottom:14}}>
              <label style={label}>Template (kontak BARU)</label>
              <select value={tplName} onChange={e=>setTplName(e.target.value)} style={{...field}}>
                <option value="">— Pilih template approved —</option>
                {approved.map(t=><option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <Field label="Pesan Bebas (kontak LAMA)" value={freeMsg} onChange={setFreeMsg} placeholder={"Halo {{nama}}, ada kabar untuk kamu nih!"} rows={3}/>
            <div style={{color:"var(--t3)",fontSize:11,marginBottom:14}}>{"{{nama}}"} = nama · {"{{var1}}"} = variabel 1 · {"{{var2}}"} = variabel 2</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <label style={{...label,margin:0}}>Delay</label>
              <input type="number" value={delay} onChange={e=>setDelay(Number(e.target.value))} min={1} style={{...field,width:60,textAlign:"center"}}/>
              <span style={{color:"var(--t2)",fontSize:12}}>detik</span>
            </div>
          </div>
          <Btn variant="green" onClick={run} disabled={running||!sel.length}>
            {running?`Mengirim... ${pct}%`:`Jalankan Blast ke ${sel.length} Kontak`}
          </Btn>
          {running&&(
            <div style={{marginTop:14,height:2,background:"var(--b2)",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:"var(--ice)",transition:"width 0.3s"}}/>
            </div>
          )}
        </div>
        <div>
          <div style={{...panel,marginBottom:14}}>
            <div style={{...label,marginBottom:10}}>Statistik</div>
            {[["Total Target",sel.length,"var(--t1)"],["Berhasil",stats.ok,"var(--green)"],["Gagal",stats.fail,"var(--red)"]].map(([k,v,c])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--b1)",fontSize:13}}>
                <span style={{color:"var(--t2)"}}>{k}</span>
                <span style={{fontFamily:"var(--mono)",color:c}}>{v}</span>
              </div>
            ))}
          </div>
          {log.length>0&&(
            <div style={{...panel}}>
              <div style={{...label,marginBottom:10}}>Log</div>
              <div style={{maxHeight:300,overflowY:"auto"}}>
                {log.map((r,i)=>(
                  <div key={i} style={{display:"flex",gap:8,padding:"4px 0",fontSize:11,fontFamily:"var(--mono)",borderBottom:"1px solid var(--b1)"}}>
                    <span style={{color:r.success?"var(--green)":"var(--red)"}}>{r.success?"OK ":"ERR"}</span>
                    <span style={{color:"var(--t2)"}}>[{r.mode}]</span>
                    <span>{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div
