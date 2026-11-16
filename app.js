/**
 * AL MAJID MARKETING - Control Center Unified Frontend (app.js)
 * Secure production build with robust DOM mapping, XSS prevention, and clean separation of concerns.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// إعدادات الاتصال بـ Supabase (تأكد من مطابقتها لإعدادات مشروعك)
const SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT.supabase.co"; 
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = {
  currentUser: null,
  isDirector: false,
  activeSection: "dashboard"
};

document.addEventListener("DOMContentLoaded", async () => {
  console.log("AL MAJID Control Center Initialized.");
  initNavigation();
  initAuthListeners();
  initLeilaChat();
  initActionButtons();
  
  await checkSession();
});

/**
 * التحقق من الجلسة النشطة
 */
async function checkSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (session && session.user) {
      AppState.currentUser = session.user;
      await verifyDirectorStatus();
      showDashboardView();
      await loadDashboardData();
    } else {
      showAuthView();
    }
  } catch (err) {
    console.error("Session check error:", err);
    showAuthView();
  }
}

/**
 * التحقق من صلاحية المدير النشط عبر RPC
 */
async function verifyDirectorStatus() {
  try {
    const { data, error } = await supabase.rpc("is_active_director");
    const statusEl = document.getElementById("stats-director-status");
    
    if (!error && data === true) {
      AppState.isDirector = true;
      if (statusEl) {
        statusEl.innerText = "مدير نشط ومعتمد ✓";
        statusEl.className = "text-sm font-semibold mt-2 text-emerald-400";
      }
    } else {
      AppState.isDirector = false;
      if (statusEl) {
        statusEl.innerText = "غير مصرح بصلاحية مدير";
        statusEl.className = "text-sm font-semibold mt-2 text-rose-400";
      }
    }
  } catch (err) {
    console.error("Director verification error:", err);
    AppState.isDirector = false;
  }
}

/**
 * مصادقة الهاتف ورمز OTP
 */
function initAuthListeners() {
  const phoneForm = document.getElementById("phone-auth-form");
  const otpForm = document.getElementById("otp-verify-form");
  const logoutBtn = document.getElementById("logout-btn");

  if (phoneForm) {
    phoneForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const phoneInput = document.getElementById("phone-input").value.trim();
      if (!phoneInput) return;

      try {
        const { error } = await supabase.auth.signInWithOtp({ phone: phoneInput });
        if (error) throw error;

        document.getElementById("phone-step").style.display = "none";
        document.getElementById("otp-step").style.display = "block";
        document.getElementById("target-phone-display").innerText = phoneInput;
      } catch (err) {
        alert("خطأ في إرسال الرمز: " + err.message);
      }
    });
  }

  if (otpForm) {
    otpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const phoneInput = document.getElementById("phone-input").value.trim();
      const otpToken = document.getElementById("otp-input").value.trim();
      if (!otpToken) return;

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          phone: phoneInput,
          token: otpToken,
          type: "sms"
        });
        if (error) throw error;

        AppState.currentUser = data.user;
        await verifyDirectorStatus();
        showDashboardView();
        await loadDashboardData();
      } catch (err) {
        alert("رمز التحقق غير صحيح: " + err.message);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      AppState.currentUser = null;
      AppState.isDirector = false;
      showAuthView();
    });
  }
}

/**
 * التنقل بين أقسام الواجهة
 */
function initNavigation() {
  document.querySelectorAll("[data-target-section]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn.getAttribute("data-target-section");
      switchSection(target);
    });
  });
}

function switchSection(sectionId) {
  AppState.activeSection = sectionId;
  document.querySelectorAll(".control-section").forEach(sec => {
    sec.style.display = sec.id === `section-${sectionId}` ? "block" : "none";
  });
  document.querySelectorAll("[data-target-section]").forEach(btn => {
    if (btn.getAttribute("data-target-section") === sectionId) {
      btn.className = "px-3 py-1.5 rounded-lg bg-slate-800 text-white";
    } else {
      btn.className = "px-3 py-1.5 rounded-lg text-slate-400 hover:text-white";
    }
  });

  if (sectionId === "marketplace") {
    renderMarket();
  } else if (sectionId === "clients") {
    loadClients();
  }
}

/**
 * تحميل إحصائيات لوحة التحكم
 */
async function loadDashboardData() {
  try {
    const { count: sellersCount } = await supabase.from("am_market_sellers").select("*", { count: "exact", head: true });
    const { count: productsCount } = await supabase.from("am_products").select("*", { count: "exact", head: true });

    document.getElementById("stats-sellers-count").innerText = sellersCount || 0;
    document.getElementById("stats-products-count").innerText = productsCount || 0;
  } catch (err) {
    console.error("Error loading stats:", err);
  }
}

/**
 * ربط أزرار الواجهة وإدارة الأحداث بأمان
 */
function initActionButtons() {
  const addClientBtn = document.getElementById("add-client-btn");
  if (addClientBtn) {
    addClientBtn.addEventListener("click", promptAddClient);
  }

  const refreshMarketBtn = document.getElementById("refresh-market-btn");
  if (refreshMarketBtn) {
    refreshMarketBtn.addEventListener("click", renderMarket);
  }
}

async function promptAddClient() {
  const clientName = prompt("أدخل اسم العميل أو الشركة الجديد:");
  if (!clientName) return;
  const phone = prompt("أدخل رقم الهاتف:");
  const businessType = prompt("أدخل النشاط التجاري:");
  
  try {
    const { error } = await supabase.from("am_clients").insert([
      { name: clientName, phone, business_type: businessType }
    ]);
    if (error) throw error;
    alert("تمت إضافة العميل بنجاح.");
    loadClients();
  } catch (err) {
    alert("تعذر إضافة العميل: " + err.message);
  }
}

async function loadClients() {
  const tbody = document.getElementById("clients-table-body");
  if (!tbody) return;

  try {
    const { data, error } = await supabase.from("am_clients").select("*").limit(50);
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500">لا توجد بيانات عملاء مسجلة حالياً.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.forEach(client => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-800";

      const tdName = document.createElement("td");
      tdName.className = "p-4";
      tdName.textContent = client.name || "-";

      const tdPhone = document.createElement("td");
      tdPhone.className = "p-4 font-mono";
      tdPhone.textContent = client.phone || "-";

      const tdType = document.createElement("td");
      tdType.className = "p-4";
      tdType.textContent = client.business_type || "-";

      const tdActions = document.createElement("td");
      tdActions.className = "p-4 text-slate-400";
      tdActions.textContent = "نشط";

      tr.appendChild(tdName);
      tr.appendChild(tdPhone);
      tr.appendChild(tdType);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-rose-400">تعذر تحميل العملاء: ${err.message}</td></tr>`;
  }
}

/**
 * عرض المنتجات في السوق مع الحماية التامة من XSS باستخدام textContent
 */
async function renderMarket() {
  const grid = document.getElementById("marketplace-grid");
  if (!grid) return;
  
  grid.innerHTML = `<p class="text-slate-400 col-span-3 text-center">جاري تحميل المنتجات والبائعين...</p>`;

  try {
    const { data, error } = await supabase.from("am_products").select("*, am_market_sellers(name)").limit(20);
    if (error) throw error;

    if (!data || data.length === 0) {
      grid.innerHTML = `<p class="text-slate-500 col-span-3 text-center">لا توجد منتجات مسجلة في السوق حالياً.</p>`;
      return;
    }

    grid.innerHTML = "";
    data.forEach(p => {
      const card = document.createElement("div");
      card.className = "bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2";

      const titleEl = document.createElement("h4");
      titleEl.className = "font-bold text-white";
      titleEl.textContent = p.title || 'منتج بدون عنوان';

      const sellerEl = document.createElement("p");
      sellerEl.className = "text-xs text-slate-400";
      sellerEl.textContent = `البائع: ${p.am_market_sellers?.name || 'غير معروف'}`;

      const priceEl = document.createElement("p");
      priceEl.className = "text-emerald-400 font-mono text-sm";
      priceEl.textContent = `${p.price || 0} نيرة`;

      card.appendChild(titleEl);
      card.appendChild(sellerEl);
      card.appendChild(priceEl);
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p class="text-rose-400 col-span-3 text-center">تعذر تحميل بيانات السوق: ${err.message}</p>`;
  }
}

/**
 * تكامل دردشة ليلى الذكية
 */
function initLeilaChat() {
  const form = document.getElementById("leila-chat-form");
  const input = document.getElementById("leila-chat-input");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendMsg("user", text);
    input.value = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/bright-endpoint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: text })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "خطأ من خدمة ليلى.");

      appendMsg("assistant", result.reply);
    } catch (err) {
      appendMsg("assistant", "عذراً، حدث خطأ: " + err.message);
    }
  });
}

function appendMsg(sender, text) {
  const container = document.getElementById("leila-messages-container");
  if (!container) return;
  
  const div = document.createElement("div");
  div.className = `chat-msg ${sender} p-3 rounded-lg max-w-xl ${sender === 'user' ? 'bg-emerald-950/40 mr-auto text-white' : 'bg-slate-800 text-slate-200'}`;
  div.textContent = text; // حماية ضد الثغرات
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showAuthView() {
  document.getElementById("auth-view").style.display = "flex";
  document.getElementById("dashboard-view").style.display = "none";
}

function showDashboardView() {
  document.getElementById("auth-view").style.display = "none";
  document.getElementById("dashboard-view").style.display = "flex";
  switchSection("dashboard");
}
