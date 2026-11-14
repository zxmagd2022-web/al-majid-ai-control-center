
// 19. INITIALIZE APPLICATION
async function initializeApp() {
    initializeMarketSearch();

    localEmployees = [];
    renderEmployees();

    // عرض شاشة الدخول مؤقتاً أثناء فحص الجلسة
    showSection('adminLoginSection');

    try {
        // استعادة جلسة Supabase المحفوظة
        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        const session = data?.session;

        // لا توجد جلسة محفوظة
        if (!session) {
            showSection('adminLoginSection');
            return;
        }

        // التحقق من صلاحية المدير
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

        // تحميل بيانات لوحة التحكم
        await loadDashboardData();

        // فتح لوحة التحكم
        showSection('dashboardSection');

    } catch (error) {
        console.error('Session restoration error:', error);

        localEmployees = [];
        renderEmployees();

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
