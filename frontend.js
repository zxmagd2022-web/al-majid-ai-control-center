
/* AL MAJID AI CONTROL CENTER
   Frontend Authentication - Test Branch
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

  function getElement(id) {
    return document.getElementById(id);
  }

  function showLoginMessage(message, isError = false) {
    const status = getElement("loginStatus");

    if (!status) return;

    status.textContent = message;
    status.style.color = isError ? "#ef4444" : "#10b981";
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
    const {
      data: isDirector,
      error
    } = await client.rpc("is_active_director");

    if (error) {
      console.error("Director verification failed:", error.message);
      throw new Error(
        "تعذر التحقق من صلاحية المدير. يرجى مراجعة إعدادات الصلاحيات."
      );
    }

    if (isDirector !== true) {
      throw new Error(
        "هذا الحساب لا يملك صلاحية المدير النشط."
      );
    }

    return true;
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

      const {
        data,
        error
      } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.user) {
        throw new Error(
          "تعذر تسجيل الدخول. تحقق من البيانات وحاول مجدداً."
        );
      }

      try {
        await verifyActiveDirector(client);
      } catch (verificationError) {
        await client.auth.signOut();
        throw verificationError;
      }

      showSection("dashboardSection");
      showLoginMessage("تم التحقق من صلاحية المدير بنجاح.");

      const passwordInput = getElement("adminPassword");
      if (passwordInput) passwordInput.value = "";

    } catch (error) {
      console.error("Admin login error:", error);
      showLoginMessage(
        error.message || "حدث خطأ أثناء تسجيل الدخول.",
        true
      );
    } finally {
      loginInProgress = false;
    }
  }

  async function logoutAdmin() {
    try {
      const client = initializeSupabase();
      const { error } = await client.auth.signOut();

      if (error) {
        throw error;
      }

      showSection("adminLoginSection");
      showLoginMessage("تم تسجيل الخروج بنجاح.");

    } catch (error) {
      console.error("Logout error:", error);
      showLoginMessage(
        "تعذر إكمال تسجيل الخروج. حاول مرة أخرى.",
        true
      );
    }
  }

  async function restoreAdminSession() {
    try {
      const client = initializeSupabase();

      const {
        data,
        error
      } = await client.auth.getSession();

      if (error) throw error;

      if (!data.session) {
        showSection("adminLoginSection");
        return;
      }

      await verifyActiveDirector(client);
      showSection("dashboardSection");

    } catch (error) {
      console.error("Session restoration failed:", error);

      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }

      showSection("adminLoginSection");
      showLoginMessage(
        "انتهت الجلسة أو تعذر التحقق من صلاحية المدير. سجل الدخول مجدداً.",
        true
      );
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

  document.addEventListener("DOMContentLoaded", () => {
    restoreAdminSession();
  });

})();
