/* Production refresh marker: restore current dashboard data loader on Cloudflare Pages. 2026-11-26 */
/* AL MAJID AI CONTROL CENTER
   Frontend Authentication - Safer Session Handling
   This file does not replace the Supabase Edge Function.
*/

(function () {
  "use strict";

  const SUPABASE_URL =
    "https://cafvkonbubrqsabsywry.supabase.co";

  // نفس مفتاح التخزين الافتراضي لمشروع Supabase، محدد صراحةً لضمان ثباته.
  const ADMIN_AUTH_STORAGE_KEY =
    "sb-cafvkonbubrqsabsywry-auth-token";

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
          storageKey: ADMIN_AUTH_STORAGE_KEY,
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

  async function loginAdminWithGoogle() {
    if (loginInProgress) return;

    loginInProgress = true;
    showLoginMessage("جارٍ تحويلك إلى Google لتسجيل الدخول...");

    try {
      const client = initializeSupabase();
      const { error } = await client.auth.signInWithOAuth({
        provider: "google"
      });

      if (error) {
        throw new Error(
          "تعذر بدء تسجيل الدخول عبر Google. تحقق من تفعيل Google في إعدادات المصادقة ثم حاول مجدداً."
        );
      }
    } catch (error) {
      console.error("Admin Google login error:", error);
      showSection("adminLoginSection");
      showLoginMessage(
        error.message || "تعذر تسجيل الدخول عبر Google حالياً.",
        true
      );
      loginInProgress = false;
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
      try {
        await loadDashboardData();
        await loadPayments();
      } catch (dashboardError) {
        console.error(
          "Dashboard data loading failed after login; admin session retained:",
          dashboardError
        );
      }

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

      if (adminChatPoller) window.clearInterval(adminChatPoller);
      adminChatPoller = null;
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
        showLoginMessage(
          "لم يتم العثور على جلسة محفوظة في هذا المتصفح. سجّل الدخول مرة أخرى؛ سنستخدم هذه الرسالة لتحديد سبب عدم الاحتفاظ بالجلسة.",
          true
        );
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
      try {
        await loadDashboardData();
        await loadPayments();
      } catch (dashboardError) {
        console.error(
          "Dashboard data loading failed after session restoration; admin session retained:",
          dashboardError
        );
      }

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
      "financeTab",
      "chatTab"
    ];

    if (!allowedTabs.includes(tabId)) return;

    document.querySelectorAll(".tab-content").forEach(tab => {
      tab.classList.add("hidden");
    });

    const selectedTab = getElement(tabId);
    if (selectedTab) selectedTab.classList.remove("hidden");
    if (tabId === "chatTab") {
      loadAdminConversations();
      startAdminChatPolling();
    }
  }

  function renderMarket() {
    // السوق الحالي يعرض المحتوى الثابت الموجود في HTML.
    // لم يتم ربط المنتجات بقاعدة البيانات بعد.
  }

  let productSubmissionInProgress = false;

  function setProductSubmissionStatus(message, isError = false) {
    let status = getElement("product-status") ||
      getElement("productStatus") ||
      getElement("sellerProductStatus");

    const form = getElement("add-product-form");
    if (!status && form) {
      status = document.createElement("p");
      status.id = "product-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      form.appendChild(status);
    }

    if (status) {
      status.textContent = message;
      status.style.color = isError ? "#ef4444" : "#10b981";
    }
  }

  async function addProduct(event) {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    if (productSubmissionInProgress) return;

    const titleInput = getElement("product-name") ||
      getElement("productName") ||
      getElement("sellerProductTitle");
    const descriptionInput = getElement("product-description") ||
      getElement("productDescription") ||
      getElement("sellerProductDescription");
    const priceInput = getElement("product-price") ||
      getElement("productPrice") ||
      getElement("sellerProductPrice");
    const submitButton = getElement("submit-product-review") ||
      getElement("submitProductReview") ||
      (event && event.submitter);

    const title = titleInput?.value?.trim() || "";
    const description = descriptionInput?.value?.trim() || "";
    const price = Number(priceInput?.value);

    if (title.length < 2) {
      setProductSubmissionStatus("أدخل اسم المنتج (حرفان على الأقل).", true);
      titleInput?.focus();
      return;
    }
    if (!priceInput || priceInput.value.trim() === "" ||
        !Number.isFinite(price) || price <= 0) {
      setProductSubmissionStatus("أدخل سعراً صحيحاً أكبر من صفر بالنايرا NGN.", true);
      priceInput?.focus();
      return;
    }

    productSubmissionInProgress = true;
    if (submitButton) submitButton.disabled = true;
    setProductSubmissionStatus("جارٍ التحقق من حساب البائع وحفظ المنتج للمراجعة...");

    try {
      const client = initializeSupabase();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;

      const user = sessionData?.session?.user;
      if (!user?.id || !user.email_confirmed_at) {
        throw new Error("سجّل الدخول بحساب البائع وأكّد بريدك الإلكتروني أولاً.");
      }

      const { data: seller, error: sellerError } = await client
        .from("am_market_sellers")
        .select("id,status")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (sellerError) throw sellerError;
      if (!seller || !["pending", "active"].includes(seller.status)) {
        throw new Error("لم نعثر على متجر مرتبط بحسابك. سجّل المتجر أولاً وانتظر مراجعة الإدارة.");
      }

      const { data: savedProduct, error: insertError } = await client
        .from("am_market_products")
        .insert({
          seller_id: seller.id,
          title,
          description: description || null,
          price,
          currency: "NGN",
          status: "pending"
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!savedProduct?.id) {
        throw new Error("لم نتلقَّ تأكيد حفظ المنتج من قاعدة البيانات.");
      }

      const form = getElement("add-product-form");
      if (form) form.reset();
      setProductSubmissionStatus("تم حفظ المنتج وإرساله للمراجعة بنجاح. لن يظهر في السوق قبل موافقة الإدارة.");
    } catch (error) {
      console.error("Vendor product submission failed:", error);
      setProductSubmissionStatus(
        "تعذر إرسال المنتج: " + (error?.message || "حدث خطأ غير معروف."),
        true
      );
    } finally {
      productSubmissionInProgress = false;
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function addEmployee() {
    const name = getElement("empName")?.value.trim() || "";
    const instructions = getElement("empRole")?.value.trim() || "";
    if (name.length < 2 || instructions.length < 5) {
      return setStatus("aiRunStatus", "أدخل اسم الموظف وتعليمات واضحة (5 أحرف على الأقل).", true);
    }
    const client = initializeSupabase();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      return setStatus("aiRunStatus", "انتهت جلسة المدير. سجّل الدخول مجدداً.", true);
    }
    const { data: existing, error: listError } = await client
      .from("am_ai_employees").select("code").order("code", { ascending: false }).limit(1);
    if (listError) return setStatus("aiRunStatus", "تعذر قراءة رموز الموظفين: " + listError.message, true);
    const lastNumber = Number(String(existing?.[0]?.code || "AI00").replace(/^AI/i, "")) || 0;
    const code = "AI" + String(lastNumber + 1).padStart(2, "0");
    const { error } = await client.from("am_ai_employees").insert({
      code, name, department: "عام", job_title: name, language: "ar,en,ha",
      instructions, status: "active"
    });
    if (error) return setStatus("aiRunStatus", "تعذر حفظ الموظف: " + error.message, true);
    getElement("empName").value = "";
    getElement("empRole").value = "";
    setStatus("aiRunStatus", "تم حفظ الموظف " + code + " بنجاح.");
    await loadDashboardData();
  }

  async function createAiTask() {
    const title = getElement("aiTaskTitle")?.value.trim() || "";
    const description = getElement("aiTaskDescription")?.value.trim() || "";
    if (title.length < 3 || description.length < 10) {
      return setStatus("aiRunStatus", "اكتب عنوان المهمة ووصفاً واضحاً لا يقل عن 10 أحرف.", true);
    }
    const client = initializeSupabase();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      return setStatus("aiRunStatus", "انتهت جلسة المدير. سجّل الدخول مجدداً.", true);
    }
    const { data: employees, error: employeeError } = await client
      .from("am_ai_employees").select("id,name,code").eq("status", "active").order("code");
    if (employeeError) return setStatus("aiRunStatus", "تعذر تحميل فريق الذكاء الاصطناعي: " + employeeError.message, true);
    if (!employees?.length) return setStatus("aiRunStatus", "لا يوجد موظفون AI نشطون.", true);
    const { data: pending, error: pendingError } = await client
      .from("am_ai_tasks").select("id").eq("status", "pending").limit(1);
    if (pendingError) return setStatus("aiRunStatus", "تعذر التحقق من المهام المعلقة: " + pendingError.message, true);
    if (pending?.length) return setStatus("aiRunStatus", "توجد مهام معلقة بالفعل. شغّلها أولاً قبل إنشاء مهمة جديدة.", true);
    const rows = employees.map((employee, index) => ({
      employee_id: employee.id,
      title: title + " — " + employee.name,
      input_data: { project_context: { user_request: description }, handoff_required: true, execution_mode: "prepare_only" },
      status: "pending",
      sequence_no: index + 1,
      assigned_by: sessionData.session.user.id
    }));
    const { error: insertError } = await client.from("am_ai_tasks").insert(rows);
    if (insertError) return setStatus("aiRunStatus", "تعذر إنشاء المهام: " + insertError.message, true);
    getElement("aiTaskTitle").value = "";
    getElement("aiTaskDescription").value = "";
    setStatus("aiRunStatus", "تم إنشاء " + rows.length + " مهام بالتتابع. جارٍ تشغيل الفريق...");
    await refreshAiTaskProgress();
    await runAiTeam();
  }

  async function addClient() {
    const client = initializeSupabase();
    const name = getElement("clientName")?.value.trim();
    if (!name) return alert("أدخل اسم العميل أولاً.");
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (sessionError || !user) return alert("انتهت جلسة المدير. سجّل الدخول مجدداً.");
    const payload = {
      name,
      business_name: getElement("clientBusiness")?.value.trim() || null,
      phone: getElement("clientPhone")?.value.trim() || null,
      whatsapp: getElement("clientWhatsapp")?.value.trim() || null,
      email: getElement("clientEmail")?.value.trim() || null,
      country: getElement("clientCountry")?.value.trim() || "Nigeria",
      state: getElement("clientState")?.value || null,
      notes: getElement("clientNotes")?.value.trim() || null,
      created_by: user.id
    };
    const button = document.querySelector('#clientsTab button[onclick="addClient()"]');
    if (button) button.disabled = true;
    try {
      const { error } = await client.from("am_clients").insert(payload);
      if (error) throw error;
      ["clientName","clientBusiness","clientPhone","clientWhatsapp","clientEmail","clientNotes"].forEach(id => {
        const input = getElement(id); if (input) input.value = "";
      });
      setStatus("clientFormStatus", "تم حفظ العميل بنجاح.");
      await loadDashboardData();
    } catch (error) {
      console.error("Client save failed:", error);
      alert("تعذر حفظ العميل: " + (error.message || "خطأ غير معروف"));
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function addProject() {
    const client = initializeSupabase();
    const title = getElement("projectTitle")?.value.trim();
    const clientId = getElement("projectClientSelect")?.value;
    const budgetValue = getElement("projectBudget")?.value.trim();
    const budget = budgetValue === "" ? 0 : Number(budgetValue);
    if (!title) return alert("أدخل اسم المشروع.");
    if (!clientId) return alert("اختر العميل المرتبط بالمشروع.");
    if (!Number.isFinite(budget) || budget < 0) return alert("أدخل ميزانية صحيحة.");
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (sessionError || !user) return alert("انتهت جلسة المدير. سجّل الدخول مجدداً.");
    const statusLabel = getElement("projectStatus")?.value || "قيد الانتظار";
    const status = statusLabel === "قيد التنفيذ" ? "in_progress" :
      statusLabel === "مكتمل" ? "completed" : "pending";
    const button = document.querySelector('#projectFormContainer button[onclick="addProject()"]');
    if (button) button.disabled = true;
    try {
      const { error } = await client.from("am_projects").insert({
        client_id: clientId,
        title,
        description: getElement("projectDesc")?.value.trim() || null,
        budget,
        currency: "NGN",
        status,
        created_by: user.id
      });
      if (error) throw error;
      ["projectTitle","projectDesc","projectBudget"].forEach(id => {
        const input = getElement(id); if (input) input.value = "";
      });
      if (getElement("projectClientSelect")) getElement("projectClientSelect").value = "";
      closeProjectModal();
      await loadDashboardData();
      alert("تم حفظ المشروع بنجاح.");
    } catch (error) {
      console.error("Project save failed:", error);
      alert("تعذر حفظ المشروع: " + (error.message || "خطأ غير معروف"));
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function addFinanceTransaction() {
    const client = initializeSupabase();
    const type = getElement("financeType")?.value;
    const amountValue = getElement("financeAmount")?.value.trim();
    const amount = Number(amountValue);
    const date = getElement("financeDate")?.value;
    const file = getElement("financeReceipt")?.files?.[0];
    if (!["income","expense"].includes(type)) return alert("اختر نوع الحركة المالية.");
    if (!amountValue || !Number.isFinite(amount) || amount <= 0) return alert("أدخل مبلغاً صحيحاً أكبر من صفر.");
    if (file && (!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type) || file.size > 10*1024*1024)) {
      return alert("الإيصال يجب أن يكون JPG أو PNG أو WebP أو PDF وبحد أقصى 10MB.");
    }
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (sessionError || !user) return alert("انتهت جلسة المدير. سجّل الدخول مجدداً.");
    const button = getElement("saveFinanceButton");
    if (button) button.disabled = true;
    let uploadedPath = null;
    try {
      const { data: transaction, error } = await client.from("am_finance_transactions").insert({
        type,
        category: getElement("financeCategory")?.value.trim() || null,
        amount,
        currency: "NGN",
        transaction_date: date || new Date().toISOString().slice(0,10),
        description: getElement("financeDescription")?.value.trim() || null,
        reference: getElement("financeReference")?.value.trim() || null,
        recorded_by: user.id
      }).select("id").single();
      if (error) throw error;
      if (file) {
        const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
        uploadedPath = "director/" + user.id + "/" + transaction.id + "/" + crypto.randomUUID() + "." + ext;
        const { error: uploadError } = await client.storage.from("am-transaction-receipts").upload(uploadedPath,file,{
          contentType:file.type,upsert:false
        });
        if (uploadError) throw uploadError;
        const { error: receiptError } = await client.from("am_transaction_receipts").insert({
          transaction_id:transaction.id,storage_path:uploadedPath,file_name:file.name,mime_type:file.type,uploaded_by:user.id
        });
        if (receiptError) throw receiptError;
      }
      ["financeAmount","financeCategory","financeDescription","financeReference","financeReceipt"].forEach(id=>{
        const input=getElement(id); if(input) input.value="";
      });
      setStatus("financeStatus","تم حفظ الحركة المالية"+(file?" وإرفاق الإيصال.":"."),false);
      await loadFinanceTransactions();
    } catch (error) {
      console.error("Finance save failed:",error);
      setStatus("financeStatus","تعذر إكمال الحفظ: "+(error.message||"خطأ غير معروف")+
        (uploadedPath?" (تم رفع الملف، لكن قد يحتاج ربطه بالحركة إلى مراجعة المدير).":""),true);
    } finally { if(button) button.disabled=false; }
  }

  async function loadFinanceTransactions() {
    const client = initializeSupabase();
    const list = getElement("financeList");
    if (!list) return;
    const { data, error } = await client.from("am_finance_transactions")
      .select("id,type,category,amount,currency,transaction_date,description,reference")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      list.textContent = "تعذر تحميل السجل المالي: " + error.message;
      return;
    }
    if (!data?.length) {
      list.textContent = "لا توجد حركات مالية مسجلة بعد.";
      return;
    }

    // اربط الإيصالات بالحركات في استعلام واحد، مع إبقاء الملفات في التخزين الخاص.
    const transactionIds = data.map(item => item.id);
    const { data: receipts, error: receiptsError } = await client
      .from("am_transaction_receipts")
      .select("transaction_id,storage_path,file_name")
      .in("transaction_id", transactionIds);
    if (receiptsError) {
      console.warn("Finance receipts load failed:", receiptsError);
    }
    const receiptsByTransaction = new Map();
    (receipts || []).forEach(receipt => {
      const current = receiptsByTransaction.get(receipt.transaction_id) || [];
      current.push(receipt);
      receiptsByTransaction.set(receipt.transaction_id, current);
    });

    list.innerHTML = data.map(item => {
      const attachedReceipts = receiptsByTransaction.get(item.id) || [];
      const receiptLinks = attachedReceipts.map(receipt =>
        '<button type="button" class="secondary" data-action="open-receipt" data-receipt-path="' +
        escapeHtml(receipt.storage_path) + '" style="margin:6px 6px 0 0">عرض الإيصال: ' +
        escapeHtml(receipt.file_name || "ملف مرفق") + '</button>'
      ).join("");
      return '<div style="padding:12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px">' +
        '<strong>' + (item.type === "income" ? "إيراد" : "مصروف") + ' — ' +
        escapeHtml(item.amount) + ' ' + escapeHtml(item.currency) + '</strong>' +
        '<div>' + escapeHtml(item.category || "بدون تصنيف") + ' · ' +
        escapeHtml(item.transaction_date) + '</div>' +
        '<div style="color:var(--text-muted)">' + escapeHtml(item.description || "") +
        (item.reference ? " · " + escapeHtml(item.reference) : "") + '</div>' +
        (receiptLinks || '<div style="color:var(--text-muted);font-size:12px;margin-top:5px">لا يوجد إيصال مرفق.</div>') +
        '</div>';
    }).join("");
  }


  let customerClient = null;
  let customerChatPoller = null;
  let adminChatPoller = null;
  let customerRecorder = null;
  let customerRecordingChunks = [];
  let recordedCustomerAudioFile = null;

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
          detectSessionInUrl: true
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
    const loadErrors = [];
    const statusEl = getElement("dashboardDataStatus");
    if (statusEl) {
      statusEl.textContent = "جارٍ تحميل بيانات لوحة التحكم...";
      statusEl.style.color = "var(--text-muted)";
    }
    const { data: employees, error: empError } = await client
      .from("am_ai_employees")
      .select("id,code,name,department,job_title,status")
      .order("code");
    if (empError) {
      console.error("AI employees load failed:", empError);
      loadErrors.push("الموظفون: " + (empError.message || "تعذر القراءة"));
      const stat = getElement("statEmployees");
      if (stat) stat.textContent = "خطأ";
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
    if (clientError) {
      console.error("Clients load failed:", clientError);
      loadErrors.push("العملاء: " + (clientError.message || "تعذر القراءة"));
      const stat = getElement("statClients");
      if (stat) stat.textContent = "خطأ";
    }
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

    await loadFinanceTransactions().catch(error => console.warn("Finance transactions load failed:", error));

    const { data: projects, error: projectError } = await client
      .from("am_projects")
      .select("id,title,status,budget,currency,approved_amount,client_id")
      .order("created_at", { ascending: false });
    if (projectError) {
      console.error("Projects load failed:", projectError);
      loadErrors.push("المشاريع: " + (projectError.message || "تعذر القراءة"));
      const stat = getElement("statProjects");
      if (stat) stat.textContent = "خطأ";
    }
    else {
      const list = getElement("projectsList");
      if (list) list.innerHTML = (projects || []).map(p =>
        '<div style="padding:12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:10px">' +
        '<strong>' + escapeHtml(p.title) + '</strong><div style="color:var(--text-muted);font-size:13px">' +
        escapeHtml(p.status) + " · الميزانية المسجلة: " + escapeHtml(p.budget) + " " + escapeHtml(p.currency) +
        '</div><label style="margin-top:8px">المبلغ المعتمد للعميل (NGN)</label>' +
        '<input type="number" min="1" step="0.01" id="approved-' + escapeHtml(p.id) +
        '" value="' + (p.approved_amount == null ? "" : escapeHtml(p.approved_amount)) + '" placeholder="حدّد المبلغ بعد الاتفاق">' +
        '<button type="button" data-action="set-approved-amount" data-project-id="' + escapeHtml(p.id) +
        '" style="margin-top:8px">حفظ المبلغ المعتمد</button></div>'
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

    if (statusEl) {
      if (loadErrors.length) {
        statusEl.textContent = "تعذر تحميل بعض البيانات: " + loadErrors.join(" | ");
        statusEl.style.color = "#ef4444";
      } else {
        statusEl.textContent = "تم تحميل بيانات لوحة التحكم بنجاح.";
        statusEl.style.color = "#10b981";
      }
    }
  }

  let aiTeamRunInProgress = false;

  async function refreshAiTaskProgress() {
    const client = initializeSupabase();
    const { data: tasks, error } = await client
      .from("am_ai_tasks")
      .select("title,status,sequence_no,output_data")
      .order("sequence_no");
    if (error) throw error;

    const all = tasks || [];
    const completed = all.filter(t => t.status === "completed").length;
    const failed = all.filter(t => t.status === "failed").length;
    const pending = all.filter(t => t.status === "pending").length;
    const running = all.find(t => t.status === "in_progress");

    const list = getElement("aiTasksList");
    if (list) list.innerHTML = all.map(t =>
      '<div style="padding:9px;border-bottom:1px solid var(--border-color)">' +
      '<strong>' + escapeHtml(t.sequence_no) + ". " + escapeHtml(t.title) + '</strong> · ' +
      escapeHtml(t.status) +
      (t.output_data && t.output_data.text ? '<details style="margin-top:6px"><summary>عرض المخرجات</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">' +
        escapeHtml(t.output_data.text) + "</pre></details>" : "") + "</div>"
    ).join("");

    return { total: all.length, completed, failed, pending, running };
  }

  async function runAiTeam() {
    if (aiTeamRunInProgress) return;

    aiTeamRunInProgress = true;
    const runButton = document.querySelector('button[onclick="runAiTeam()"]');
    const originalButtonText = runButton ? runButton.textContent : "";
    if (runButton) {
      runButton.disabled = true;
      runButton.textContent = "جارٍ تشغيل الفريق...";
      runButton.setAttribute("aria-busy", "true");
    }

    setStatus("aiRunStatus", "بدأ التشغيل بالتتابع. سيتم تحديث تقدم الموظفين تلقائياً...");

    const progressLoop = (async () => {
      while (aiTeamRunInProgress) {
        try {
          const progress = await refreshAiTaskProgress();
          const current = progress.running
            ? " · يعمل الآن: " + progress.running.sequence_no + ". " + progress.running.title
            : "";
          setStatus(
            "aiRunStatus",
            "التقدم: " + progress.completed + "/" + progress.total +
            " مكتملة · " + progress.failed + " فاشلة · " +
            progress.pending + " بانتظار التنفيذ" + current
          );
        } catch (progressError) {
          console.warn("AI task progress refresh failed:", progressError);
        }
        await new Promise(resolve => window.setTimeout(resolve, 2500));
      }
    })();

    let finalStatusMessage = "";
    let finalStatusIsError = false;
    try {
      const client = initializeSupabase();
      const { data, error } = await client.functions.invoke("run-ai-team", { body: {} });
      if (error) throw error;

      const finalProgress = await refreshAiTaskProgress();
      finalStatusMessage =
        "انتهى طلب التشغيل: " + (data.completed || 0) + " من " +
        (data.total_pending_loaded || 0) + " مهمة في هذا الطلب. " +
        "الحالة الإجمالية: " + finalProgress.completed + "/" +
        finalProgress.total + " مكتملة، " + finalProgress.failed +
        " فاشلة، " + finalProgress.pending + " بانتظار التنفيذ.";
    } catch (error) {
      console.error("AI team run failed:", error);
      finalStatusMessage = "تعذر التشغيل. تحقق من الاتصال وصلاحية المدير وسجلات الوظيفة.";
      finalStatusIsError = true;
    } finally {
      aiTeamRunInProgress = false;
      await progressLoop;
      if (runButton) {
        runButton.disabled = false;
        runButton.textContent = originalButtonText;
        runButton.removeAttribute("aria-busy");
      }
      await loadDashboardData();
      if (finalStatusMessage) setStatus("aiRunStatus", finalStatusMessage, finalStatusIsError);
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
      (p.receipt_storage_path ? '<div><button type="button" class="secondary" data-action="open-receipt" data-receipt-path="' +
        escapeHtml(p.receipt_storage_path) + '">عرض الإيصال</button></div>' :
        '<div style="color:var(--text-muted)">لم يُرفق إيصال بعد</div>') +
      (p.status === "submitted" ? '<button type="button" data-action="verify-payment" data-payment-id="' +
        escapeHtml(p.id) + '" style="margin-top:8px">اعتماد بعد التحقق البنكي الفعلي</button>' : "")
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

  const CHAT_BUCKET = "am-client-chat-media";
  const CHAT_MAX_FILE_SIZE = 50 * 1024 * 1024;
  const CHAT_ALLOWED_MIME_TYPES = new Set([
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-m4a",
    "application/pdf"
  ]);

  function chatMediaKind(mimeType) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "file";
  }

  function getChatFileMime(file) {
    return String(file?.type || "").split(";")[0].trim().toLowerCase();
  }

  async function uploadChatAttachment(client, userId, conversationId, messageId, file) {
    const mimeType = getChatFileMime(file);
    if (!CHAT_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error("نوع الملف غير مدعوم. اختر صورة أو فيديو أو صوتاً أو PDF.");
    }
    if (!file.size || file.size > CHAT_MAX_FILE_SIZE) {
      throw new Error("حجم الملف يجب ألا يتجاوز 50MB.");
    }

    const safeName = String(file.name || "attachment")
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/\.\.+/g, ".")
      .slice(0, 100) || "attachment";
    const storagePath = userId + "/" + conversationId + "/" + messageId + "-" + safeName;
    const { error: uploadError } = await client.storage.from(CHAT_BUCKET).upload(storagePath, file, {
      contentType: mimeType,
      upsert: false
    });
    if (uploadError) throw uploadError;

    const { error: rowError } = await client.from("am_message_attachments").insert({
      message_id: messageId,
      conversation_id: conversationId,
      storage_path: storagePath,
      file_name: safeName,
      mime_type: mimeType,
      file_size: file.size,
      media_kind: chatMediaKind(mimeType),
      uploaded_by: userId
    });
    if (rowError) throw rowError;
  }

  async function renderChatMessages(client, containerId, conversationId) {
    const container = getElement(containerId);
    if (!container) return;
    if (!conversationId) {
      container.innerHTML = '<div class="chat-empty">اختر محادثة لعرض الرسائل.</div>';
      return;
    }

    const { data: messages, error } = await client
      .from("am_messages")
      .select("id,sender_type,content,message_type,language,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      container.textContent = "تعذر تحميل الرسائل: " + error.message;
      return;
    }
    if (!messages?.length) {
      container.innerHTML = '<div class="chat-empty">لا توجد رسائل بعد. ابدأ المحادثة برسالة جديدة.</div>';
      return;
    }

    const { data: attachments, error: attachmentError } = await client
      .from("am_message_attachments")
      .select("message_id,storage_path,file_name,mime_type,media_kind")
      .eq("conversation_id", conversationId);
    if (attachmentError) console.warn("Chat attachments load failed:", attachmentError);

    const attachmentMap = new Map();
    for (const item of attachments || []) {
      if (!attachmentMap.has(item.message_id)) attachmentMap.set(item.message_id, []);
      attachmentMap.get(item.message_id).push(item);
    }

    const rendered = [];
    for (const message of messages) {
      const senderLabel = ({
        customer: "العميل",
        agency: "وكالة الماجد",
        ai: "مساعد الماجد AI",
        human: "موظف الوكالة",
        system: "النظام"
      })[message.sender_type] || "رسالة";
      const files = [];
      for (const attachment of attachmentMap.get(message.id) || []) {
        const { data: signed, error: signedError } = await client.storage
          .from(CHAT_BUCKET).createSignedUrl(attachment.storage_path, 120);
        if (signedError || !signed?.signedUrl) continue;
        const url = escapeHtml(signed.signedUrl);
        const name = escapeHtml(attachment.file_name);
        if (attachment.media_kind === "image") {
          files.push('<a href="' + url + '" target="_blank" rel="noopener"><img src="' + url + '" alt="' + name + '"></a>');
        } else if (attachment.media_kind === "video") {
          files.push('<video controls preload="metadata" src="' + url + '"></video>');
        } else if (attachment.media_kind === "audio") {
          files.push('<audio controls preload="metadata" src="' + url + '"></audio>');
        } else {
          files.push('<a href="' + url + '" target="_blank" rel="noopener">' + name + '</a>');
        }
      }
      const dateLabel = new Date(message.created_at).toLocaleString();
      rendered.push(
        '<article class="chat-message chat-' + escapeHtml(message.sender_type) + '">' +
        '<strong>' + senderLabel + '</strong>' +
        (message.content ? '<div style="white-space:pre-wrap;margin-top:5px">' + escapeHtml(message.content) + '</div>' : '') +
        files.join("") +
        '<small>' + escapeHtml(dateLabel) + (message.language ? " · " + escapeHtml(message.language) : "") + '</small>' +
        '</article>'
      );
    }
    container.innerHTML = rendered.join("");
    container.scrollTop = container.scrollHeight;
  }

  async function loadCustomerConversations() {
    const client = initializeCustomerClient();
    const { data: conversations, error } = await client
      .from("am_conversations")
      .select("id,subject,status,preferred_language,created_at")
      .order("created_at", { ascending: false });
    if (error) return setStatus("customerChatStatus", "تعذر تحميل المحادثات: " + error.message, true);

    const select = getElement("customerConversationSelect");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = (conversations || []).map(c =>
      '<option value="' + escapeHtml(c.id) + '">' +
      escapeHtml(c.subject || "محادثة") + " · " + escapeHtml(c.status) +
      " · " + escapeHtml(new Date(c.created_at).toLocaleDateString()) + "</option>"
    ).join("") || '<option value="">لا توجد محادثات بعد</option>';

    const selectedId = (conversations || []).some(c => c.id === previous) ? previous : conversations?.[0]?.id;
    if (selectedId) select.value = selectedId;
    await renderChatMessages(client, "customerChatMessages", selectedId || "");
  }

  async function startCustomerConversation() {
    const projectId = getElement("customerProjectSelect")?.value;
    const language = getElement("customerChatLanguage")?.value || "ar";
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
      return setStatus("customerChatStatus", "لا يمكن بدء المحادثة قبل تحميل مشروع مرتبط وصالح. حدّث المشاريع أو تواصل مع الوكالة.", true);
    }
    const { data, error } = await initializeCustomerClient().rpc("customer_start_conversation", {
      p_project_id: projectId,
      p_language: language
    });
    if (error) return setStatus("customerChatStatus", "تعذر بدء المحادثة: " + error.message, true);
    await loadCustomerConversations();
    const select = getElement("customerConversationSelect");
    if (select && data) {
      select.value = data;
      await loadCustomerConversationMessages();
    }
    setStatus("customerChatStatus", "تم فتح محادثة جديدة مرتبطة بمشروعك.");
  }

  async function loadCustomerConversationMessages() {
    const conversationId = getElement("customerConversationSelect")?.value;
    await renderChatMessages(initializeCustomerClient(), "customerChatMessages", conversationId || "");
  }

  async function sendCustomerChatMessage() {
    const client = initializeCustomerClient();
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    const conversationId = getElement("customerConversationSelect")?.value;
    const text = getElement("customerChatText")?.value.trim() || "";
    const fileInput = getElement("customerChatFile");
    const file = recordedCustomerAudioFile || fileInput?.files?.[0];
    if (!user) return setStatus("customerChatStatus", "سجّل الدخول أولاً.", true);
    if (!conversationId) return setStatus("customerChatStatus", "ابدأ محادثة جديدة أولاً.", true);
    if (!text && !file) return setStatus("customerChatStatus", "اكتب رسالة أو اختر ملفاً للإرسال.", true);
    if (text.length > 8000) return setStatus("customerChatStatus", "الرسالة أطول من الحد المسموح.", true);

    const mimeType = file ? getChatFileMime(file) : "";
    if (file && (!CHAT_ALLOWED_MIME_TYPES.has(mimeType) || !file.size || file.size > CHAT_MAX_FILE_SIZE)) {
      return setStatus("customerChatStatus", "نوع الملف غير مدعوم أو حجمه يتجاوز 50MB.", true);
    }
    const messageType = file ? chatMediaKind(mimeType) : "text";
    const language = getElement("customerChatLanguage")?.value || "ar";
    const { data: message, error } = await client.from("am_messages").insert({
      conversation_id: conversationId,
      sender_type: "customer",
      sender_id: user.id,
      content: text || (file ? "مرفق: " + file.name : ""),
      message_type: messageType,
      language
    }).select("id").single();
    if (error) return setStatus("customerChatStatus", "تعذر إرسال الرسالة: " + error.message, true);

    let attachmentFailed = false;
    try {
      if (file) await uploadChatAttachment(client, user.id, conversationId, message.id, file);
    } catch (uploadError) {
      attachmentFailed = true;
      console.error("Customer chat attachment failed:", uploadError);
      setStatus("customerChatStatus", "تم حفظ الرسالة لكن تعذر إرفاق الملف: " + uploadError.message, true);
    }

    getElement("customerChatText").value = "";
    if (fileInput) fileInput.value = "";
    recordedCustomerAudioFile = null;
    const voiceButton = getElement("customerVoiceButton");
    if (voiceButton) voiceButton.textContent = "تسجيل رسالة صوتية";
    await renderChatMessages(client, "customerChatMessages", conversationId);
    if (!file) setStatus("customerChatStatus", "تم إرسال رسالتك وحفظها في سجل المحادثة.");
    else if (!attachmentFailed) setStatus("customerChatStatus", "تم إرسال الرسالة والمرفق.");
  }

  async function loadAdminConversations() {
    const client = initializeSupabase();
    const { data: conversations, error } = await client
      .from("am_conversations")
      .select("id,client_id,subject,status,preferred_language,created_at")
      .order("created_at", { ascending: false });
    if (error) return setStatus("adminChatStatus", "تعذر تحميل المحادثات: " + error.message, true);

    const { data: clients, error: clientsError } = await client
      .from("am_clients").select("id,name,business_name");
    if (clientsError) console.warn("Chat client names load failed:", clientsError);
    const clientMap = new Map((clients || []).map(c => [c.id, c]));
    const select = getElement("adminChatConversationSelect");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = (conversations || []).map(c => {
      const owner = clientMap.get(c.client_id);
      const label = (owner?.name || "عميل") + " — " + (c.subject || "محادثة") + " · " + c.status;
      return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(label) + "</option>";
    }).join("") || '<option value="">لا توجد محادثات بعد</option>';
    const selectedId = (conversations || []).some(c => c.id === previous) ? previous : conversations?.[0]?.id;
    if (selectedId) select.value = selectedId;
    await renderChatMessages(client, "adminChatMessages", selectedId || "");
  }

  async function loadAdminConversationMessages() {
    const conversationId = getElement("adminChatConversationSelect")?.value;
    await renderChatMessages(initializeSupabase(), "adminChatMessages", conversationId || "");
  }

  async function sendAdminChatMessage() {
    const client = initializeSupabase();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) return setStatus("adminChatStatus", "انتهت جلسة المدير. سجّل الدخول مجدداً.", true);
    const conversationId = getElement("adminChatConversationSelect")?.value;
    const text = getElement("adminChatText")?.value.trim() || "";
    const fileInput = getElement("adminChatFile");
    const file = fileInput?.files?.[0];
    if (!conversationId) return setStatus("adminChatStatus", "اختر محادثة أولاً.", true);
    if (!text && !file) return setStatus("adminChatStatus", "اكتب الرد أو اختر ملفاً للإرسال.", true);

    const mimeType = file ? getChatFileMime(file) : "";
    if (file && (!CHAT_ALLOWED_MIME_TYPES.has(mimeType) || !file.size || file.size > CHAT_MAX_FILE_SIZE)) {
      return setStatus("adminChatStatus", "نوع الملف غير مدعوم أو حجمه يتجاوز 50MB.", true);
    }
    const { data: message, error } = await client.from("am_messages").insert({
      conversation_id: conversationId,
      sender_type: "agency",
      sender_id: userData.user.id,
      content: text || (file ? "مرفق من وكالة الماجد: " + file.name : ""),
      message_type: file ? chatMediaKind(mimeType) : "text"
    }).select("id").single();
    if (error) return setStatus("adminChatStatus", "تعذر إرسال الرد: " + error.message, true);

    let attachmentFailed = false;
    try {
      if (file) await uploadChatAttachment(client, userData.user.id, conversationId, message.id, file);
    } catch (uploadError) {
      attachmentFailed = true;
      console.error("Admin chat attachment failed:", uploadError);
      setStatus("adminChatStatus", "تم حفظ الرد لكن تعذر إرفاق الملف: " + uploadError.message, true);
    }

    getElement("adminChatText").value = "";
    if (fileInput) fileInput.value = "";
    await renderChatMessages(client, "adminChatMessages", conversationId);
    if (!file) setStatus("adminChatStatus", "تم إرسال رد الوكالة.");
    else if (!attachmentFailed) setStatus("adminChatStatus", "تم إرسال الرد والمرفق.");
  }

  async function toggleCustomerVoiceRecording() {
    const button = getElement("customerVoiceButton");
    if (customerRecorder && customerRecorder.state === "recording") {
      customerRecorder.stop();
      if (button) button.textContent = "جارٍ إنهاء التسجيل...";
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return setStatus("customerChatStatus", "تسجيل الصوت غير مدعوم في هذا المتصفح. يمكنك اختيار ملف صوتي من جهازك.", true);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      customerRecordingChunks = [];
      customerRecorder = new MediaRecorder(stream);
      customerRecorder.ondataavailable = event => {
        if (event.data?.size) customerRecordingChunks.push(event.data);
      };
      customerRecorder.onstop = () => {
        const mimeType = getChatFileMime({ type: customerRecorder.mimeType || "audio/webm" }) || "audio/webm";
        const blob = new Blob(customerRecordingChunks, { type: mimeType });
        recordedCustomerAudioFile = new File([blob], "customer-voice-message.webm", { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        if (button) button.textContent = "تسجيل رسالة صوتية";
        setStatus("customerChatStatus", "تم تسجيل الرسالة الصوتية. اضغط إرسال الرسالة لإرسالها.");
      };
      customerRecorder.start();
      if (button) button.textContent = "إيقاف التسجيل";
      setStatus("customerChatStatus", "التسجيل جارٍ... اضغط إيقاف التسجيل عند الانتهاء.");
    } catch (error) {
      setStatus("customerChatStatus", "تعذر الوصول إلى الميكروفون: " + error.message, true);
    }
  }

  function startCustomerChatPolling() {
    if (customerChatPoller) window.clearInterval(customerChatPoller);
    customerChatPoller = window.setInterval(() => {
      loadCustomerConversations().catch(error => console.warn("Customer chat refresh failed:", error));
    }, 8000);
  }

  function startAdminChatPolling() {
    if (adminChatPoller) return;
    adminChatPoller = window.setInterval(() => {
      if (!getElement("chatTab")?.classList.contains("hidden")) {
        loadAdminConversations().catch(error => console.warn("Admin chat refresh failed:", error));
      }
    }, 8000);
  }

  async function restoreCustomerSession() {
    try {
      const client = initializeCustomerClient();
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session) return;
      await completeCustomerSignIn();
    } catch (error) {
      console.warn("Customer session restoration failed:", error);
      setStatus("customerStatus", "تعذر استعادة جلسة العميل. حدّث الصفحة أو سجّل الدخول مجدداً.", true);
    }
  }

  async function customerSignIn() {
    const email = getElement("customerEmail")?.value.trim();
    if (!email) return setStatus("customerStatus", "أدخل بريدك الإلكتروني أولاً.", true);
    const { error } = await initializeCustomerClient().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) return setStatus("customerStatus", "تعذر إرسال رمز الدخول: " + error.message, true);
    const otpPanel = getElement("customerOtpPanel");
    if (otpPanel) otpPanel.classList.remove("hidden");
    setStatus("customerStatus", "أرسلنا رمز الدخول إلى بريدك. أدخل الرمز المكوّن من 6 أرقام هنا.");
  }

  async function customerVerifyOtp() {
    const email = getElement("customerEmail")?.value.trim();
    const token = getElement("customerOtp")?.value.trim();
    if (!email || !/^\d{6}$/.test(token || "")) {
      return setStatus("customerStatus", "أدخل البريد ورمز التحقق المكوّن من 6 أرقام.", true);
    }
    const { error } = await initializeCustomerClient().auth.verifyOtp({ email, token, type: "email" });
    if (error) return setStatus("customerStatus", "رمز الدخول غير صحيح أو انتهت صلاحيته: " + error.message, true);
    await completeCustomerSignIn();
  }

  async function customerSignInWithGoogle() {
    const { error } = await initializeCustomerClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) setStatus("customerStatus", "تعذر تسجيل الدخول باستخدام Google: " + error.message, true);
  }

  async function completeCustomerSignIn() {
    const authPanel = getElement("customerAuthPanel");
    if (authPanel) authPanel.classList.add("hidden");
    const otpPanel = getElement("customerOtpPanel");
    if (otpPanel) otpPanel.classList.add("hidden");
    const panel = getElement("customerChatPanel");
    if (panel) panel.classList.remove("hidden");
    await displayCustomerProfileId();
    await loadCustomerProjects();
    await loadCustomerConversations();
    startCustomerChatPolling();
  }

  async function displayCustomerProfileId() {
    const field = getElement("customerProfileIdDisplay");
    if (!field) return false;
    try {
      const { data, error } = await initializeCustomerClient().auth.getUser();
      const profileId = data?.user?.id;
      if (error || !profileId) {
        field.value = "";
        setStatus("customerStatus", "تعذر قراءة معرّف حسابك. أعد تسجيل الدخول ثم حاول مجدداً.", true);
        return false;
      }
      field.value = profileId;
      return true;
    } catch (error) {
      console.error("Customer profile ID lookup failed:", error);
      field.value = "";
      setStatus("customerStatus", "تعذر قراءة معرّف حسابك حالياً.", true);
      return false;
    }
  }

  async function copyCustomerProfileId() {
    const field = getElement("customerProfileIdDisplay");
    if (!field?.value) {
      return setStatus("customerStatus", "سجّل الدخول أولاً لعرض معرّف حسابك.", true);
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(field.value);
      } else {
        field.focus();
        field.select();
        if (!document.execCommand("copy")) throw new Error("copy command unavailable");
      }
      setStatus("customerStatus", "تم نسخ معرّف حسابك. أرسله إلى الوكالة لإكمال ربط حسابك بسجل العميل.");
    } catch (error) {
      console.error("Customer profile ID copy failed:", error);
      field.focus();
      field.select();
      setStatus("customerStatus", "تعذر النسخ التلقائي. حدّد المعرّف وانسخه يدوياً.", true);
    }
  }

  function normalizeCustomerProjects(rows) {
    return (Array.isArray(rows) ? rows : []).map(row => ({
      id: row?.id ?? row?.project_id ?? null,
      title: row?.title ?? row?.project_title ?? row?.name ?? "مشروع بدون عنوان",
      approved_amount: row?.approved_amount ?? null,
      currency: row?.currency ?? ""
    })).filter(project =>
      typeof project.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(project.id)
    );
  }

  async function loadCustomerProjects() {
    const select = getElement("customerProjectSelect");
    if (select) select.innerHTML = '<option value="">جارٍ تحميل المشاريع...</option>';
    const client = initializeCustomerClient();
    const { data, error } = await client.rpc("customer_list_projects");
    if (error) {
      if (select) select.innerHTML = '<option value="">تعذر تحميل المشاريع</option>';
      setStatus("customerStatus", "تعذر تحميل مشاريع هذا الحساب: " + error.message, true);
      return false;
    }
    if (!select) return false;

    const projects = normalizeCustomerProjects(data);
    if (!projects.length) {
      select.innerHTML = '<option value="">لا توجد مشاريع مرتبطة بهذا الحساب</option>';
      setStatus("customerStatus", "تم تسجيل الدخول، لكن لا توجد مشاريع مرتبطة بهذا الحساب حالياً. اطلب من الوكالة ربط حسابك بسجل العميل وإضافة مشروعك.", true);
      return false;
    }

    select.innerHTML = '<option value="">اختر مشروعك...</option>' +
      projects.map(project => {
        const amountLabel = project.approved_amount == null
          ? "بانتظار تحديد المبلغ"
          : escapeHtml(project.approved_amount) + " " + escapeHtml(project.currency);
        return '<option value="' + escapeHtml(project.id) + '">' +
          escapeHtml(project.title) + " — " + amountLabel + "</option>";
      }).join("");
    setStatus("customerStatus", "تم تحميل " + projects.length + " مشروع مرتبط بحسابك.");
    return true;
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
    if (customerChatPoller) window.clearInterval(customerChatPoller);
    customerChatPoller = null;
    const panel = getElement("customerChatPanel");
    if (panel) panel.classList.add("hidden");
    const authPanel = getElement("customerAuthPanel");
    if (authPanel) authPanel.classList.remove("hidden");
    const otpPanel = getElement("customerOtpPanel");
    if (otpPanel) otpPanel.classList.add("hidden");
    const messages = getElement("customerChatMessages");
    if (messages) messages.innerHTML = '<div class="chat-empty">سجّل الدخول لعرض محادثاتك.</div>';
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

  function bindVendorProductForm() {
    const form = getElement("add-product-form");
    if (form && form.dataset.marketSubmitBound !== "true") {
      form.addEventListener("submit", addProduct);
      form.dataset.marketSubmitBound = "true";
    }
  }

  // Bind data-driven actions without inline JavaScript handlers.
  function bindSafeDashboardActions() {
    const root = getElement("dashboardSection");
    if (!root || root.dataset.safeActionsBound === "true") return;
    root.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button || !root.contains(button)) return;
      if (button.dataset.action === "open-receipt") {
        const path = button.dataset.receiptPath;
        if (path) openReceipt(path);
      } else if (button.dataset.action === "set-approved-amount") {
        const projectId = button.dataset.projectId;
        if (projectId) setApprovedAmount(projectId);
      } else if (button.dataset.action === "verify-payment") {
        const paymentId = button.dataset.paymentId;
        if (paymentId) verifyPayment(paymentId);
      }
    });
    root.dataset.safeActionsBound = "true";
  }

  // ربط الدوال بأزرار HTML التي تستخدم onclick.
  window.loginAdmin = loginAdmin;
  window.loginAdminWithGoogle = loginAdminWithGoogle;
  window.loadDashboardData = loadDashboardData;
  window.runAiTeam = runAiTeam;
  window.linkClientAccount = linkClientAccount;
  window.setApprovedAmount = setApprovedAmount;
  window.loadPayments = loadPayments;
  window.openReceipt = openReceipt;
  window.verifyPayment = verifyPayment;
  window.customerSignIn = customerSignIn;
  window.customerVerifyOtp = customerVerifyOtp;
  window.customerSignInWithGoogle = customerSignInWithGoogle;
  window.copyCustomerProfileId = copyCustomerProfileId;
  window.loadCustomerProjects = loadCustomerProjects;
  window.requestCustomerPayment = requestCustomerPayment;
  window.uploadCustomerReceipt = uploadCustomerReceipt;
  window.customerSignOut = customerSignOut;
  window.loadCustomerConversations = loadCustomerConversations;
  window.startCustomerConversation = startCustomerConversation;
  window.loadCustomerConversationMessages = loadCustomerConversationMessages;
  window.sendCustomerChatMessage = sendCustomerChatMessage;
  window.toggleCustomerVoiceRecording = toggleCustomerVoiceRecording;
  window.loadAdminConversations = loadAdminConversations;
  window.loadAdminConversationMessages = loadAdminConversationMessages;
  window.sendAdminChatMessage = sendAdminChatMessage;
  window.logoutAdmin = logoutAdmin;
  window.showSection = showSection;
  window.switchTab = switchTab;
  window.renderMarket = renderMarket;
  window.addProduct = addProduct;
  window.addEmployee = addEmployee;
  window.createAiTask = createAiTask;
  window.addClient = addClient;
  window.addProject = addProject;
  window.addFinanceTransaction = addFinanceTransaction;
  window.loadFinanceTransactions = loadFinanceTransactions;
  window.openProjectModal = openProjectModal;
  window.closeProjectModal = closeProjectModal;

  // التحقق من حالة تحميل الصفحة لضمان عمل استعادة الجلسة بكفاءة
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (getElement("adminLoginSection") || getElement("dashboardSection")) restoreAdminSession();
      if (getElement("customerChatPanel")) restoreCustomerSession();
      bindVendorProductForm();
      bindSafeDashboardActions();
    });
  } else {
    if (getElement("adminLoginSection") || getElement("dashboardSection")) restoreAdminSession();
    if (getElement("customerChatPanel")) restoreCustomerSession();
    bindVendorProductForm();
      bindSafeDashboardActions();
  }

})();
