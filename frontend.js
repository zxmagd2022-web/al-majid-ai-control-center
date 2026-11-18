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
      await loadDashboardData();
      await loadPayments();

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
      await loadDashboardData();
      await loadPayments();

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


  let customerClient = null;

  function initializeCustomerClient() {
    if (customerClient) return customerClient;
    customerClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          storageKey: "am-customer-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      }
    );
    return customerClient;
  }

  function setStatus(id, message, isError = false) {
    const el = getElement(id);
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? "#ef4444" : "#10b981";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  async function loadDashboardData() {
    const client = initializeSupabase();
    const { data: employees, error: empError } = await client
      .from("am_ai_employees")
      .select("id,code,name,department,job_title,status")
      .order("code");
    if (empError) {
      console.error("AI employees load failed:", empError);
    } else {
      const list = getElement("employeesList");
      if (list) list.innerHTML = (employees || []).map(e =>
        '<li style="padding:10px;border-bottom:1px solid var(--border-color)"><strong>' +
        escapeHtml(e.code) + " — " + escapeHtml(e.name) +
        '</strong><div style="color:var(--text-muted);font-size:12px">' +
        escapeHtml(e.job_title || e.department || "") + " · " + escapeHtml(e.status) +
        "</div></li>"
      ).join("");
      const stat = getElement("statEmployees");
      if (stat) stat.textContent = String((employees || []).filter(e => e.status === "active").length);
    }

    const { data: clients, error: clientError } = await client
      .from("am_clients")
      .select("id,name,business_name,phone,status,client_profile_id")
      .order("created_at", { ascending: false });
    if (clientError) console.error("Clients load failed:", clientError);
    else {
      const list = getElement("clientsList");
      if (list) list.innerHTML = (clients || []).map(c =>
        '<li style="padding:8px;border-bottom:1px solid var(--border-color)">' +
        escapeHtml(c.name) + " — " + escapeHtml(c.phone || "") +
        (c.client_profile_id ? " · حساب مربوط" : " · غير مربوط") + "</li>"
      ).join("");
      ["projectClientSelect", "linkClientSelect"].forEach(id => {
        const select = getElement(id);
        if (select) select.innerHTML = '<option value="">اختر العميل...</option>' +
          (clients || []).map(c => '<option value="' + escapeHtml(c.id) + '">' +
          escapeHtml(c.name) + " — " + escapeHtml(c.phone || "") + "</option>").join("");
      });
      const stat = getElement("statClients");
      if (stat) stat.textContent = String((clients || []).length);
    }

    const { data: projects, error: projectError } = await client
      .from("am_projects")
      .select("id,title,status,budget,currency,approved_amount,client_id")
      .order("created_at", { ascending: false });
    if (projectError) console.error("Projects load failed:", projectError);
    else {
      const list = getElement("projectsList");
      if (list) list.innerHTML = (projects || []).map(p =>
        '<div style="padding:12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:10px">' +
        '<strong>' + escapeHtml(p.title) + '</strong><div style="color:var(--text-muted);font-size:13px">' +
        escapeHtml(p.status) + " · الميزانية المسجلة: " + escapeHtml(p.budget) + " " + escapeHtml(p.currency) +
        '</div><label style="margin-top:8px">المبلغ المعتمد للعميل (NGN)</label>' +
        '<input type="number" min="1" step="0.01" id="approved-' + escapeHtml(p.id) +
        '" value="' + (p.approved_amount == null ? "" : escapeHtml(p.approved_amount)) + '" placeholder="حدّد المبلغ بعد الاتفاق">' +
        '<button style="margin-top:8px" onclick="setApprovedAmount(\'' + escapeHtml(p.id) + '\')">حفظ المبلغ المعتمد</button></div>'
      ).join("");
      const stat = getElement("statProjects");
      if (stat) stat.textContent = String((projects || []).length);
    }

    const { data: tasks, error: taskError } = await client
      .from("am_ai_tasks")
      .select("id,title,status,sequence_no,output_data")
      .order("sequence_no");
    if (taskError) console.error("AI tasks load failed:", taskError);
    else {
      const list = getElement("aiTasksList");
      if (list) list.innerHTML = (tasks || []).map(t =>
        '<div style="padding:9px;border-bottom:1px solid var(--border-color)">' +
        '<strong>' + escapeHtml(t.sequence_no) + ". " + escapeHtml(t.title) + '</strong> · ' +
        escapeHtml(t.status) +
        (t.output_data && t.output_data.text ? '<details style="margin-top:6px"><summary>عرض المخرجات</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">' +
          escapeHtml(t.output_data.text) + "</pre></details>" : "") + "</div>"
      ).join("");
    }
  }

  async function runAiTeam() {
    const status = getElement("aiRunStatus");
    if (status) status.textContent = "جارٍ تشغيل الموظفين بالتتابع...";
    try {
      const client = initializeSupabase();
      const { data, error } = await client.functions.invoke("run-ai-team", { body: {} });
      if (error) throw error;
      setStatus("aiRunStatus", "اكتمل: " + (data.completed || 0) + " من " + (data.total_pending_loaded || 0) + " مهمة. راجع المخرجات أدناه.");
      await loadDashboardData();
    } catch (error) {
      console.error("AI team run failed:", error);
      setStatus("aiRunStatus", "تعذر التشغيل: تحقق من إعداد OPENAI_API_KEY وصلاحية المدير وسجلات الوظيفة.", true);
    }
  }

  async function linkClientAccount() {
    const clientId = getElement("linkClientSelect")?.value;
    const profileId = getElement("clientProfileId")?.value.trim();
    if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId || "")) {
      return setStatus("clientLinkStatus", "اختر العميل وأدخل UUID صحيحاً لحساب العميل.", true);
    }
    const { error } = await initializeSupabase().rpc("director_link_client_account", {
      p_client_id: clientId, p_profile_id: profileId
    });
    if (error) return setStatus("clientLinkStatus", "فشل الربط: " + error.message, true);
    setStatus("clientLinkStatus", "تم ربط الحساب بالعميل.");
    await loadDashboardData();
  }

  async function setApprovedAmount(projectId) {
    const amount = Number(getElement("approved-" + projectId)?.value);
    if (!Number.isFinite(amount) || amount <= 0) return alert("أدخل مبلغاً صحيحاً أكبر من صفر.");
    const { error } = await initializeSupabase().rpc("director_set_project_approved_amount", {
      p_project_id: projectId, p_amount: amount
    });
    if (error) return alert("تعذر حفظ المبلغ المعتمد: " + error.message);
    alert("تم حفظ المبلغ المعتمد للمشروع.");
    await loadDashboardData();
  }

  async function loadPayments() {
    const client = initializeSupabase();
    const { data: payments, error } = await client
      .from("payments")
      .select("id,project_id,payer_id,reference_no,amount,currency,payment_method,receipt_storage_path,status,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setStatus("paymentsList", "تعذر تحميل المدفوعات: " + error.message, true);
      return;
    }
    const list = getElement("paymentsList");
    if (!list) return;
    if (!payments?.length) {
      list.textContent = "لا توجد طلبات دفع حتى الآن.";
      return;
    }
    list.innerHTML = payments.map(p =>
      '<div style="padding:12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:10px">' +
      '<strong>' + escapeHtml(p.reference_no) + '</strong><div>' +
      escapeHtml(p.amount) + " " + escapeHtml(p.currency) + " · " + escapeHtml(p.status) +
      '</div><small style="color:var(--text-muted)">العميل: ' + escapeHtml(p.payer_id) +
      " · المشروع: " + escapeHtml(p.project_id || "غير مرتبط") + '</small>' +
      (p.receipt_storage_path ? '<div><button class="secondary" onclick="openReceipt(\'' +
        escapeHtml(p.receipt_storage_path) + '\')">عرض الإيصال</button></div>' :
        '<div style="color:var(--text-muted)">لم يُرفق إيصال بعد</div>') +
      (p.status === "submitted" ? '<button style="margin-top:8px" onclick="verifyPayment(\'' +
        escapeHtml(p.id) + '\')">اعتماد بعد التحقق البنكي الفعلي</button>' : "") +
      "</div>"
    ).join("");
  }

  async function openReceipt(path) {
    const { data, error } = await initializeSupabase().storage
      .from("am-transaction-receipts").createSignedUrl(path, 120);
    if (error) return alert("تعذر فتح الإيصال: " + error.message);
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function verifyPayment(paymentId) {
    if (!confirm("هل تحققت بنفسك من وصول المبلغ إلى حساب الوكالة؟ لا تعتمد صورة الإيصال وحدها.")) return;
    const { error } = await initializeSupabase().rpc("verify_payment", { p_payment_id: paymentId });
    if (error) return alert("تعذر اعتماد الدفع: " + error.message);
    alert("تم اعتماد الدفع بعد تأكيد المدير.");
    await loadPayments();
  }

  async function customerSignIn() {
    const email = getElement("customerEmail")?.value.trim();
    const password = getElement("customerPassword")?.value;
    if (!email || !password) return setStatus("customerStatus", "أدخل البريد وكلمة المرور.", true);
    const { error } = await initializeCustomerClient().auth.signInWithPassword({ email, password });
    if (error) return setStatus("customerStatus", "تعذر تسجيل الدخول: " + error.message, true);
    setStatus("customerStatus", "تم تسجيل دخول العميل.");
    await loadCustomerProjects();
  }

  async function loadCustomerProjects() {
    const client = initializeCustomerClient();
    const { data, error } = await client.rpc("customer_list_projects");
    if (error) return setStatus("customerStatus", "تعذر تحميل مشاريع هذا الحساب: " + error.message, true);
    const select = getElement("customerProjectSelect");
    if (!select) return;
    select.innerHTML = '<option value="">اختر مشروعك...</option>' +
      (data || []).map(p => '<option value="' + escapeHtml(p.project_id) + '">' +
        escapeHtml(p.project_title) + " — " +
        (p.approved_amount == null ? "بانتظار تحديد المبلغ" :
          escapeHtml(p.approved_amount) + " " + escapeHtml(p.currency)) + "</option>").join("");
  }

  async function requestCustomerPayment() {
    const projectId = getElement("customerProjectSelect")?.value;
    const method = getElement("customerPaymentMethod")?.value || "bank_transfer";
    if (!projectId) return setStatus("customerStatus", "اختر المشروع أولاً.", true);
    const client = initializeCustomerClient();
    const { data, error } = await client.rpc("request_project_payment", {
      p_project_id: projectId, p_payment_method: method
    });
    if (error) return setStatus("customerStatus", "تعذر إنشاء طلب الدفع: " + error.message, true);
    const payment = Array.isArray(data) ? data[0] : data;
    if (!payment?.payment_id) return setStatus("customerStatus", "لم يصل رقم طلب الدفع.", true);
    getElement("customerPaymentId").value = payment.payment_id;
    setStatus("customerStatus", "طلب الدفع: " + payment.reference_no + " — " +
      payment.amount + " " + payment.currency + ". ارفع الإيصال أدناه بعد التحويل.");
  }

  async function uploadCustomerReceipt() {
    const client = initializeCustomerClient();
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    const paymentId = getElement("customerPaymentId")?.value;
    const file = getElement("customerReceiptFile")?.files?.[0];
    if (!user || !paymentId || !file) return setStatus("customerStatus", "سجل الدخول، أنشئ طلب الدفع، واختر ملف الإيصال.", true);
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
    if (!allowed.includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      return setStatus("customerStatus", "الملف يجب أن يكون JPG أو PNG أو WebP أو PDF وبحد أقصى 10MB.", true);
    }
    const safeName = file.name.normalize("NFKD").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100);
    const path = "customer-payments/" + user.id + "/" + paymentId + "/" + Date.now() + "-" + safeName;
    const { error: uploadError } = await client.storage.from("am-transaction-receipts").upload(path, file, {
      contentType: file.type, upsert: false
    });
    if (uploadError) return setStatus("customerStatus", "فشل رفع الملف: " + uploadError.message, true);
    const fileName = path.split("/").pop();
    const { error: attachError } = await client.rpc("attach_payment_receipt", {
      p_payment_id: paymentId, p_file_name: fileName, p_mime_type: file.type
    });
    if (attachError) return setStatus("customerStatus", "تم رفع الملف لكن تعذر ربطه: " + attachError.message, true);
    setStatus("customerStatus", "تم رفع الإيصال وربطه بطلب الدفع. هذا لا يعني أن المبلغ تم تحصيله أو اعتماده.");
  }

  async function customerSignOut() {
    const { error } = await initializeCustomerClient().auth.signOut();
    setStatus("customerStatus", error ? "تعذر تسجيل الخروج." : "تم تسجيل خروج العميل.", !!error);
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
  window.loadDashboardData = loadDashboardData;
  window.runAiTeam = runAiTeam;
  window.linkClientAccount = linkClientAccount;
  window.setApprovedAmount = setApprovedAmount;
  window.loadPayments = loadPayments;
  window.openReceipt = openReceipt;
  window.verifyPayment = verifyPayment;
  window.customerSignIn = customerSignIn;
  window.loadCustomerProjects = loadCustomerProjects;
  window.requestCustomerPayment = requestCustomerPayment;
  window.uploadCustomerReceipt = uploadCustomerReceipt;
  window.customerSignOut = customerSignOut;
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
