(function () {
  "use strict";

  const SUPABASE_URL = "https://cafvkonbubrqsabsywry.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QvFdOACJ5_bBnhjp3Pnm0g_vG_d1iR6";
  const AUTH_STORAGE_KEY = "am-market-seller-portal-auth";
  const PENDING_MODE_KEY = "am-market-seller-pending-mode";
  const PENDING_NAME_KEY = "am-market-seller-pending-name";
  const IMAGE_BUCKET = "am-market-product-images";

  const translations = {
    ar: {
      brandSub:"بوابة البائعين",marketLink:"العودة إلى السوق",title:"بوابة البائعين",
      intro:"سجّل دخولك أو أنشئ حساب بائع، ثم أرسل منتجاتك للمراجعة قبل ظهورها في السوق.",
      authTitle:"تسجيل البائع أو الدخول",storeName:"اسم المتجر أو البائع",storeNamePlaceholder:"اكتب اسم المتجر",
      email:"البريد الإلكتروني",registerEmail:"إنشاء حساب بائع وإرسال رمز",loginEmail:"دخول البائع برمز البريد",
      google:"المتابعة باستخدام Google",emailHint:"سنرسل رمز تحقق إلى بريدك. لا نستخدم WhatsApp أو SMS لتسجيل الدخول.",
      otpLabel:"رمز التحقق المرسل إلى بريدك",verifyOtp:"تأكيد الرمز والدخول",ready:"أدخل بياناتك للمتابعة.",
      signOut:"تسجيل الخروج",addProductTitle:"إضافة منتج جديد",productTitle:"اسم المنتج",description:"وصف المنتج",
      price:"السعر (نايرا NGN)",image:"صورة المنتج (اختياري)",imageHint:"JPG أو PNG أو WEBP، بحد أقصى 5 ميغابايت.",
      submitProduct:"إرسال المنتج للمراجعة",myProducts:"منتجاتي",loading:"جارٍ التحميل...",
      footer:"تُراجع المنتجات قبل نشرها. لن يظهر المنتج في السوق إلا بعد موافقة الإدارة.",
      enterStore:"أدخل اسم المتجر (حرفان على الأقل).",enterEmail:"أدخل بريداً إلكترونياً صحيحاً.",
      sending:"جارٍ إرسال رمز التحقق...",sent:"تم إرسال الرمز. تحقق من بريدك ثم أدخله هنا.",
      otpNeeded:"أدخل رمز التحقق.",verifying:"جارٍ التحقق...",signedIn:"تم تسجيل الدخول.",
      noSeller:"لا يوجد حساب بائع لهذا البريد. استخدم إنشاء حساب بائع أولاً.",
      sellerExists:"هذا الحساب مسجل كبائع بالفعل.",sellerCreated:"تم إنشاء حساب البائع وإرساله للمراجعة.",
      pending:"حسابك قيد مراجعة الإدارة.",active:"حسابك نشط ويمكنك إرسال المنتجات.",
      blocked:"حالة حساب البائع لا تسمح بإضافة المنتجات حالياً. تواصل مع الإدارة.",
      authError:"تعذر إكمال تسجيل الدخول. تحقق من البيانات وحاول مجدداً.",
      googleStart:"جارٍ فتح تسجيل الدخول عبر Google...",googleError:"تعذر بدء تسجيل الدخول عبر Google.",
      productNeed:"أدخل اسم المنتج وسعراً أكبر من صفر.",imageInvalid:"الصورة يجب أن تكون JPG أو PNG أو WEBP وبحجم لا يتجاوز 5 ميغابايت.",
      saving:"جارٍ حفظ المنتج للمراجعة...",productSaved:"تم حفظ المنتج وإرساله للمراجعة. سيظهر بعد موافقة الإدارة.",
      productError:"تعذر إرسال المنتج: ",emptyProducts:"لا توجد منتجات مضافة بعد.",
      statusPending:"قيد المراجعة",statusActive:"منشور",statusRejected:"مرفوض",statusOther:"غير منشور",
      sessionError:"تعذر استعادة الجلسة. سجّل الدخول مجدداً.",signOutDone:"تم تسجيل الخروج."
    },
    en: {
      brandSub:"Seller Portal",marketLink:"Back to marketplace",title:"Seller Portal",
      intro:"Sign in or register as a seller, then submit products for review before they appear in the marketplace.",
      authTitle:"Seller registration or sign in",storeName:"Store or seller name",storeNamePlaceholder:"Enter your store name",
      email:"Email address",registerEmail:"Register seller and send code",loginEmail:"Seller sign in by email code",
      google:"Continue with Google",emailHint:"A verification code will be sent to your email. WhatsApp and SMS are not used for sign-in.",
      otpLabel:"Verification code sent to your email",verifyOtp:"Verify code and sign in",ready:"Enter your details to continue.",
      signOut:"Sign out",addProductTitle:"Add a new product",productTitle:"Product name",description:"Product description",
      price:"Price (Naira NGN)",image:"Product image (optional)",imageHint:"JPG, PNG or WEBP, up to 5 MB.",
      submitProduct:"Submit product for review",myProducts:"My products",loading:"Loading...",
      footer:"Products are reviewed before publication. A product appears in the marketplace only after admin approval.",
      enterStore:"Enter a store name (at least 2 characters).",enterEmail:"Enter a valid email address.",
      sending:"Sending verification code...",sent:"Code sent. Check your email and enter it here.",
      otpNeeded:"Enter the verification code.",verifying:"Verifying...",signedIn:"Signed in successfully.",
      noSeller:"No seller account is linked to this email. Register as a seller first.",
      sellerExists:"This account is already registered as a seller.",sellerCreated:"Seller account created and submitted for review.",
      pending:"Your seller account is pending admin review.",active:"Your account is active. You can submit products.",
      blocked:"This seller account cannot submit products right now. Contact the administrator.",
      authError:"Could not complete sign-in. Check your details and try again.",
      googleStart:"Opening Google sign-in...",googleError:"Could not start Google sign-in.",
      productNeed:"Enter a product name and a price greater than zero.",imageInvalid:"Image must be JPG, PNG or WEBP and no larger than 5 MB.",
      saving:"Saving product for review...",productSaved:"Product saved and submitted for review. It will appear after admin approval.",
      productError:"Could not submit product: ",emptyProducts:"No products added yet.",
      statusPending:"Pending review",statusActive:"Published",statusRejected:"Rejected",statusOther:"Not published",
      sessionError:"Could not restore your session. Please sign in again.",signOutDone:"Signed out."
    },
    ha: {
      brandSub:"Shafin Masu Sayarwa",marketLink:"Komawa kasuwa",title:"Shafin Masu Sayarwa",
      intro:"Shiga ko bude asusun mai sayarwa, sannan ka aika kayanka domin dubawa kafin a nuna su a kasuwa.",
      authTitle:"Rajista ko shiga",storeName:"Sunan shago ko mai sayarwa",storeNamePlaceholder:"Shigar da sunan shago",
      email:"Adireshin imel",registerEmail:"Yi rajista a matsayin mai sayarwa",loginEmail:"Shiga da lambar imel",
      google:"Ci gaba da Google",emailHint:"Za mu aika lambar tabbatarwa zuwa imel. Ba a amfani da WhatsApp ko SMS wajen shiga.",
      otpLabel:"Lambar tabbatarwa",verifyOtp:"Tabbatar da lambar",ready:"Shigar da bayananka domin ci gaba.",
      signOut:"Fita",addProductTitle:"Kara sabon kaya",productTitle:"Sunan kaya",description:"Bayanin kaya",
      price:"Farashi (Naira NGN)",image:"Hoton kaya (ba dole ba)",imageHint:"JPG, PNG ko WEBP, bai wuce 5 MB ba.",
      submitProduct:"A aika kaya domin dubawa",myProducts:"Kayana",loading:"Ana lodawa...",
      footer:"Ana duba kaya kafin wallafawa. Sai an amince da kaya kafin ya bayyana a kasuwa.",
      enterStore:"Shigar da sunan shago (haruffa biyu ko fiye).",enterEmail:"Shigar da ingantaccen imel.",
      sending:"Ana aika lambar tabbatarwa...",sent:"An aika lambar. Duba imel sannan ka shigar da ita.",
      otpNeeded:"Shigar da lambar tabbatarwa.",verifying:"Ana tabbatarwa...",signedIn:"An shiga cikin nasara.",
      noSeller:"Babu asusun mai sayarwa da ke da wannan imel. Yi rajista da farko.",
      sellerExists:"An riga an yi rajistar wannan asusun.",sellerCreated:"An bude asusun mai sayarwa kuma an aika domin dubawa.",
      pending:"Asusunka yana jiran amincewar gudanarwa.",active:"Asusunka yana aiki. Za ka iya aika kaya.",
      blocked:"Ba za a iya aika kaya daga wannan asusu yanzu ba. Tuntuɓi gudanarwa.",
      authError:"Ba a iya kammala shiga ba. Duba bayananka ka sake gwadawa.",
      googleStart:"Ana bude shiga ta Google...",googleError:"Ba a iya fara shiga ta Google ba.",
      productNeed:"Shigar da sunan kaya da farashi sama da sifili.",imageInvalid:"Hoton ya zama JPG, PNG ko WEBP, bai wuce 5 MB ba.",
      saving:"Ana adana kaya domin dubawa...",productSaved:"An adana kaya kuma an aika domin dubawa. Zai bayyana bayan amincewa.",
      productError:"Ba a iya aika kaya ba: ",emptyProducts:"Ba a kara kaya ba tukuna.",
      statusPending:"Yana jiran dubawa",statusActive:"An wallafa",statusRejected:"An ki",statusOther:"Ba a wallafa ba",
      sessionError:"Ba a iya dawo da zaman shiga ba. Sake shiga.",signOutDone:"An fita."
    }
  };

  let client = null;
  let currentSeller = null;
  let currentLanguage = localStorage.getItem("am-market-seller-language") || "ar";
  let productBusy = false;

  const el = id => document.getElementById(id);
  const t = key => (translations[currentLanguage] || translations.ar)[key] || translations.ar[key] || key;
  const currentUrl = () => window.location.origin + window.location.pathname;

  function setStatus(id, message, isError) {
    const node = el(id);
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }

  function supabaseClient() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase SDK did not load.");
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  }

  function applyLanguage(language) {
    currentLanguage = translations[language] ? language : "ar";
    localStorage.setItem("am-market-seller-language", currentLanguage);
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";
    el("languageSelect").value = currentLanguage;
    document.querySelectorAll("[data-i18n]").forEach(node => {
      const key = node.getAttribute("data-i18n");
      if (translations[currentLanguage][key]) node.textContent = translations[currentLanguage][key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
      const key = node.getAttribute("data-i18n-placeholder");
      if (translations[currentLanguage][key]) node.placeholder = translations[currentLanguage][key];
    });
    if (el("authStatus").dataset.ready === "1") setStatus("authStatus", t("ready"), false);
  }

  function statusLabel(status) {
    if (status === "pending") return t("statusPending");
    if (status === "active") return t("statusActive");
    if (status === "rejected") return t("statusRejected");
    return t("statusOther");
  }

  async function getSellerForUser(user) {
    const { data, error } = await supabaseClient()
      .from("am_market_sellers")
      .select("id,display_name,status,owner_user_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function createSellerIfRequested(user, mode, requestedName) {
    let seller = await getSellerForUser(user);
    if (seller) return { seller, created: false };
    if (mode !== "register") return { seller: null, created: false };
    const name = String(requestedName || "").trim().slice(0, 80);
    if (name.length < 2) throw new Error(t("enterStore"));
    const { error } = await supabaseClient().from("am_market_sellers").insert({
      id: crypto.randomUUID(),
      display_name: name,
      status: "pending",
      owner_user_id: user.id
    });
    if (error) {
      seller = await getSellerForUser(user);
      if (!seller) throw error;
      return { seller, created: false };
    }
    seller = await getSellerForUser(user);
    if (!seller) throw new Error("Seller registration was not confirmed by the database.");
    return { seller, created: true };
  }

  async function finishSignIn(mode, requestedName) {
    const { data, error } = await supabaseClient().auth.getSession();
    if (error) throw error;
    const user = data && data.session && data.session.user;
    if (!user || !user.email_confirmed_at) throw new Error("Email confirmation is required.");
    const result = await createSellerIfRequested(user, mode, requestedName);
    localStorage.removeItem(PENDING_MODE_KEY);
    localStorage.removeItem(PENDING_NAME_KEY);
    if (!result.seller) {
      el("dashboard").classList.add("hidden");
      el("authCard").classList.remove("hidden");
      setStatus("authStatus", t("noSeller"), true);
      return;
    }
    currentSeller = result.seller;
    el("authCard").classList.add("hidden");
    el("dashboard").classList.remove("hidden");
    el("sellerDisplayName").textContent = result.seller.display_name;
    el("sellerStatus").textContent = result.seller.status === "active" ? t("active") : t("pending");
    const allowed = ["pending", "active"].includes(result.seller.status);
    el("productFormArea").classList.toggle("hidden", !allowed);
    setStatus("authStatus", result.created ? t("sellerCreated") : t("signedIn"), false);
    if (!allowed) setStatus("productStatus", t("blocked"), true);
    await loadProducts();
  }

  async function sendEmailCode(mode) {
    const email = el("email").value.trim().toLowerCase();
    const storeName = el("storeName").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("authStatus", t("enterEmail"), true);
      el("email").focus();
      return;
    }
    if (mode === "register" && storeName.length < 2) {
      setStatus("authStatus", t("enterStore"), true);
      el("storeName").focus();
      return;
    }
    const button = mode === "register" ? el("registerEmailButton") : el("loginEmailButton");
    button.disabled = true;
    setStatus("authStatus", t("sending"), false);
    localStorage.setItem(PENDING_MODE_KEY, mode);
    localStorage.setItem(PENDING_NAME_KEY, mode === "register" ? storeName : "");
    try {
      const { error } = await supabaseClient().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "register",
          data: mode === "register" ? { full_name: storeName, seller_display_name: storeName } : undefined,
          emailRedirectTo: currentUrl()
        }
      });
      if (error) throw error;
      el("otpArea").classList.remove("hidden");
      setStatus("authStatus", t("sent"), false);
      el("otpCode").focus();
    } catch (error) {
      localStorage.removeItem(PENDING_MODE_KEY);
      localStorage.removeItem(PENDING_NAME_KEY);
      setStatus("authStatus", error && error.message ? error.message : t("authError"), true);
    } finally {
      button.disabled = false;
    }
  }

  async function verifyEmailCode() {
    const email = el("email").value.trim().toLowerCase();
    const token = el("otpCode").value.trim();
    const mode = localStorage.getItem(PENDING_MODE_KEY) || "login";
    const requestedName = localStorage.getItem(PENDING_NAME_KEY) || el("storeName").value.trim();
    if (!token) {
      setStatus("authStatus", t("otpNeeded"), true);
      return;
    }
    el("verifyOtpButton").disabled = true;
    setStatus("authStatus", t("verifying"), false);
    try {
      const { error } = await supabaseClient().auth.verifyOtp({ email, token, type: "email" });
      if (error) throw error;
      await finishSignIn(mode, requestedName);
    } catch (error) {
      setStatus("authStatus", error && error.message ? error.message : t("authError"), true);
    } finally {
      el("verifyOtpButton").disabled = false;
    }
  }

  async function signInWithGoogle() {
    const storeName = el("storeName").value.trim();
    const mode = storeName.length >= 2 ? "register" : "login";
    localStorage.setItem(PENDING_MODE_KEY, mode);
    localStorage.setItem(PENDING_NAME_KEY, mode === "register" ? storeName : "");
    setStatus("authStatus", t("googleStart"), false);
    el("googleButton").disabled = true;
    try {
      const { error } = await supabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: currentUrl(), queryParams: { prompt: "select_account" } }
      });
      if (error) throw error;
    } catch (error) {
      el("googleButton").disabled = false;
      setStatus("authStatus", error && error.message ? error.message : t("googleError"), true);
    }
  }

  async function loadProducts() {
    if (!currentSeller) return;
    const target = el("productList");
    target.textContent = t("loading");
    const { data, error } = await supabaseClient()
      .from("am_market_products")
      .select("id,title,price,status,created_at")
      .eq("seller_id", currentSeller.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      target.textContent = error.message;
      return;
    }
    target.replaceChildren();
    if (!data || data.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = t("emptyProducts");
      target.appendChild(empty);
      return;
    }
    data.forEach(product => {
      const row = document.createElement("div");
      row.className = "product";
      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = product.title;
      const status = document.createElement("small");
      status.textContent = statusLabel(product.status);
      info.append(name, status);
      const price = document.createElement("b");
      price.textContent = new Intl.NumberFormat("en-NG", {
        style: "currency", currency: "NGN", maximumFractionDigits: 2
      }).format(Number(product.price));
      row.append(info, price);
      target.appendChild(row);
    });
  }

  async function submitProduct(event) {
    event.preventDefault();
    if (productBusy || !currentSeller) return;
    const title = el("productTitle").value.trim();
    const description = el("productDescription").value.trim();
    const priceValue = el("productPrice").value.trim();
    const price = Number(priceValue);
    const file = el("productImage").files && el("productImage").files[0];
    if (title.length < 2 || !priceValue || !Number.isFinite(price) || price <= 0) {
      setStatus("productStatus", t("productNeed"), true);
      return;
    }
    if (file && (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024)) {
      setStatus("productStatus", t("imageInvalid"), true);
      return;
    }
    productBusy = true;
    el("submitProductButton").disabled = true;
    setStatus("productStatus", t("saving"), false);
    let uploadedPath = null;
    try {
      const { data: sessionData, error: sessionError } = await supabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData && sessionData.session && sessionData.session.user;
      if (!user || !user.email_confirmed_at) throw new Error("Please sign in with a confirmed email.");
      const seller = await getSellerForUser(user);
      if (!seller || seller.id !== currentSeller.id || !["pending", "active"].includes(seller.status)) {
        throw new Error("Seller account is not allowed to submit products.");
      }
      let imageUrl = null;
      if (file) {
        const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        uploadedPath = user.id + "/" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await supabaseClient().storage
          .from(IMAGE_BUCKET)
          .upload(uploadedPath, file, {
            cacheControl: "3600", upsert: false, contentType: file.type
          });
        if (uploadError) throw uploadError;
        imageUrl = supabaseClient().storage.from(IMAGE_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { error: insertError } = await supabaseClient().from("am_market_products").insert({
        seller_id: seller.id,
        title,
        description: description || null,
        price,
        currency: "NGN",
        image_url: imageUrl,
        status: "pending"
      });
      if (insertError) throw insertError;
      el("sellerProductForm").reset();
      setStatus("productStatus", t("productSaved"), false);
      await loadProducts();
    } catch (error) {
      if (uploadedPath) {
        try {
          await supabaseClient().storage.from(IMAGE_BUCKET).remove([uploadedPath]);
        } catch (cleanupError) {
          console.warn("Could not clean up failed product image upload.", cleanupError);
        }
      }
      setStatus("productStatus", t("productError") + (error && error.message ? error.message : "Unknown error."), true);
    } finally {
      productBusy = false;
      el("submitProductButton").disabled = false;
    }
  }

  async function signOut() {
    try {
      const { error } = await supabaseClient().auth.signOut();
      if (error) throw error;
      currentSeller = null;
      el("dashboard").classList.add("hidden");
      el("authCard").classList.remove("hidden");
      el("otpArea").classList.add("hidden");
      el("storeName").value = "";
      el("otpCode").value = "";
      setStatus("authStatus", t("signOutDone"), false);
    } catch (error) {
      setStatus("authStatus", error && error.message ? error.message : t("authError"), true);
    }
  }

  async function restoreSession() {
    try {
      const { data, error } = await supabaseClient().auth.getSession();
      if (error) throw error;
      if (!data || !data.session || !data.session.user) return;
      const mode = localStorage.getItem(PENDING_MODE_KEY) || "login";
      const name = localStorage.getItem(PENDING_NAME_KEY) || "";
      await finishSignIn(mode, name);
    } catch (error) {
      console.warn("Seller portal session restore failed.", error);
      setStatus("authStatus", t("sessionError"), true);
    }
  }

  function init() {
    applyLanguage(currentLanguage);
    el("languageSelect").addEventListener("change", event => applyLanguage(event.target.value));
    el("registerEmailButton").addEventListener("click", () => sendEmailCode("register"));
    el("loginEmailButton").addEventListener("click", () => sendEmailCode("login"));
    el("verifyOtpButton").addEventListener("click", verifyEmailCode);
    el("googleButton").addEventListener("click", signInWithGoogle);
    el("sellerProductForm").addEventListener("submit", submitProduct);
    el("signOutButton").addEventListener("click", signOut);
    el("authStatus").dataset.ready = "1";
    restoreSession();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();