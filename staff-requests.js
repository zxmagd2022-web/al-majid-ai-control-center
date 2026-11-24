(function(){
"use strict";
const SUPABASE_URL="https://cafvkonbubrqsabsywry.supabase.co";
const SUPABASE_KEY="sb_publishable_QvFdOACJ5_bBnhjp3Pnm0g_vG_d1iR6";
const STORAGE_KEY="sb-cafvkonbubrqsabsywry-auth-token";
const $=id=>document.getElementById(id);
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:STORAGE_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function status(msg,error=false){$("pageStatus").textContent=msg;$("pageStatus").classList.toggle("error",error)}
function showAccess(msg){$("loadingPanel").classList.add("hidden");$("accessPanel").classList.remove("hidden");$("accessMessage").textContent=msg}
async function init(){
 try{
  const {data:{session},error}=await client.auth.getSession();
  if(error||!session){showAccess("سجّل الدخول بحساب المدير أولاً.");return}
  const {data:isDirector,error:checkError}=await client.rpc("is_active_director");
  if(checkError||isDirector!==true){showAccess("هذا الحساب لا يملك صلاحية المدير النشط.");return}
  $("loadingPanel").classList.add("hidden");$("dashboard").classList.remove("hidden");
  await loadApplications();
 }catch(e){showAccess("تعذر التحقق من الصلاحيات حالياً. "+(e.message||""))}
}
async function loadApplications(){
 status("جارٍ جلب الطلبات...");
 const {data,error}=await client.from("staff_applications").select("id,user_id,full_name,email,phone,department,job_title,application_status,created_at").order("created_at",{ascending:false});
 if(error){$("requestList").innerHTML='<div class="empty">لم يتم ربط قاعدة بيانات طلبات الموظفين بعد. يلزم تطبيق مخطط قاعدة البيانات المقترح قبل استقبال الطلبات ومراجعتها.</div>';status("تعذر تحميل الطلبات: "+error.message,true);return}
 const rows=data||[];
 $("pendingCount").textContent=rows.filter(x=>x.application_status==="pending").length;
 $("approvedCount").textContent=rows.filter(x=>x.application_status==="approved").length;
 $("rejectedCount").textContent=rows.filter(x=>x.application_status==="rejected").length;
 if(!rows.length){$("requestList").innerHTML='<div class="empty">لا توجد طلبات انضمام حتى الآن.</div>';status("تم التحديث.");return}
 $("requestList").innerHTML=rows.map(x=>{
  const pending=x.application_status==="pending";
  return '<article class="application"><div class="row"><strong>'+esc(x.full_name||"موظف جديد")+'</strong><span class="pill">'+esc(x.application_status)+'</span></div>'+
   '<p>البريد: '+esc(x.email||"—")+' · الهاتف: '+esc(x.phone||"—")+'</p><p>القسم: '+esc(x.department||"—")+' · الوظيفة: '+esc(x.job_title||"—")+'</p><small class="muted">تاريخ الطلب: '+esc(new Date(x.created_at).toLocaleString())+'</small>'+
   (pending?'<div class="fields"><div><label for="role-'+esc(x.id)+'">الدور بعد الموافقة</label><select id="role-'+esc(x.id)+'"><option value="reviewer">مراجع</option><option value="moderator">مشرف</option><option value="finance">مالية</option><option value="analytics">تحليلات</option><option value="admin">إداري</option></select></div><div><label for="dept-'+esc(x.id)+'">القسم</label><input id="dept-'+esc(x.id)+'" value="'+esc(x.department||"")+'"></div><div><label for="job-'+esc(x.id)+'">المسمى الوظيفي</label><input id="job-'+esc(x.id)+'" value="'+esc(x.job_title||"")+'"></div></div><div class="actions"><button type="button" data-approve="'+esc(x.id)+'">موافقة على الطلب</button><button class="reject" type="button" data-reject="'+esc(x.id)+'">رفض الطلب</button></div>':'')+'</article>';
 }).join("");
 $("requestList").querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",()=>review(b.dataset.approve,"approved")));
 $("requestList").querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click",()=>review(b.dataset.reject,"rejected")));
 status("تم تحميل "+rows.length+" طلب.");
}
async function review(id,decision){
 if(!confirm(decision==="approved"?"تأكيد الموافقة على الموظف؟ سيتم تعيين الدور المختار.":"تأكيد رفض طلب الانضمام؟"))return;
 const role=$("role-"+id)?.value||null;
 const department=$("dept-"+id)?.value.trim()||null;
 const jobTitle=$("job-"+id)?.value.trim()||null;
 const {error}=await client.rpc("director_review_staff_application",{p_application_id:id,p_decision:decision,p_role:decision==="approved"?role:null,p_department:department,p_job_title:jobTitle});
 if(error){status("لم يتم تغيير الطلب: "+error.message,true);return}
 status(decision==="approved"?"تم اعتماد الطلب.":"تم رفض الطلب.");
 await loadApplications();
}
$("refreshButton").addEventListener("click",loadApplications);
$("backButton").addEventListener("click",()=>location.href="index.html");
$("loginButton").addEventListener("click",()=>location.href="index.html");
init();
})();