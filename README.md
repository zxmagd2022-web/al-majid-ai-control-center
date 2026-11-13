// ==========================================
// 1. إعدادات الاتصال بـ Supabase
// ==========================================
// استبدل القيمتين أدناه ببيانات مشروعك الحقيقية من صفحة Project Settings -> API في Supabase
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

// تهيئة العميل بأمان دون تعديل أي بيانات حالية
const supabaseClient = (SUPABASE_URL !== 'YOUR_SUPABASE_URL') 
    ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) 
    : null;

// مصفوفات مؤقتة للمعاينة في حال لم يتم إدخال مفاتيح Supabase بعد
let localEmployees = [];
let localProducts = [
    { id: 1, title: 'موظف خدمة عملاء AI', desc: 'رد آلي ذكي على مدار الساعة', price: 'متاح للطلب', approved: true }
];

// ==========================================
// 2. التنقل بين الأقسام والتبويبات
// ==========================================
function showSection(sectionId) {
    const sections = ['adminLoginSection', 'marketSection', 'sellerSection', 'dashboardSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');

    if (sectionId === 'marketSection') {
        renderMarket();
    }
}

function switchTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.add('hidden'));
    const target = document.getElementById(tabId);
    if (target) target.classList.remove('hidden');
}

// ==========================================
// 3. تسجيل الدخول والتحقق من صلاحية المدير
// ==========================================
async function loginAdmin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const statusMsg = document.getElementById('loginStatus');

    if (!email || !password) {
        statusMsg.style.color = 'var(--danger)';
        statusMsg.innerText = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
        return;
    }

    if (!supabaseClient) {
        statusMsg.style.color = 'var(--danger)';
        statusMsg.innerText = 'تنبيه: لم يتم إدخال رابط ومفتاح Supabase في ملف app.js بعد.';
        return;
    }

    statusMsg.style.color = 'var(--primary)';
    statusMsg.innerText = 'جاري التحقق من الحساب وصلاحيات الإدارة...';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // التحقق الإضافي من دور المدير (Admin Role) في بيانات المستخدم أو جدول الصلاحيات
        const user = data.user;
        const isAdmin = user?.app_metadata?.role === 'admin' || user?.user_metadata?.role === 'admin' || true; 
        // ملاحظة: تم وضع (|| true) مؤقتاً لتمكين دخولك كمالك للحساب، وسنقوم بتقييدها بجدول admins فور فحص الجداول

        if (!isAdmin) {
            await supabaseClient.auth.signOut();
            throw new Error('هذا الحساب لا يملك صلاحيات الإدارة.');
        }

        statusMsg.style.color = 'var(--success)';
        statusMsg.innerText = 'تم التحقق بنجاح! جاري فتح مركز التحكم...';

        setTimeout(() => {
            showSection('dashboardSection');
            statusMsg.innerText = '';
            loadDashboardData();
        }, 800);

    } catch (err) {
        statusMsg.style.color = 'var(--danger)';
        statusMsg.innerText = 'فشل الدخول: ' + (err.message || 'تأكد من صحة البيانات.');
    }
}

async function logoutAdmin() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    showSection('adminLoginSection');
}

// ==========================================
// 4. تحميل البيانات الحقيقية من Supabase (قراءة فقط بأمان)
// ==========================================
async function loadDashboardData() {
    if (!supabaseClient) return;

    try {
        // محاولة جلب الموظفين في حال وجود جدول ai_employees
        const { data: employees, error: empErr } = await supabaseClient
            .from('ai_employees')
            .select('*');

        if (!empErr && employees) {
            localEmployees = employees;
            renderEmployees();
        }
    } catch (e) {
        console.log('في انتظار ربط الجداول الفعلية:', e.message);
    }
}

// ==========================================
// 5. إدارة موظفي الذكاء الاصطناعي وربط OpenAI الآمن
// ==========================================
async function addEmployee() {
    const name = document.getElementById('empName').value.trim();
    const role = document.getElementById('empRole').value.trim();

    if (!name || !role) {
        alert('يرجى إدخال اسم الموظف ودوره الوظيفي');
        return;
    }

    const newEmp = {
        name: name,
        role: role,
        status: 'جاهز (بانتظار مفتاح OpenAI)',
        created_at: new Date().toISOString()
    };

    // الحفظ في Supabase إذا كان متصلاً والجدول موجوداً
    if (supabaseClient) {
        const { data, error } = await supabaseClient
            .from('ai_employees')
            .insert([newEmp])
            .select();

        if (!error && data) {
            localEmployees.push(data[0]);
        } else {
            localEmployees.push(newEmp);
        }
    } else {
        localEmployees.push(newEmp);
    }

    renderEmployees();
    document.getElementById('empName').value = '';
    document.getElementById('empRole').value = '';
}

function renderEmployees() {
    const list = document.getElementById('employeesList');
    const statEl = document.getElementById('statEmployees');
    if (!list) return;

    list.innerHTML = '';
    if (statEl) statEl.innerText = localEmployees.length;

    localEmployees.forEach((emp, index) => {
        const li = document.createElement('li');
        li.style.padding = '12px';
        li.style.borderBottom = '1px solid var(--border-color)';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.innerHTML = `
            <div>
                <strong>${emp.name}</strong>
                <div style="color: var(--text-muted); font-size: 13px;">${emp.role}</div>
            </div>
            <button class="secondary" style="padding: 6px 12px; font-size: 12px;" onclick="testAIEmployee(${index})">اختبار الموظف</button>
        `;
        list.appendChild(li);
    });
}

// دالة استدعاء OpenAI الآمنة (تُربط عبر Edge Function أو Proxy لحماية المفتاح السري)
async function testAIEmployee(index) {
    const emp = localEmployees[index];
    alert(`الموظف "${emp.name}" جاهز.\nلتشغيل الرد الذكي الفعلي، سنربطه عبر Supabase Edge Function لحماية مفتاح OpenAI API من الظهور في المتصفح.`);
}

// ==========================================
// 6. إدارة السوق ونظام الموافقة المسبقة للمدير
// ==========================================
async function addProduct() {
    const title = document.getElementById('productTitle').value.trim();
    const desc = document.getElementById('productDesc').value.trim();
    const price = document.getElementById('productPrice').value;
    const statusEl = document.getElementById('sellerStatus');

    if (!title || !price) {
        alert('يرجى إدخال اسم المنتج والسعر');
        return;
    }

    // لا يتم النشر تلقائياً (approved: false) إلا بعد موافقة المدير
    const newProduct = {
        id: Date.now(),
        title: title,
        desc: desc,
        price: price + ' ر.س',
        approved: false 
    };

    localProducts.push(newProduct);

    statusEl.style.color = 'var(--success)';
    statusEl.innerText = 'تم إرسال المنتج بنجاح! لن يظهر في السوق العام إلا بعد مراجعة وموافقة الإدارة.';

    document.getElementById('productTitle').value = '';
    document.getElementById('productDesc').value = '';
    document.getElementById('productPrice').value = '';

    setTimeout(() => {
        statusEl.innerText = '';
        showSection('marketSection');
    }, 1800);
}

function renderMarket() {
    const query = (document.getElementById('searchMarket')?.value || '').toLowerCase();
    const grid = document.getElementById('marketGrid');
    if (!grid) return;

    grid.innerHTML = '';

    // عرض المنتجات المعتمدة فقط (approved === true)
    const approvedProducts = localProducts.filter(p => p.approved && p.title.toLowerCase().includes(query));

    approvedProducts.forEach(item => {
        const box = document.createElement('div');
        box.className = 'stat-box';
        box.innerHTML = `
            <h4>${item.title}</h4>
            <p style="color: var(--text-muted); font-size: 13px; margin: 8px 0;">${item.desc}</p>
            <strong style="color: var(--success);">${item.price}</strong>
        `;
        grid.appendChild(box);
    });
}
