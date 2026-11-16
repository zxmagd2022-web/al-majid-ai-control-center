
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/*
 AL MAJID AI CONTROL CENTER
 Frontend authentication - initial security version.

 IMPORTANT:
 - Never place service_role keys in this file.
 - Director access requires trusted app_metadata.role = "director".
 - Database RLS policies must independently enforce permissions.
*/

// 1. Supabase configuration
const SUPABASE_URL = "ضع_رابط_مشروعك_هنا";
const SUPABASE_PUBLISHABLE_KEY = "ضع_مفتاح_PUBLISHABLE_هنا";

const CONFIGURED =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("ضع_") &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  !SUPABASE_PUBLISHABLE_KEY.includes("ضع_");

const supabase = CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

// 2. HTML elements
const authView = document.getElementById("auth-view");
const dashboardView = document.getElementById("dashboard-view");

const phoneForm = document.getElementById("phone-auth-form");
const otpForm = document.getElementById("otp-verify-form");

const phoneInput = document.getElementById("phone-input");
const otpInput = document.getElementById("otp-input");

const phoneStep = document.getElementById("phone-step");
const otpStep = document.getElementById("otp-step");

const targetPhoneDisplay =
  document.getElementById("target-phone-display");

const logoutButton = document.getElementById("logout-btn");

let pendingPhone = "";
let authorizationInProgress = false;

// 3. Safe status message
function showStatus(message, isError = true) {
  let status = document.getElementById("auth-status");

  if (!status) {
    status = document.createElement("p");
    status.id = "auth-status";
    status.className = "text-sm text-center mt-4";
    authView?.querySelector(".max-w-md")?.appendChild(status);
  }

  if (status) {
    status.textContent = message;
    status.className = isError
      ? "text-sm text-center mt-4 text-rose-400"
      : "text-sm text-center mt-4 text-emerald-400";
  }
}

// 4. Show authentication screen
function showLogin() {
  if (authView) authView.style.display = "flex";
  if (dashboardView) dashboardView.style.display = "none";

  if (phoneStep) phoneStep.style.display = "block";
  if (otpStep) otpStep.style.display = "none";

  pendingPhone = "";
}

// 5. Director authorization
async function authorizeDirector() {
  if (!supabase || authorizationInProgress) return;

  authorizationInProgress = true;

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      showLogin();
      return;
    }

    // Trusted application metadata, not user-editable user_metadata.
    const role = data.user.app_metadata?.role;

    if (role !== "director") {
      showLogin();
      showStatus(
        "هذا الحساب غير مخوّل لدخول لوحة المدير. يرجى مراجعة المدير العام."
      );

      await supabase.auth.signOut();
      return;
    }

    if (authView) authView.style.display = "none";
    if (dashboardView) dashboardView.style.display = "flex";

    const directorStatus =
      document.getElementById("stats-director-status");

    if (directorStatus) {
      directorStatus.textContent = "تم التحقق من حساب المدير";
      directorStatus.className =
        "text-sm font-semibold mt-2 text-emerald-400";
    }

    showSection("dashboard");

  } catch (error) {
    console.error("Authorization error:", error);
    showLogin();
    showStatus("تعذر التحقق من صلاحيات الحساب.");
  } finally {
    authorizationInProgress = false;
  }
}

// 6. Send SMS OTP
phoneForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatus("يجب إعداد رابط Supabase ومفتاح Publishable أولاً.");
    return;
  }

  const phone = phoneInput?.value.trim() || "";

  // International phone format, for example +234...
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    showStatus("أدخل رقم الهاتف بصيغة دولية صحيحة، مع رمز الدولة.");
    return;
  }

  const button = phoneForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: false
      }
    });

    if (error) throw error;

    pendingPhone = phone;

    if (targetPhoneDisplay) {
      targetPhoneDisplay.textContent = phone;
    }

    if (phoneStep) phoneStep.style.display = "none";
    if (otpStep) otpStep.style.display = "block";

    showStatus("تم إرسال رمز التحقق. أدخل الرمز المرسل إليك.", false);

  } catch (error) {
    console.error("OTP send error:", error);
    showStatus("تعذر إرسال رمز التحقق. تحقق من الرقم وإعدادات SMS.");
  } finally {
    if (button) button.disabled = false;
  }
});

// 7. Verify SMS OTP
otpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase || !pendingPhone) {
    showStatus("انتهت جلسة طلب الرمز. أعد إدخال رقم الهاتف.");
    showLogin();
    return;
  }

  const token = otpInput?.value.trim() || "";

  if (!/^\d{6}$/.test(token)) {
    showStatus("أدخل رمز التحقق المكوّن من 6 أرقام.");
    return;
  }

  const button = otpForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    const { error } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token,
      type: "sms"
    });

    if (error) throw error;

    await authorizeDirector();

  } catch (error) {
    console.error("OTP verification error:", error);
    showStatus("رمز التحقق غير صحيح أو انتهت صلاحيته.");
  } finally {
    if (button) button.disabled = false;
  }
});

// 8. Dashboard navigation
function showSection(sectionName) {
  const allowedSections = [
    "dashboard",
    "clients",
    "marketplace",
    "leila"
  ];

  if (!allowedSections.includes(sectionName)) return;

  document.querySelectorAll(".control-section").forEach((section) => {
    section.style.display =
      section.id === `section-${sectionName}` ? "block" : "none";
  });

  document.querySelectorAll("[data-target-section]").forEach((button) => {
    const active =
      button.dataset.targetSection === sectionName;

    button.classList.toggle("bg-slate-800", active);
    button.classList.toggle("text-white", active);
    button.classList.toggle("text-slate-400", !active);
  });
}

document.querySelectorAll("[data-target-section]").forEach((button) => {
  button.addEventListener("click", () => {
    showSection(button.dataset.targetSection);
  });
});

// 9. Logout
logoutButton?.addEventListener("click", async () => {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    showStatus("تعذر تسجيل الخروج. حاول مرة أخرى.");
    return;
  }

  showLogin();
});

// 10. Safe initial session check
async function initialize() {
  if (!CONFIGURED || !supabase) {
    showLogin();
    showStatus("إعدادات Supabase غير مكتملة. لم يتم تفعيل تسجيل الدخول.");
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (data.session) {
      await authorizeDirector();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error("Session initialization error:", error);
    showLogin();
    showStatus("تعذر التحقق من جلسة الدخول.");
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      showLogin();
    }
  });
}

// Start application
initialize();
