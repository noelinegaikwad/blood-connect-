const cfg = window.SUPABASE_CONFIG || {};
const supabaseReady = cfg.url && cfg.anonKey &&
  !cfg.url.includes("YOUR_") && !cfg.anonKey.includes("YOUR_");
const sb = supabaseReady ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;

const $ = id => document.getElementById(id);
const qs = s => document.querySelector(s);
const state = { user:null, profile:null, authMode:"login" };

function toast(message, type="success"){
  const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=message;
  $("toast").appendChild(el); setTimeout(()=>el.remove(),3500);
}
function openModal(id){ $(id).classList.remove("hidden"); }
function closeModal(id){ $(id).classList.add("hidden"); }
function initials(name="User"){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}

function demoWarning(){
  if(!supabaseReady) toast("Add your Supabase URL and anon key in config.js first.","error");
}

async function loadCounts(){
  if(!sb){ $("heroDonorCount").textContent="—"; return; }
  const {count,error}=await sb.from("profiles").select("*",{count:"exact",head:true}).eq("role","donor");
  $("heroDonorCount").textContent=error?"—":(count||0);
}

async function loadDonors(){
  const grid=$("donorGrid"), empty=$("donorEmpty");
  if(!sb){grid.innerHTML=`<div class="empty" style="grid-column:1/-1">Connect Supabase in <b>config.js</b> to load live donors.</div>`;return}
  let q=sb.from("profiles").select("id,full_name,blood_group,location,phone,is_available").eq("role","donor").order("full_name");
  const group=$("filterGroup").value, loc=$("filterLocation").value.trim(), only=$("availableOnly").checked;
  if(group) q=q.eq("blood_group",group);
  if(loc) q=q.ilike("location",`%${loc}%`);
  if(only) q=q.eq("is_available",true);
  const {data,error}=await q.limit(60);
  if(error){grid.innerHTML="";empty.classList.remove("hidden");toast(error.message,"error");return}
  grid.innerHTML=(data||[]).map(d=>`
    <article class="donor-card">
      <div class="donor-top"><div class="avatar">${initials(d.full_name)}</div><div><h3>${escapeHtml(d.full_name)}</h3><small>${escapeHtml(d.location||"Location not provided")}</small></div><span class="group-badge">${d.blood_group}</span></div>
      <div class="status ${d.is_available?"available":"off"}">${d.is_available?"Available to donate":"Currently unavailable"}</div>
      <div class="donor-meta">📍 ${escapeHtml(d.location||"—")}<br>☎ ${escapeHtml(d.phone||"Contact through platform")}</div>
      <button class="btn btn-primary" ${d.is_available?"":"disabled"} onclick="contactDonor('${d.id}')">${d.is_available?"Contact donor":"Unavailable"}</button>
    </article>`).join("");
  empty.classList.toggle("hidden",data.length>0);
}
async function contactDonor(id){
  if(!state.user){openAuth("login");toast("Login to contact a donor.","error");return}
  const {data,error}=await sb.from("profiles").select("full_name,phone").eq("id",id).single();
  if(error){toast(error.message,"error");return}
  toast(data.phone?`Contact ${data.full_name}: ${data.phone}`:`${data.full_name} is available. Use your verified contact process to connect.`);
}

async function loadRequests(){
  const grid=$("requestGrid"),empty=$("requestEmpty");
  if(!sb){grid.innerHTML=`<div class="empty" style="grid-column:1/-1">Connect Supabase to load verified requests.</div>`;return}
  const {data,error}=await sb.from("blood_requests").select("*").eq("status","verified").order("required_date",{ascending:true}).limit(30);
  if(error){grid.innerHTML="";empty.classList.remove("hidden");return}
  grid.innerHTML=(data||[]).map(r=>`
    <article class="request-card">
      <span class="urgent">${r.priority==="urgent"?"Urgent":"Blood needed"}</span>
      <h3>${escapeHtml(r.patient_name)}</h3>
      <div class="blood">${r.blood_group} · ${r.units_required} unit${r.units_required>1?"s":""}</div>
      <p>🏥 ${escapeHtml(r.hospital)}</p><p>📍 ${escapeHtml(r.location)}</p><p>📅 ${formatDate(r.required_date)}</p>
      <button class="btn btn-outline" onclick="respondToRequest('${r.id}')">I can help</button>
    </article>`).join("");
  empty.classList.toggle("hidden",data.length>0);
}
async function respondToRequest(requestId){
  if(!state.user){openAuth("login");toast("Login as a donor to respond.","error");return}
  if(state.profile?.role!=="donor"){toast("Only donor accounts can respond to blood requests.","error");return}
  const {error}=await sb.from("request_responses").insert({request_id:requestId,donor_id:state.user.id});
  if(error && !String(error.message).toLowerCase().includes("duplicate")){toast(error.message,"error");return}
  toast("Your response has been recorded. The requester can contact you.");
}

function formatDate(x){return x?new Date(x+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"—"}
function escapeHtml(x=""){return String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function openAuth(mode="login"){
  state.authMode=mode;
  $("authEyebrow").textContent=mode==="login"?"Welcome back":"Join the network";
  $("authTitle").textContent=mode==="login"?"Login":"Create donor account";
  $("authSubmit").textContent=mode==="login"?"Login":"Create account";
  $("signupFields").classList.toggle("hidden",mode!=="signup");
  $("switchAuth").innerHTML=mode==="login"?`Don't have an account? <button type="button">Sign up</button>`:`Already have an account? <button type="button">Login</button>`;
  $("switchAuth").querySelector("button").onclick=()=>openAuth(mode==="login"?"signup":"login");
  openModal("authModal");
}

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault(); demoWarning(); if(!sb)return;
  const email=$("authEmail").value.trim(), password=$("authPassword").value;
  $("authSubmit").disabled=true;
  try{
    if(state.authMode==="login"){
      const {data,error}=await sb.auth.signInWithPassword({email,password});
      if(error)throw error; state.user=data.user; await loadProfile(); closeModal("authModal"); toast("Logged in successfully."); updateHeader();
    }else{
      const name=$("authName").value.trim(),group=$("authGroup").value,location=$("authLocation").value.trim(),phone=$("authPhone").value.trim();
      if(!name||!group||!location)throw new Error("Name, blood group and location are required.");
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name,blood_group:group,location,phone,role:"donor"}}});
      if(error)throw error;
      if(data.user && data.session){state.user=data.user;await loadProfile();closeModal("authModal");toast("Account created.");}
      else toast("Account created. Check your email to confirm your account.");
    }
  }catch(err){toast(err.message||"Something went wrong.","error")}finally{$("authSubmit").disabled=false}
});

async function loadProfile(){
  if(!sb||!state.user)return;
  const {data,error}=await sb.from("profiles").select("*").eq("id",state.user.id).single();
  if(!error)state.profile=data;
}
function updateHeader(){
  const login=$("loginBtn"), signup=$("signupBtn");
  if(state.user){login.textContent="Dashboard";login.onclick=showDashboard;signup.textContent="Logout";signup.onclick=logout}
  else{login.textContent="Login";login.onclick=()=>openAuth("login");signup.textContent="Become a Donor";signup.onclick=()=>openAuth("signup")}
}

async function showDashboard(){
  if(!state.user){openAuth("login");return}
  await loadProfile();
  $("dashName").textContent=state.profile?.full_name||"My Dashboard";
  $("dashGroup").textContent=state.profile?.blood_group||"—";
  $("dashAvailability").textContent=state.profile?.is_available?"Available":"Unavailable";
  const {data}=await sb.from("donations").select("*").eq("donor_id",state.user.id).order("donation_date",{ascending:false});
  $("dashDonations").textContent=data?.length||0;
  $("historyList").innerHTML=(data||[]).map(x=>`<div class="history-item"><span>${formatDate(x.donation_date)}</span><b>${x.units||1} unit${x.units>1?"s":""}</b></div>`).join("")||`<div class="empty">No donation records yet.</div>`;
  openModal("dashboardModal");
}
$("toggleAvailability").onclick=async()=>{
  if(!state.user)return;
  const next=!state.profile.is_available;
  const {error}=await sb.from("profiles").update({is_available:next}).eq("id",state.user.id);
  if(error){toast(error.message,"error");return}
  state.profile.is_available=next;$("dashAvailability").textContent=next?"Available":"Unavailable";toast(`You are now ${next?"available":"unavailable"} to donate.`);loadDonors();
};
$("addDonation").onclick=async()=>{
  if(!state.user)return;
  const date=prompt("Donation date (YYYY-MM-DD):",new Date().toISOString().slice(0,10));
  if(!date)return;
  const {error}=await sb.from("donations").insert({donor_id:state.user.id,donation_date:date,units:1});
  if(error){toast(error.message,"error");return}
  toast("Donation record added.");showDashboard();
};
async function logout(){if(sb)await sb.auth.signOut();state.user=null;state.profile=null;closeModal("dashboardModal");updateHeader();toast("Logged out.")}

$("requestForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!state.user){closeModal("requestModal");openAuth("login");toast("Login to submit a blood request.","error");return}
  const payload={requester_id:state.user.id,patient_name:$("patientName").value.trim(),blood_group:$("requestGroup").value,units_required:Number($("units").value),hospital:$("hospital").value.trim(),location:$("requestLocation").value.trim(),required_date:$("requiredDate").value,notes:$("requestNotes").value.trim(),priority:"normal",status:"pending"};
  const {error}=await sb.from("blood_requests").insert(payload);
  if(error){toast(error.message,"error");return}
  $("requestForm").reset();closeModal("requestModal");toast("Request submitted. It will appear after admin verification.");
});

function init(){
  $("loginBtn").onclick=()=>state.user?showDashboard():openAuth("login");
  $("signupBtn").onclick=()=>state.user?logout():openAuth("signup");
  $("heroFind").onclick=()=>document.querySelector("#find").scrollIntoView();
  $("heroDonate").onclick=()=>openAuth("signup");
  $("requestBtn").onclick=()=>state.user?openModal("requestModal"):openAuth("login");
  $("filterBtn").onclick=loadDonors;
  $("quickSearchForm").onsubmit=e=>{e.preventDefault();$("filterGroup").value=$("quickGroup").value;$("filterLocation").value=$("quickLocation").value;loadDonors();document.querySelector("#find").scrollIntoView({behavior:"smooth"})};
  $("menuBtn").onclick=()=>$("nav").classList.toggle("open");
  document.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>closeModal(x.dataset.close));
  document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));
  if(sb){
    sb.auth.getSession().then(async({data})=>{state.user=data.session?.user||null;if(state.user)await loadProfile();updateHeader()});
    sb.auth.onAuthStateChange(async(_event,session)=>{state.user=session?.user||null;if(state.user)await loadProfile();updateHeader()});
  }else updateHeader();
  loadCounts();loadDonors();loadRequests();
}
init();