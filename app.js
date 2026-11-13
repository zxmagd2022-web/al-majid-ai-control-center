
/* =====================================================
   AL MAJID AI CONTROL CENTER
   Main application: app.js
   Version: 3.0
   ===================================================== */

// 1. SUPABASE CONNECTION
const SUPABASE_URL = 'https://cafvkonbubrqsabsywry.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QvFdOACJ5_bBnhjp3Pnm0g_vG_d1iR6';

if (!window.supabase) {
    throw new Error('مكتبة Supabase غير محمّلة.');
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// 2. APPLICATION STATE
let localEmployees = [];
let localProducts = [];
let isLoading = false;

// 3. ELEMENT HELPERS
function getElement(id) {
    return document.getElementById(id);
}

function setMessage(element, message, color) {
    if (!element) return;
    element.textContent = message;
    if (color) element.style.color = color;
}

function showMessage(message) {
    alert(message);
}

function showError(message) {
    console.error(message);
    showMessage(message);
}

function getErrorMessage(error) {
    return error?.message || 'حدث خطأ غير معروف.';
}

// 4. VERIFY ACTIVE DIRECTOR
async function verifyActiveDirector() {
    const { data: userData, error: userError } =
        await supabaseClient.auth.getUser();

    if (userError || !userData?.user) {
        return false;
    }

    const { data, error } =
        await supabaseClient.rpc('is_active_director');

    if (error) {
        console.error('Director verification error:', error);
        throw new Error('تعذر التحقق من صلاحيات المدير.');
    }

    return data === true;
}

// 5. NAVIGATION
function showSection(sectionId) {
    const sections = [
        'adminLoginSection',
        'marketSection',
        'sellerSection',
        'dashboardSection'
    ];

    sections.forEach(id => {
        const section = getElement(id);
        if (section) section.classList.add('hidden');
    });

    const target = getElement(sectionId);
    if (target) target.classList.remove('hidden');

    if (sectionId === 'marketSection') renderMarket();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    const target = getElement(tabId);
    if (target) target.classList.remove('hidden');
}

// 6. ADMIN LOGIN
async function loginAdmin() {
    const email = getElement('adminEmail')?.value.trim();
    const password = getElement('adminPassword')?.value;
    const statusMsg = getElement('loginStatus');

    if (!email || !password) {
        setMessage(
            statusMsg,
            'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
            'var(--danger)'
        );
        return;
    }

    setMessage(
        statusMsg,
        'جارٍ التحقق من الحساب وصلاحيات المدير...',
        'var(--primary)'
    );

    try {
        const { error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        const isDirector = await verifyActiveDirector();

        if (!isDirector) {
            await supabaseClient.auth.signOut();
            throw new Error('هذا الحساب ليس حساب مدير نشط.');
        }

        if (getElement('adminPassword')) {
            getElement('adminPassword').value = '';
        }

        await loadDashboardData();
        showSection('dashboardSection');

        setMessage(
            statusMsg,
            'تم تسجيل الدخول بنجاح.',
            'var(--success)'
        );

    } catch (error) {
        console.error('Login error:', error);
        await supabaseClient.auth.signOut();
        showSection('adminLoginSection');

        setMessage(
            statusMsg,
            'فشل تسجيل الدخول: ' + getErrorMessage(error),
            'var(--danger)'
        );
    }
}

// 7. ADMIN LOGOUT
async function logoutAdmin() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        localEmployees = [];
        renderEmployees();
        showSection('adminLoginSection');

        setMessage(
            getElement('loginStatus'),
            'تم تسجيل الخروج.',
            'var(--success)'
        );

    } catch (error) {
        showError('تعذر تسجيل الخروج: ' + getErrorMessage(error));
    }
}

// 8. LOAD DASHBOARD DATA
async function loadDashboardData() {
    if (isLoading) return;

    isLoading = true;

    try {
        const isDirector = await verifyActiveDirector();

        if (!isDirector) {
            await supabaseClient.auth.signOut();
            localEmployees = [];
            renderEmployees();
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const { data, error } = await supabaseClient
            .from('ai_employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        localEmployees = Array.isArray(data) ? data : [];
        renderEmployees();

        return true;

    } catch (error) {
        console.error('Dashboard loading error:', error);
        throw error;

    } finally {
        isLoading = false;
    }
}

// 9. ADD AI EMPLOYEE
async function addEmployee() {
    const name = getElement('empName')?.value.trim();
    const role = getElement('empRole')?.value.trim();

    if (!name || !role) {
        showError('يرجى إدخال اسم الموظف والمسمى الوظيفي.');
        return;
    }

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const newEmployee = {
            name,
            role,
            status: 'جاهز'
        };

        const { data, error } = await supabaseClient
            .from('ai_employees')
            .insert([newEmployee])
            .select()
            .single();

        if (error) throw error;

        localEmployees.unshift(data);
        renderEmployees();

        getElement('empName').value = '';
        getElement('empRole').value = '';

        showMessage('تم حفظ الموظف في قاعدة البيانات بنجاح.');

    } catch (error) {
        console.error('Add employee error:', error);
        showError('لم يتم حفظ الموظف: ' + getErrorMessage(error));
    }
}

// 10. EDIT AI EMPLOYEE
async function editAIEmployee(index) {
    const emp = localEmployees[index];
    if (!emp) return;

    const newName = prompt('أدخل اسم الموظف الجديد:', emp.name || '');
    if (newName === null) return;

    const cleanName = newName.trim();
    if (!cleanName) {
        showError('اسم الموظف لا يمكن أن يكون فارغاً.');
        return;
    }

    const newRole = prompt(
        'أدخل الدور أو تعليمات الموظف الجديدة:',
        emp.role || ''
    );

    if (newRole === null) return;

    const cleanRole = newRole.trim();
    if (!cleanRole) {
        showError('دور الموظف لا يمكن أن يكون فارغاً.');
        return;
    }

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const { data, error } = await supabaseClient
            .from('ai_employees')
            .update({
                name: cleanName,
                role: cleanRole
            })
            .eq('id', emp.id)
            .select()
            .single();

        if (error) throw error;

        localEmployees[index] = data;
        renderEmployees();

        showMessage('تم تعديل بيانات الموظف وحفظها بنجاح.');

    } catch (error) {
        console.error('Edit employee error:', error);
        showError('تعذر تعديل الموظف: ' + getErrorMessage(error));
    }
}

// 11. CHANGE EMPLOYEE STATUS
async function changeAIEmployeeStatus(index) {
    const emp = localEmployees[index];
    if (!emp) return;

    const newStatus = prompt(
        'اختر الحالة الجديدة بكتابة واحدة من الحالات التالية:\n\nجاهز\nقيد العمل\nمتوقف',
        emp.status || 'جاهز'
    );

    if (newStatus === null) return;

    const allowedStatuses = ['جاهز', 'قيد العمل', 'متوقف'];

    if (!allowedStatuses.includes(newStatus.trim())) {
        showError('الحالة غير صحيحة. استخدم: جاهز أو قيد العمل أو متوقف.');
        return;
    }

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const { data, error } = await supabaseClient
            .from('ai_employees')
            .update({ status: newStatus.trim() })
            .eq('id', emp.id)
            .select()
            .single();

        if (error) throw error;

        localEmployees[index] = data;
        renderEmployees();

        showMessage('تم تحديث حالة الموظف بنجاح.');

    } catch (error) {
        console.error('Status update error:', error);
        showError('تعذر تغيير الحالة: ' + getErrorMessage(error));
    }
}

// 12. DELETE AI EMPLOYEE
async function deleteAIEmployee(index) {
    const emp = localEmployees[index];
    if (!emp) return;

    const confirmed = confirm(
        'هل أنت متأكد من حذف الموظف "' +
        (emp.name || '') +
        '" نهائياً؟\n\nلا يمكن التراجع عن الحذف.'
    );

    if (!confirmed) return;

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const { error } = await supabaseClient
            .from('ai_employees')
            .delete()
            .eq('id', emp.id);

        if (error) throw error;

        localEmployees = localEmployees.filter(
            employee => employee.id !== emp.id
        );

        renderEmployees();
        showMessage('تم حذف الموظف من قاعدة البيانات.');

    } catch (error) {
        console.error('Delete employee error:', error);
        showError('تعذر حذف الموظف: ' + getErrorMessage(error));
    }
}

// 13. DISPLAY EMPLOYEES
function renderEmployees() {
    const list = getElement('employeesList');
    const statEl = getElement('statEmployees');

    if (statEl) {
        statEl.textContent = String(localEmployees.length);
    }

    if (!list) return;

    list.replaceChildren();

    if (localEmployees.length === 0) {
        const empty = document.createElement('li');
        empty.textContent = 'لا يوجد موظفون مسجلون حالياً.';
        empty.style.padding = '12px';
        list.appendChild(empty);
        return;
    }

    localEmployees.forEach((emp, index) => {
        const li = document.createElement('li');

        li.style.padding = '12px';
        li.style.borderBottom = '1px solid var(--border-color)';
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '10px';

        const details = document.createElement('div');

        const name = document.createElement('strong');
        name.textContent = emp.name || 'موظف بدون اسم';

        const role = document.createElement('div');
        role.textContent = emp.role || 'لم يتم تحديد الوظيفة';
        role.style.color = 'var(--text-muted)';
        role.style.fontSize = '13px';

        const status = document.createElement('div');
        status.textContent = 'الحالة: ' + (emp.status || 'غير محددة');
        status.style.fontSize = '12px';

        details.append(name, role, status);

        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.flexWrap = 'wrap';
        buttons.style.gap = '6px';

        function createActionButton(label, className, action) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.className = className;
            button.style.padding = '7px 10px';
            button.style.fontSize = '12px';
            button.addEventListener('click', action);
            return button;
        }

        buttons.append(
            createActionButton('عرض التفاصيل', 'secondary', () => {
                testAIEmployee(index);
            }),
            createActionButton('تعديل', 'secondary', () => {
                editAIEmployee(index);
            }),
            createActionButton('تغيير الحالة', 'secondary', () => {
                changeAIEmployeeStatus(index);
            }),
            createActionButton('حذف', 'secondary', () => {
                deleteAIEmployee(index);
            })
        );

        li.append(details, buttons);
        list.appendChild(li);
    });
}

// 14. EMPLOYEE DETAILS
function testAIEmployee(index) {
    const emp = localEmployees[index];
    if (!emp) return;

    showMessage(
        'تفاصيل الموظف\n\n' +
        'الاسم: ' + (emp.name || '') +
        '\nالوظيفة: ' + (emp.role || '') +
        '\nالحالة: ' + (emp.status || 'غير محددة') +
        '\n\nهذا عرض للبيانات فقط. لم يتم تشغيل ذكاء اصطناعي فعلي.'
    );
}

// 15. ADD MARKET PRODUCT
function addProduct() {
    const title = getElement('productTitle')?.value.trim();
    const desc = getElement('productDesc')?.value.trim();
    const price = getElement('productPrice')?.value.trim();
    const statusEl = getElement('sellerStatus');

    if (!title || !price) {
        setMessage(
            statusEl,
            'يرجى إدخال اسم المنتج والسعر.',
            'var(--danger)'
        );
        return;
    }

    localProducts.push({
        id: Date.now(),
        title,
        desc,
        price: price + ' ₦',
        approved: false
    });

    setMessage(
        statusEl,
        'تم تسجيل المنتج مؤقتاً في المتصفح فقط. لم يُحفظ في قاعدة البيانات ولم يُنشر.',
        'var(--success)'
    );

    getElement('productTitle').value = '';
    getElement('productDesc').value = '';
    getElement('productPrice').value = '';

    renderMarket();
}

// 16. DISPLAY APPROVED PRODUCTS
function renderMarket() {
    const query = (
        getElement('searchMarket')?.value || ''
    ).trim().toLowerCase();

    const grid = getElement('marketGrid');
    if (!grid) return;

    grid.replaceChildren();

    const approvedProducts = localProducts.filter(product =>
        product.approved &&
        (product.title || '').toLowerCase().includes(query)
    );

    if (approvedProducts.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'لا توجد منتجات معتمدة حالياً.';
        grid.appendChild(emptyMessage);
        return;
    }

    approvedProducts.forEach(item => {
        const box = document.createElement('div');
        box.className = 'stat-box';

        const title = document.createElement('h4');
        title.textContent = item.title || '';

        const description = document.createElement('p');
        description.textContent = item.desc || '';
        description.style.color = 'var(--text-muted)';
        description.style.fontSize = '13px';
        description.style.margin = '8px 0';

        const price = document.createElement('strong');
        price.textContent = item.price || '';

        box.append(title, description, price);
        grid.appendChild(box);
    });
}

// 17. MARKET SEARCH
function initializeMarketSearch() {
    const search = getElement('searchMarket');

    if (search && !search.dataset.initialized) {
        search.addEventListener('input', renderMarket);
        search.dataset.initialized = 'true';
    }
}

// 18. INITIALIZE APPLICATION
function initializeApp() {
    initializeMarketSearch();
    localEmployees = [];
    renderEmployees();
    showSection('adminLoginSection');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// 19. EXPOSE FUNCTIONS FOR HTML BUTTONS
window.showSection = showSection;
window.switchTab = switchTab;
window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.loadDashboardData = loadDashboardData;
window.addEmployee = addEmployee;
window.editAIEmployee = editAIEmployee;
window.changeAIEmployeeStatus = changeAIEmployeeStatus;
window.deleteAIEmployee = deleteAIEmployee;
window.testAIEmployee = testAIEmployee;
window.addProduct = addProduct;
window.renderMarket = renderMarket;
