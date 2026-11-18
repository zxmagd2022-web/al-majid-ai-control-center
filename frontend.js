/* AL MAJID AI CONTROL CENTER
   Frontend Authentication - Safer Session Handling
   This file does not replace the Supabase Edge Function.
*/

(function () {
  "use strict";

  const SUPABASE_URL =
    "https://cafvkonbubrqsabsywry.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_QvFdOACJ5_bBnhjp3Pnm0g_vG_d1iR6";

  let supabaseClient = null;
  let loginInProgress = false;
  let sessionRestoreInProgress = false;

  function getElement(id) {
    return document.getElementById(id);
  }

  function showLoginMessage(message, isError = false) {
    const status = getElement("loginStatus");

    if (!status) return;

    status.textContent = message;
    status.style.color = isError ? "#ef4444" : "#10b981";
  }

  function createAuthError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function initializeSupabase() {
    if (supabaseClient) return supabaseClient;

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("تعذر تحميل مكتبة Supabase.");
    }

    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    return supabaseClient;
  }

  function showSection(sectionId) {
    const allowedSections = [
      "adminLoginSection",
      "marketSection",
      "sellerSection"
    ];

    const dashboard = getElement("dashboardSection");

    document
      .querySelectorAll("#adminLoginSection, #marketSection, #sellerSection")
      .forEach(section => section.classList.add("hidden"));

    if (dashboard) dashboard.classList.add("hidden");

    if (sectionId === "dashboardSection") {
      if (dashboard) dashboard.classList.remove("hidden");
      return;
    }

    if (!allowedSections.includes(sectionId)) return;

    const section = getElement(sectionId);
    if (section) section.classList.remove("hidden");
  }

  async function verifyActiveDirector(client) {
    let result;

    try {
      result = await client.rpc("is_active_director");
    } catch (error) {
      console.error("Director verification request failed:", error);
      throw createAuthError(
        "تعذر الاتصال بخدمة التحقق من صلاحية المدير. تحقق من الاتصال ثم حاول مجدداً. لم يتم إنهاء جلستك.",
        "DIRECTOR_VERIFICATION_UNAVAILABLE"
      );
    }

    const { data: isDirector, error } = result || {};

    if (error) {
      console.error("Director verification failed:", error.message);
      throw createAuthError(
        "تعذر التحقق من صلاحية المدير حالياً. تحقق من الاتصال أو إعدادات الخدمة ثم حاول مجدداً. لم يتم إنهاء جلستك.",
        "DIRECTOR_VERIFICATION_UNAVAILABLE"
      );
    }

    if (isDirector !== true) {
      throw createAuthError(
        "هذا الحساب لا يملك صلاحية المدير النشط.",
        "DIRECTOR_ACCESS_DENIED"
      );
    }

    return true;
  }

  async function safelySignOut(client, reason) {
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Sign-out failed:", reason, error);
      return false;
    }
  }

  async function loginAdmin() {
    if (loginInProgress) return;

    const email = getElement("adminEmail")?.value.trim();
    const password = getElement("adminPassword")?.value;

    if (!email || !password) {
      showLoginMessage(
        "يرجى إدخال البريد الإلكتروني وكلمة المرور.",
        true
      );
      return;
    }

    loginInProgress = true;
    showLoginMessage("جارٍ التحقق من بيانات الدخول...");

    try {
      const client = initializeSupabase();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data?.user) {
        throw new Error(
          "تعذر تسجيل الدخول. تحقق من البيانات وحاول مجدداً."
        );
      }

      // التحقق من صلاحية المدير قبل السماح بالدخول للوحة التحكم
      try {
        await verifyActiveDirector(client);
      } catch (verificationError) {
        if (verificationError.code === "DIRECTOR_ACCESS_DENIED") {
          await safelySignOut(client, "account is not an active director");
        }
        throw verificationError;
      }

      showSection("dashboardSection");
      showLoginMessage("تم التحقق من صلاحية المدير بنجاح.");

      const passwordInput = getElement("adminPassword");
      if (passwordInput) passwordInput.value = "";

    } catch (error) {
      console.error("Admin login error:", error);
      showSection("adminLoginSection");
      showLoginMessage(
        error.message || "حدث خطأ أثناء تسجيل الدخول.",
        true
      );
    } finally {
      const passwordInput = getElement("adminPassword");
      if (passwordInput) passwordInput.value = "";
      loginInProgress = false;
    }
  }

  async function logoutAdmin() {
    try {
      const client = initializeSupabase();
      const { error } = await client.auth.signOut();

      if (error) throw error;

      showSection("adminLoginSection");
      showLoginMessage("تم تسجيل الخروج بنجاح.");

    } catch (error) {
      console.error("Logout error:", error);
      showLoginMessage(
        "تعذر إكمال تسجيل الخروج. لم نغيّر حالة العرض؛ حاول مرة أخرى.",
        true
      );
    }
  }

  async function restoreAdminSession() {
    if (sessionRestoreInProgress) return;
    sessionRestoreInProgress = true;

    try {
      const client = initializeSupabase();
      const { data, error } = await client.auth.getSession();

      if (error) {
        console.error("Session retrieval failed:", error);
        showSection("adminLoginSection");
        showLoginMessage(
          "تعذر استعادة الجلسة بسبب مشكلة اتصال. حاول تحديث الصفحة أو تسجيل الدخول مجدداً. لم يتم إنهاء جلستك تلقائياً.",
          true
        );
        return;
      }

      if (!data?.session) {
        showSection("adminLoginSection");
        return;
      }

      // التحقق من صلاحية المدير للمستخدم المستعاد جلسته قبل عرض لوحة التحكم
      try {
        await verifyActiveDirector(client);
      } catch (verificationError) {
        if (verificationError.code === "DIRECTOR_ACCESS_DENIED") {
          await safelySignOut(client, "restored account is not an active director");
          showLoginMessage(
            "هذا الحساب لا يملك صلاحية المدير النشط. يرجى استخدام حساب المدير.",
            true
          );
        } else {
          showLoginMessage(
            "تعذر التحقق من صلاحية المدير بسبب مشكلة مؤقتة. لم يتم إنهاء جلستك؛ حاول تسجيل الدخول مجدداً بعد التأكد من الاتصال.",
            true
          );
        }

        showSection("adminLoginSection");
        return;
      }

      showSection("dashboardSection");

    } catch (error) {
      console.error("Session restoration failed:", error);
      showSection("adminLoginSection");
      showLoginMessage(
        "تعذر استعادة الجلسة حالياً. لم يتم إنهاء جلستك تلقائياً؛ حاول مرة أخرى.",
        true
      );
    } finally {
      sessionRestoreInProgress = false;
    }
  }

  function switchTab(tabId) {
    const allowedTabs = [
      "statsTab",
      "employeesTab",
      "clientsTab",
      "projectsTab",
      "financeTab"
    ];

    if (!allowedTabs.includes(tabId)) return;

    document.querySelectorAll(".tab-content").forEach(tab => {
      tab.classList.add("hidden");
    });

    const selectedTab = getElement(tabId);
    if (selectedTab) selectedTab.classList.remove("hidden");
  }

  function renderMarket() {
    // السوق الحالي يعرض المحتوى الثابت الموجود في HTML.
    // لم يتم ربط المنتجات بقاعدة البيانات بعد.
  }

  function showNotConnectedMessage() {
    alert(
      "هذه الوظيفة لم تُربط بقاعدة البيانات بعد. لم يتم حفظ أي بيانات."
    );
  }

  function addProduct() {
    showNotConnectedMessage();
  }

  function addEmployee() {
    showNotConnectedMessage();
  }

  function addClient() {
    showNotConnectedMessage();
  }

  function addProject() {
    showNotConnectedMessage();
  }

  function openProjectModal() {
    const form = getElement("projectFormContainer");
    if (form) form.classList.remove("hidden");
  }

  function closeProjectModal() {
    const form = getElement("projectFormContainer");
    if (form) form.classList.add("hidden");
  }

  // ربط الدوال بأزرار HTML التي تستخدم onclick.
  window.loginAdmin = loginAdmin;
  window.logoutAdmin = logoutAdmin;
  window.showSection = showSection;
  window.switchTab = switchTab;
  window.renderMarket = renderMarket;
  window.addProduct = addProduct;
  window.addEmployee = addEmployee;
  window.addClient = addClient;
  window.addProject = addProject;
  window.openProjectModal = openProjectModal;
  window.closeProjectModal = closeProjectModal;

  // التحقق من حالة تحميل الصفحة لضمان عمل استعادة الجلسة بكفاءة
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      restoreAdminSession();
    });
  } else {
    restoreAdminSession();
  }

})();
