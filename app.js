
/* =====================================================
   AL MAJID AI CONTROL CENTER
   Main application: app.js
   ===================================================== */

// 1. SUPABASE CONNECTION
const SUPABASE_URL = 'https://cafvkonbubrqsabsywry.supabase.co';
const SUPABASE_KEY = 'Sb_publishable_QvFdOACJ5_bBnhjp3Pnm0g_vG_d1iR6';

if (!window.supabase) {
    throw new Error('Supabase library is not loaded.');
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// 2. APPLICATION STATE
let localEmployees = [];

let localProducts = [
    {
        id: 1,
        title: 'AI Customer Service Employee',
        desc: 'Smart customer service available 24/7',
        price: 'Available on request',
        approved: true
    }
];

// 3. HELPER FUNCTIONS
function getElement(id) {
    return document.getElementById(id);
}

function setMessage(element, message, color) {
    if (!element) return;

    element.textContent = message;

    if (color) {
        element.style.color = color;
    }
}

function showError(message) {
    alert(message);
}

// 4. VERIFY AUTHENTICATED ACTIVE DIRECTOR
async function verifyActiveDirector() {
    const { data: userData, error: userError } =
        await supabaseClient.auth.getUser();

    if (userError || !userData?.user) {
        return false;
    }

    const { data, error } = await supabaseClient.rpc(
        'is_active_director'
    );

    if (error) {
        console.error('Director verification error:', error);
        throw new Error(
            'Unable to verify director permissions.'
        );
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

        if (section) {
            section.classList.add('hidden');
        }
    });

    const target = getElement(sectionId);

    if (target) {
        target.classList.remove('hidden');
    }

    if (sectionId === 'marketSection') {
        renderMarket();
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    const target = getElement(tabId);

    if (target) {
        target.classList.remove('hidden');
    }
}

// 6. ADMIN LOGIN
async function loginAdmin() {
    const email = getElement('adminEmail')?.value.trim();
    const password = getElement('adminPassword')?.value;
    const statusMsg = getElement('loginStatus');

    if (!email || !password) {
        setMessage(
            statusMsg,
            'Please enter your email and password.',
            'var(--danger)'
        );
        return;
    }

    setMessage(
        statusMsg,
        'Verifying account and director permissions...',
        'var(--primary)'
    );

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        const isDirector = await verifyActiveDirector();

        if (!isDirector) {
            await supabaseClient.auth.signOut();

            throw new Error(
                'This account is not an active director.'
            );
        }

        if (getElement('adminPassword')) {
            getElement('adminPassword').value = '';
        }

        showSection('dashboardSection');

        setMessage(
            statusMsg,
            'Login successful.',
            'var(--success)'
        );

        await loadDashboardData();

    } catch (error) {
        console.error('Login error:', error);

        setMessage(
            statusMsg,
            'Login failed: ' + error.message,
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

    } catch (error) {
        console.error('Logout error:', error);
        showError('Unable to log out. Please try again.');
    }
}

// 8. LOAD DASHBOARD DATA
async function loadDashboardData() {
    try {
        const isDirector = await verifyActiveDirector();

        if (!isDirector) {
            await supabaseClient.auth.signOut();
            showSection('adminLoginSection');

            showError('Director access is required.');
            return;
        }

        const { data, error } = await supabaseClient
            .from('ai_employees')
            .select('*');

        if (error) throw error;

        localEmployees = data || [];

        renderEmployees();

    } catch (error) {
        console.error('Dashboard error:', error);

        showError(
            'Unable to load employees: ' + error.message
        );
    }
}

// 9. ADD AI EMPLOYEE
async function addEmployee() {
    const name = getElement('empName')?.value.trim();
    const role = getElement('empRole')?.value.trim();

    if (!name || !role) {
        showError('Please enter the employee name and job role.');
        return;
    }

    try {
        const isDirector = await verifyActiveDirector();

        if (!isDirector) {
            throw new Error('Director permission is required.');
        }

        const newEmployee = {
            name: name,
            role: role,
            status: 'جاهز',
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabaseClient
            .from('ai_employees')
            .insert([newEmployee])
            .select()
            .single();

        if (error) throw error;

        localEmployees.push(data);

        renderEmployees();

        getElement('empName').value = '';
        getElement('empRole').value = '';

        showError('Employee saved successfully.');

    } catch (error) {
        console.error('Add employee error:', error);

        showError(
            'Employee was not saved: ' + error.message
        );
    }
}

// 10. DISPLAY EMPLOYEES SAFELY
function renderEmployees() {
    const list = getElement('employeesList');
    const statEl = getElement('statEmployees');

    if (statEl) {
        statEl.textContent = String(localEmployees.length);
    }

    if (!list) return;

    list.replaceChildren();

    localEmployees.forEach((emp, index) => {
        const li = document.createElement('li');

        li.style.padding = '12px';
        li.style.borderBottom = '1px solid var(--border-color)';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';

        const details = document.createElement('div');

        const name = document.createElement('strong');
        name.textContent = emp.name || 'Unnamed employee';

        const role = document.createElement('div');
        role.textContent = emp.role || 'No role assigned';
        role.style.color = 'var(--text-muted)';
        role.style.fontSize = '13px';

        details.append(name, role);

        const button = document.createElement('button');
        button.className = 'secondary';
        button.style.padding = '6px 12px';
        button.style.fontSize = '12px';
        button.textContent = 'اختبار الموظف';

        button.addEventListener('click', function () {
            testAIEmployee(index);
        });

        li.append(details, button);
        list.appendChild(li);
    });
}

// 11. TEST AI EMPLOYEE
function testAIEmployee(index) {
    const emp = localEmployees[index];

    if (!emp) return;

    alert(
        'الموظف: ' + (emp.name || '') +
        '\nالدور: ' + (emp.role || '') +
        '\nالحالة: ' + (emp.status || 'غير محددة') +
        '\n\nهذا اختبار للواجهة فقط، وليس تشغيلًا فعليًا للذكاء الاصطناعي.'
    );
}

// 12. ADD MARKET PRODUCT
// NOTE: This currently stores products in browser memory only.
// Database persistence will be added after the products table is verified.
function addProduct() {
    const title = getElement('productTitle')?.value.trim();
    const desc = getElement('productDesc')?.value.trim();
    const price = getElement('productPrice')?.value.trim();
    const statusEl = getElement('sellerStatus');

    if (!title || !price) {
        showError('Please enter the product name and price.');
        return;
    }

    const newProduct = {
        id: Date.now(),
        title: title,
        desc: desc,
        price: price + ' ₦',
        approved: false
    };

    localProducts.push(newProduct);

    setMessage(
        statusEl,
        'تم تسجيل المنتج مؤقتاً في المتصفح. لم يُحفظ في قاعدة البيانات.',
        'var(--success)'
    );

    getElement('productTitle').value = '';
    getElement('productDesc').value = '';
    getElement('productPrice').value = '';

    renderMarket();
}

// 13. DISPLAY APPROVED PRODUCTS
function renderMarket() {
    const query = (
        getElement('searchMarket')?.value || ''
    ).toLowerCase();

    const grid = getElement('marketGrid');

    if (!grid) return;

    grid.replaceChildren();

    const approvedProducts = localProducts.filter(product =>
        product.approved &&
        (product.title || '').toLowerCase().includes(query)
    );

    if (approvedProducts.length === 0) {
        const emptyMessage = document.createElement('p');

        emptyMessage.textContent =
            'لا توجد منتجات معتمدة حالياً.';

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

// 14. MARKET SEARCH
function initializeMarketSearch() {
    const search = getElement('searchMarket');

    if (search) {
        search.addEventListener('input', renderMarket);
    }
}

// 15. INITIALIZE APPLICATION
function initializeApp() {
    initializeMarketSearch();

    showSection('adminLoginSection');
}

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        initializeApp
    );
} else {
    initializeApp();
}

// 16. EXPOSE FUNCTIONS FOR HTML BUTTONS
window.showSection = showSection;
window.switchTab = switchTab;
window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.loadDashboardData = loadDashboardData;
window.addEmployee = addEmployee;
window.testAIEmployee = testAIEmployee;
window.addProduct = addProduct;
window.renderMarket = renderMarket;
