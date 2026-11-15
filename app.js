/* =====================================================
   AL MAJID AI CONTROL CENTER
   Main application: app.js
   Version: 3.7 (Complete Client, Project & Leila AI Integration)
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
let localClients = [];
let localProjects = [];
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

// 4. ACTIVITY LOGGER (SECURE WITH EXPLICIT ERROR CHECKING)
async function logActivity(action, details = {}) {
    try {
        const { error } = await supabaseClient
            .from('am_activity_log')
            .insert([{
                action: action,
                details: details,
                created_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Activity log insertion error:', error.message);
        }
    } catch (err) {
        console.error('Activity log unexpected error:', err);
    }
}

// 5. VERIFY ACTIVE DIRECTOR
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

// 6. NAVIGATION
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

// 7. ADMIN LOGIN
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

        await logActivity('ADMIN_LOGIN', { email: email });

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

// 8. ADMIN LOGOUT
async function logoutAdmin() {
    try {
        await logActivity('ADMIN_LOGOUT', {});

        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        localEmployees = [];
        localClients = [];
        localProjects = [];
        renderEmployees();
        renderClients();
        renderProjects();
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

// 9. LOAD DASHBOARD DATA
async function loadDashboardData() {
    if (isLoading) return;

    isLoading = true;

    try {
        const isDirector = await verifyActiveDirector();

        if (!isDirector) {
            await supabaseClient.auth.signOut();
            localEmployees = [];
            localClients = [];
            localProjects = [];
            renderEmployees();
            renderClients();
            renderProjects();
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        // Load employees
        const { data: empData, error: empError } = await supabaseClient
            .from('ai_employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (empError) throw empError;

        localEmployees = Array.isArray(empData) ? empData : [];
        renderEmployees();

        // Load clients
        await loadClients();

        // Load projects
        await loadProjects();

        return true;

    } catch (error) {
        console.error('Dashboard loading error:', error);
        throw error;

    } finally {
        isLoading = false;
    }
}

// 10. ADD AI EMPLOYEE
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

        await logActivity('ADD_EMPLOYEE', { employee_name: name, role: role });

        showMessage('تم حفظ الموظف في قاعدة البيانات بنجاح.');

    } catch (error) {
        console.error('Add employee error:', error);
        showError('لم يتم حفظ الموظف: ' + getErrorMessage(error));
    }
}

// 11. EDIT AI EMPLOYEE
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

        await logActivity('EDIT_EMPLOYEE', { employee_id: emp.id, new_name: cleanName });

        showMessage('تم تعديل بيانات الموظف وحفظها بنجاح.');

    } catch (error) {
        console.error('Edit employee error:', error);
        showError('تعذر تعديل الموظف: ' + getErrorMessage(error));
    }
}

// 12. CHANGE EMPLOYEE STATUS
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

        await logActivity('CHANGE_EMPLOYEE_STATUS', { employee_id: emp.id, status: newStatus.trim() });

        showMessage('تم تحديث حالة الموظف بنجاح.');

    } catch (error) {
        console.error('Status update error:', error);
        showError('تعذر تغيير الحالة: ' + getErrorMessage(error));
    }
}

// 13. DELETE AI EMPLOYEE
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

        await logActivity('DELETE_EMPLOYEE', { employee_id: emp.id, employee_name: emp.name });

        showMessage('تم حذف الموظف من قاعدة البيانات.');

    } catch (error) {
        console.error('Delete employee error:', error);
        showError('تعذر حذف الموظف: ' + getErrorMessage(error));
    }
}

// 14. DISPLAY EMPLOYEES
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

// 15. EMPLOYEE DETAILS
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

// CLIENT MANAGEMENT
async function loadClients() {
    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const { data, error } = await supabaseClient
            .from('am_clients')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        localClients = Array.isArray(data) ? data : [];
        renderClients();
        updateClientSelectOptions();
        return true;

    } catch (error) {
        console.error('Load clients error:', error);
        showError('تعذر تحميل العملاء: ' + getErrorMessage(error));
        return false;
    }
}

function renderClients() {
    const list = getElement('clientsList');
    const statEl = getElement('statClients');

    if (statEl) {
        statEl.textContent = String(localClients.length);
    }

    if (!list) return;

    list.replaceChildren();

    if (localClients.length === 0) {
        const empty = document.createElement('li');
        empty.textContent = 'لا يوجد عملاء مسجلون حالياً.';
        empty.style.padding = '12px';
        list.appendChild(empty);
        return;
    }

    localClients.forEach((client, index) => {
        const li = document.createElement('li');
        li.style.padding = '12px';
        li.style.borderBottom = '1px solid var(--border-color)';
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '10px';

        const details = document.createElement('div');

        const name = document.createElement('strong');
        name.textContent = client.name || 'عميل بدون اسم';

        const info = document.createElement('p');
        info.textContent = [
            client.business_name,
            client.phone,
            client.city,
            client.country
        ].filter(Boolean).join(' | ');

        info.style.color = 'var(--text-muted)';
        info.style.fontSize = '13px';
        info.style.marginTop = '4px';

        details.append(name, info);

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
            createActionButton('تعديل', 'secondary', () => {
                editClient(index);
            }),
            createActionButton('حذف', 'secondary', () => {
                deleteClient(index);
            })
        );

        li.append(details, buttons);
        list.appendChild(li);
    });
}

function updateClientSelectOptions() {
    const select = getElement('projectClientSelect');
    if (!select) return;

    select.replaceChildren();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'اختر العميل...';
    select.appendChild(defaultOption);

    localClients.forEach(client => {
        const opt = document.createElement('option');
        opt.value = client.id;
        opt.textContent = client.name + (client.business_name ? ' (' + client.business_name + ')' : '');
        select.appendChild(opt);
    });
}

async function addClient() {
    const name = getElement('clientName')?.value.trim();
    const business = getElement('clientBusiness')?.value.trim();
    const phone = getElement('clientPhone')?.value.trim();
    const whatsapp = getElement('clientWhatsapp')?.value.trim();
    const email = getElement('clientEmail')?.value.trim();
    const country = getElement('clientCountry')?.value.trim() || 'Nigeria';
    const city = getElement('clientCity')?.value.trim();
    const notes = getElement('clientNotes')?.value.trim();

    if (!name) {
        showError('يرجى إدخال اسم العميل.');
        return;
    }

    const emailInput = getElement('clientEmail');
    if (email && emailInput && !emailInput.checkValidity()) {
        showError('يرجى إدخال بريد إلكتروني صحيح.');
        return;
    }

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const newClient = {
            name,
            business_name: business || null,
            phone: phone || null,
            whatsapp: whatsapp || null,
            email: email || null,
            country,
            city: city || null,
            notes: notes || null
        };

        const { data, error } = await supabaseClient
            .from('am_clients')
            .insert([newClient])
            .select()
            .single();

        if (error) throw error;

        localClients.unshift(data);
        renderClients();
        updateClientSelectOptions();

        [
            'clientName',
            'clientBusiness',
            'clientPhone',
            'clientWhatsapp',
            'clientEmail',
            'clientCity',
            'clientNotes'
        ].forEach(id => {
            const element = getElement(id);
            if (element) element.value = '';
        });

        if (getElement('clientCountry')) {
            getElement('clientCountry').value = 'Nigeria';
        }

        await logActivity('ADD_CLIENT', {
            client_id: data.id,
            client_name: data.name
        });

        showMessage('تم حفظ العميل بنجاح.');

    } catch (error) {
        console.error('Add client error:', error);
        showError('لم يتم حفظ العميل: ' + getErrorMessage(error));
    }
}

// EDIT CLIENT
async function editClient(index) {
    const client = localClients[index];
    if (!client) return;

    const fields = [
        ['name', 'اسم العميل', client.name],
        ['business_name', 'النشاط التجاري', client.business_name || ''],
        ['phone', 'رقم الهاتف', client.phone || ''],
        ['whatsapp', 'رقم الواتساب', client.whatsapp || ''],
        ['email', 'البريد الإلكتروني', client.email || ''],
        ['country', 'الدولة', client.country || 'Nigeria'],
        ['city', 'المدينة', client.city || ''],
        ['notes', 'ملاحظات إضافية', client.notes || '']
    ];

    const updatedClient = {};

    for (const [key, label, currentValue] of fields) {
        const value = prompt('تعديل ' + label + ':', currentValue);
        if (value === null) return;
        updatedClient[key] = value.trim() || null;
    }

    if (!updatedClient.name) {
        showError('اسم العميل لا يمكن أن يكون فارغاً.');
        return;
    }

    if (updatedClient.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatedClient.email)) {
        showError('يرجى إدخال بريد إلكتروني صحيح.');
        return;
    }

    updatedClient.country = updatedClient.country || 'Nigeria';

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const { data, error } = await supabaseClient
            .from('am_clients')
            .update(updatedClient)
            .eq('id', client.id)
            .select()
            .single();

        if (error) throw error;

        localClients[index] = data;
        renderClients();
        updateClientSelectOptions();

        await logActivity('EDIT_CLIENT', {
            client_id: client.id,
            client_name: data.name
        });

        showMessage('تم تعديل بيانات العميل بنجاح.');

    } catch (error) {
        console.error('Edit client error:', error);
        showError('تعذر تعديل العميل: ' + getErrorMessage(error));
    }
}

// DELETE CLIENT (محدث مع التحقق الفعلي من قاعدة البيانات)
async function deleteClient(index) {
    const client = localClients[index];
    if (!client) return;

    const confirmed = confirm(
        'هل أنت متأكد من حذف العميل "' +
        (client.name || '') +
        '" نهائياً؟\n\nلا يمكن التراجع عن الحذف.'
    );

    if (!confirmed) return;

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const { data: deletedClient, error } = await supabaseClient
            .from('am_clients')
            .delete()
            .eq('id', client.id)
            .select('id')
            .maybeSingle();

        if (error) throw error;

        if (!deletedClient || deletedClient.id !== client.id) {
            throw new Error('لم تؤكد قاعدة البيانات حذف العميل. لم يتم تغيير القائمة.');
        }

        localClients = localClients.filter(
            item => item.id !== client.id
        );

        renderClients();
        updateClientSelectOptions();

        await logActivity('DELETE_CLIENT', {
            client_id: client.id,
            client_name: client.name
        });

        showMessage('تم حذف العميل بنجاح.');

    } catch (error) {
        console.error('Delete client error:', error);
        showError('تعذر حذف العميل: ' + getErrorMessage(error));
    }
}

// PROJECT MANAGEMENT
function openProjectModal() {
    const container = getElement('projectFormContainer');
    if (container) container.classList.remove('hidden');
}

function closeProjectModal() {
    const container = getElement('projectFormContainer');
    if (container) container.classList.add('hidden');
}

async function loadProjects() {
    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const { data, error } = await supabaseClient
            .from('am_projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        localProjects = Array.isArray(data) ? data : [];
        renderProjects();
        return true;

    } catch (error) {
        console.error('Load projects error:', error);
        return false;
    }
}

function renderProjects() {
    const list = getElement('projectsList');
    const statEl = getElement('statProjects');

    if (statEl) {
        statEl.textContent = String(localProjects.length);
    }

    if (!list) return;

    list.replaceChildren();

    if (localProjects.length === 0) {
        const empty = document.createElement('li');
        empty.textContent = 'لا توجد مشاريع مسجلة حالياً.';
        empty.style.padding = '12px';
        list.appendChild(empty);
        return;
    }

    localProjects.forEach(project => {
        const li = document.createElement('li');
        li.style.padding = '12px';
        li.style.borderBottom = '1px solid var(--border-color)';
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '6px';

        const title = document.createElement('strong');
        title.textContent = project.title || 'مشروع بدون عنوان';

        const clientObj = localClients.find(c => c.id === project.client_id);
        const clientName = clientObj ? clientObj.name : 'عميل غير محدد';

        const info = document.createElement('p');
        info.textContent = 'العميل: ' + clientName + ' | الحالة: ' + (project.status || 'قيد الانتظار') + (project.budget ? ' | الميزانية: ' + project.budget + ' NGN' : '');
        info.style.color = 'var(--text-muted)';
        info.style.fontSize = '13px';

        li.append(title, info);
        list.appendChild(li);
    });
}

async function addProject() {
    const title = getElement('projectTitle')?.value.trim();
    const clientId = getElement('projectClientSelect')?.value;
    const desc = getElement('projectDesc')?.value.trim();
    const budget = getElement('projectBudget')?.value.trim();
    const status = getElement('projectStatus')?.value || 'قيد الانتظار';

    if (!title) {
        showError('يرجى إدخال اسم المشروع.');
        return;
    }

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة.');
        }

        const newProject = {
            title,
            client_id: clientId || null,
            description: desc || null,
            budget: budget ? parseFloat(budget) : null,
            status
        };

        const { data, error } = await supabaseClient
            .from('am_projects')
            .insert([newProject])
            .select()
            .single();

        if (error) throw error;

        localProjects.unshift(data);
        renderProjects();
        closeProjectModal();

        getElement('projectTitle').value = '';
        getElement('projectClientSelect').value = '';
        getElement('projectDesc').value = '';
        getElement('projectBudget').value = '';

        await logActivity('ADD_PROJECT', {
            project_id: data.id,
            project_title: data.title
        });

        showMessage('تم حفظ المشروع بنجاح.');

    } catch (error) {
        console.error('Add project error:', error);
        showError('لم يتم حفظ المشروع: ' + getErrorMessage(error));
    }
}

// ==========================================
// LEILA AI CHAT INTEGRATION
// ==========================================

async function sendMessageToLeila() {
    const inputElement = getElement('leilaMessageInput');
    const statusElement = getElement('leilaChatStatus');
    const historyContainer = getElement('leilaChatHistory');
    const sendBtn = getElement('sendLeilaBtn');

    if (!inputElement || !historyContainer) return;

    const message = inputElement.value.trim();
    if (!message) {
        showError('يرجى كتابة رسالة أولاً.');
        return;
    }

    try {
        if (!(await verifyActiveDirector())) {
            throw new Error('صلاحية المدير النشط مطلوبة لاستخدام هذه الخدمة.');
        }
    } catch (err) {
        showError(err.message);
        return;
    }

    if (sendBtn) sendBtn.disabled = true;
    setMessage(statusElement, 'جارٍ إرسال الرسالة إلى ليلى...', 'var(--primary)');

    appendChatMessage('المدير', message, 'var(--primary)');
    inputElement.value = '';

    try {
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !sessionData?.session) {
            throw new Error('جلسة تسجيل الدخول غير صالحة. يرجى إعادة تسجيل الدخول.');
        }

        const accessToken = sessionData.session.access_token;
        const supabaseUrl = SUPABASE_URL;

        const response = await fetch(`${supabaseUrl}/functions/v1/leila-chat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message })
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || 'تعذر الحصول على رد من ليلى.');
        }

        appendChatMessage('ليلى (خدمة العملاء)', result.reply, 'var(--success)');
        setMessage(statusElement, 'تم الرد بنجاح.', 'var(--success)');

        await logActivity('LEILA_CHAT_QUERY', { query_length: message.length });

    } catch (error) {
        console.error('Leila chat error:', error);
        showError('خطأ في محادثة ليلى: ' + getErrorMessage(error));
        setMessage(statusElement, 'فشل إرسال الرسالة.', 'var(--danger)');
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function appendChatMessage(sender, text, color) {
    const historyContainer = getElement('leilaChatHistory');
    if (!historyContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.style.padding = '10px';
    messageDiv.style.borderRadius = '8px';
    messageDiv.style.background = sender === 'المدير' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)';
    messageDiv.style.border = '1px solid var(--border-color)';

    const senderHeader = document.createElement('strong');
    senderHeader.textContent = sender + ': ';
    senderHeader.style.color = color;

    const textContent = document.createElement('span');
    textContent.textContent = text;
    textContent.style.whiteSpace = 'pre-wrap';

    messageDiv.append(senderHeader, textContent);
    historyContainer.appendChild(messageDiv);

    historyContainer.scrollTop = historyContainer.scrollHeight;
}

function clearLeilaChat() {
    const historyContainer = getElement('leilaChatHistory');
    if (!historyContainer) return;

    historyContainer.replaceChildren();

    const welcomeMsg = document.createElement('div');
    welcomeMsg.textContent = 'مرحباً بك أيها المدير، كيف يمكنني مساعدتك اليوم؟';
    welcomeMsg.style.color = 'var(--text-muted)';
    welcomeMsg.style.fontSize = '13px';
    welcomeMsg.style.textAlign = 'center';

    historyContainer.appendChild(welcomeMsg);
    setMessage(getElement('leilaChatStatus'), 'تم مسح المحادثة.', 'var(--success)');
}

// 16. ADD MARKET PRODUCT
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

// 17. DISPLAY APPROVED PRODUCTS
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

// 18. MARKET SEARCH
function initializeMarketSearch() {
    const search = getElement('searchMarket');

    if (search && !search.dataset.initialized) {
        search.addEventListener('input', renderMarket);
        search.dataset.initialized = 'true';
    }
}

// 19. INITIALIZE APPLICATION (WITH AUTO SESSION RESTORATION)
async function initializeApp() {
    initializeMarketSearch();

    localEmployees = [];
    localClients = [];
    localProjects = [];
    renderEmployees();
    renderClients();
    renderProjects();

    showSection('adminLoginSection');

    try {
        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        const session = data?.session;

        if (!session) {
            showSection('adminLoginSection');
            return;
        }

        const isDirector = await verifyActiveDirector();

        if (!isDirector) {
            await supabaseClient.auth.signOut();
            showSection('adminLoginSection');

            setMessage(
                getElement('loginStatus'),
                'الجلسة غير صالحة أو الحساب ليس مديراً نشطاً.',
                'var(--danger)'
            );
            return;
        }

        await loadDashboardData();
        showSection('dashboardSection');

    } catch (error) {
        console.error('Session restoration error:', error);

        localEmployees = [];
        localClients = [];
        localProjects = [];
        renderEmployees();
        renderClients();
        renderProjects();

        await supabaseClient.auth.signOut();

        showSection('adminLoginSection');

        setMessage(
            getElement('loginStatus'),
            'تعذر استعادة الجلسة. يرجى تسجيل الدخول من جديد.',
            'var(--danger)'
        );
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// 20. EXPOSE FUNCTIONS FOR HTML BUTTONS
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
window.loadClients = loadClients;
window.renderClients = renderClients;
window.addClient = addClient;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.openProjectModal = openProjectModal;
window.closeProjectModal = closeProjectModal;
window.loadProjects = loadProjects;
window.renderProjects = renderProjects;
window.addProject = addProject;
window.sendMessageToLeila = sendMessageToLeila;
window.clearLeilaChat = clearLeilaChat;
window.addProduct = addProduct;
window.renderMarket = renderMarket;
