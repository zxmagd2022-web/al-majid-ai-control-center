(function () {
  "use strict";

  const SUPABASE_URL = "https://cafvkonbubrqsabsywry.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QvFdOACJ5_BBnhjp3Pnm0g_vG_d1iR6";
  const AUTH_STORAGE_KEY = "sb-cafvkonbubrqsabsywry-auth-token";
  let client = null;
  let sellersCache = [];
  let productsCache = [];
  let busy = false;

  const el = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);

  function db() {
    if (client) return client;
    if (!window.supabase?.createClient) throw new Error("تعذر تحميل مكتبة قاعدة البيانات.");
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    return client;
  }

  function status(message, isError) {
    const node = el("marketAdminStatus");
    if (!node) return;
    node.textContent = message || "";
    node.style.color = isError ? "#ef4444" : "#10b981";
  }

  async function requireDirector() {
    const { data: sessionData, error: sessionError } = await db().auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.user) throw new Error("انتهت جلسة الإدارة. سجّل الدخول مجدداً.");
    const { data, error } = await db().rpc("is_active_director");
    if (error) throw error;
    if (data !== true) throw new Error("هذه الوظيفة متاحة للمدير النشط فقط.");
  }

  function dateLabel(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar");
  }

  function sellerStatusLabel(value) {
    return ({ pending: "بانتظار المراجعة", active: "نشط", suspended: "موقوف" })[value] || value;
  }

  function productStatusLabel(value) {
    return ({ pending: "بانتظار المراجعة", active: "منشور", hidden: "مخفي" })[value] || value;
  }

  function renderSellers() {
    const host = el("marketSellersList");
    if (!host) return;
    if (!sellersCache.length) {
      host.textContent = "لا توجد حسابات بائعين مسجلة.";
      return;
    }
    host.innerHTML = sellersCache.map(seller => {
      let actions = "";
      if (seller.status === "pending") {
        actions = '<button type="button" data-market-action="seller-active" data-id="' + escapeHtml(seller.id) + '">قبول البائع</button> ' +
          '<button type="button" class="secondary" data-market-action="seller-suspended" data-id="' + escapeHtml(seller.id) + '">إيقاف الحساب</button>';
      } else if (seller.status === "active") {
        actions = '<button type="button" class="secondary" data-market-action="seller-suspended" data-id="' + escapeHtml(seller.id) + '">إيقاف الحساب</button>';
      } else if (seller.status === "suspended") {
        actions = '<button type="button" data-market-action="seller-active" data-id="' + escapeHtml(seller.id) + '">إعادة تفعيل البائع</button>';
      }
      return '<article style="padding:12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:10px">' +
        '<strong>' + escapeHtml(seller.display_name) + '</strong>' +
        '<div style="color:var(--text-muted);font-size:13px;margin:5px 0">' +
        'النوع: ' + escapeHtml(seller.seller_type === "home_producer" ? "أسرة منتجة" : "متجر") +
        ' · الهاتف: ' + escapeHtml(seller.phone || "غير مسجل") +
        ' · الحالة: ' + escapeHtml(sellerStatusLabel(seller.status)) +
        '</div><small style="color:var(--text-muted)">تاريخ التسجيل: ' + escapeHtml(dateLabel(seller.created_at)) +
        '</small><div class="btn-group" style="margin-top:9px">' + actions + '</div></article>';
    }).join("");
  }

  function renderProducts() {
    const host = el("marketProductsList");
    if (!host) return;
    if (!productsCache.length) {
      host.textContent = "لا توجد منتجات مسجلة في السوق.";
      return;
    }
    const sellerMap = new Map(sellersCache.map(seller => [seller.id, seller]));
    host.innerHTML = productsCache.map(product => {
      const seller = sellerMap.get(product.seller_id);
      let actions = "";
      if (product.status === "pending") {
        actions = '<button type="button" data-market-action="product-active" data-id="' + escapeHtml(product.id) + '">نشر المنتج</button> ' +
          '<button type="button" class="secondary" data-market-action="product-hidden" data-id="' + escapeHtml(product.id) + '">إخفاء المنتج</button>';
      } else if (product.status === "active") {
        actions = '<button type="button" class="secondary" data-market-action="product-hidden" data-id="' + escapeHtml(product.id) + '">إخفاء المنتج</button>';
      } else if (product.status === "hidden") {
        actions = '<button type="button" data-market-action="product-active" data-id="' + escapeHtml(product.id) + '">نشر المنتج</button>';
      }
      return '<article style="padding:12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:10px">' +
        '<strong>' + escapeHtml(product.title) + '</strong>' +
        '<div style="color:var(--text-muted);font-size:13px;margin:5px 0">' +
        'البائع: ' + escapeHtml(seller?.display_name || "بائع غير معروف") +
        ' · السعر: ' + escapeHtml(product.price) + ' ' + escapeHtml(product.currency || "NGN") +
        ' · الحالة: ' + escapeHtml(productStatusLabel(product.status)) +
        '</div>' +
        (product.description ? '<p style="margin:7px 0;white-space:pre-wrap">' + escapeHtml(product.description) + '</p>' : '') +
        '<small style="color:var(--text-muted)">تاريخ الإضافة: ' + escapeHtml(dateLabel(product.created_at)) + '</small>' +
        '<div class="btn-group" style="margin-top:9px">' + actions + '</div></article>';
    }).join("");
  }

  async function loadMarketAdminData() {
    if (busy) return;
    busy = true;
    status("جارٍ تحميل بيانات البائعين والمنتجات...");
    try {
      await requireDirector();
      const [sellerResult, productResult] = await Promise.all([
        db().from("am_market_sellers")
          .select("id,display_name,phone,status,created_at,seller_type")
          .order("created_at", { ascending: false }),
        db().from("am_market_products")
          .select("id,seller_id,title,description,price,currency,status,created_at")
          .order("created_at", { ascending: false })
      ]);
      if (sellerResult.error) throw sellerResult.error;
      if (productResult.error) throw productResult.error;
      sellersCache = sellerResult.data || [];
      productsCache = productResult.data || [];
      if (el("marketSellerCount")) el("marketSellerCount").textContent = String(sellersCache.length);
      if (el("marketProductCount")) el("marketProductCount").textContent = String(productsCache.length);
      if (el("marketPendingCount")) el("marketPendingCount").textContent =
        String(productsCache.filter(product => product.status === "pending").length);
      renderSellers();
      renderProducts();
      status("تم تحميل بيانات السوق. سجلات البائعين والمنتجات مستقلة عن قائمة عملاء الوكالة.");
    } catch (error) {
      console.error("Marketplace admin load failed:", error);
      status("تعذر تحميل بيانات السوق: " + (error?.message || "خطأ غير معروف"), true);
    } finally {
      busy = false;
    }
  }

  async function updateSellerStatus(id, nextStatus) {
    const seller = sellersCache.find(item => item.id === id);
    if (!seller || !["active", "suspended"].includes(nextStatus)) return;
    const action = nextStatus === "active" ? "تفعيل هذا البائع؟" : "إيقاف حساب هذا البائع؟";
    if (!window.confirm(action + " لن يتم حذف الحساب أو أي منتج.")) return;
    try {
      await requireDirector();
      const { data, error } = await db().from("am_market_sellers")
        .update({ status: nextStatus }).eq("id", id).select("id,status").single();
      if (error) throw error;
      if (!data) throw new Error("لم يتم تأكيد تحديث حالة البائع.");
      status("تم تحديث حالة البائع دون حذف بياناته.");
      await loadMarketAdminData();
    } catch (error) {
      console.error("Seller status update failed:", error);
      status("تعذر تحديث البائع: " + (error?.message || "خطأ غير معروف"), true);
    }
  }

  async function updateProductStatus(id, nextStatus) {
    const product = productsCache.find(item => item.id === id);
    if (!product || !["active", "hidden"].includes(nextStatus)) return;
    if (nextStatus === "active") {
      const seller = sellersCache.find(item => item.id === product.seller_id);
      if (!seller || seller.status !== "active") {
        status("لا يمكن نشر المنتج قبل تفعيل حساب البائع أولاً.", true);
        return;
      }
    }
    const action = nextStatus === "active" ? "نشر هذا المنتج في السوق؟" : "إخفاء هذا المنتج من السوق؟";
    if (!window.confirm(action + " لن يتم حذف المنتج.")) return;
    try {
      await requireDirector();
      const { data, error } = await db().from("am_market_products")
        .update({ status: nextStatus }).eq("id", id).select("id,status").single();
      if (error) throw error;
      if (!data) throw new Error("لم يتم تأكيد تحديث حالة المنتج.");
      status(nextStatus === "active" ? "تم نشر المنتج." : "تم إخفاء المنتج دون حذفه.");
      await loadMarketAdminData();
    } catch (error) {
      console.error("Product status update failed:", error);
      status("تعذر تحديث المنتج: " + (error?.message || "خطأ غير معروف"), true);
    }
  }

  function handleListAction(event) {
    const button = event.target.closest("button[data-market-action]");
    if (!button || button.disabled) return;
    const id = button.dataset.id;
    const action = button.dataset.marketAction || "";
    button.disabled = true;
    if (action.startsWith("seller-")) {
      updateSellerStatus(id, action.slice("seller-".length)).finally(() => { button.disabled = false; });
    } else if (action.startsWith("product-")) {
      updateProductStatus(id, action.slice("product-".length)).finally(() => { button.disabled = false; });
    } else {
      button.disabled = false;
    }
  }

  function showMarketAdminTab() {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.add("hidden"));
    const tab = el("marketAdminTab");
    if (tab) tab.classList.remove("hidden");
    loadMarketAdminData();
  }

  const sellersHost = el("marketSellersList");
  const productsHost = el("marketProductsList");
  if (sellersHost) sellersHost.addEventListener("click", handleListAction);
  if (productsHost) productsHost.addEventListener("click", handleListAction);

  window.showMarketAdminTab = showMarketAdminTab;
  window.loadMarketAdminData = loadMarketAdminData;
})();