/* ============================================================
   BLOODCONNECT — admin.js
   Separate Admin Dashboard
   ============================================================ */


/* ============================================================
   1. SUPABASE
   ============================================================ */

const { createClient } = supabase;

const adminSupabase = createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);


/* ============================================================
   2. STATE
   ============================================================ */

const adminState = {
    user: null,
    profile: null,
    currentPage: "overview"
};


/* ============================================================
   3. DOM
   ============================================================ */

function adminElement(id) {
    return document.getElementById(id);
}


/* ============================================================
   4. TOAST
   ============================================================ */

function adminToast(message, type = "success") {

    const toast =
        adminElement("adminToast");

    if (!toast) return;

    toast.textContent = message;

    toast.className =
        "toast-admin show";

    if (type === "error") {
        toast.classList.add("error");
    }

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);
}


/* ============================================================
   5. ESCAPE HTML
   ============================================================ */

function escapeAdminHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");
}


/* ============================================================
   6. FORMAT DATE
   ============================================================ */

function adminDate(date) {

    if (!date) return "—";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return escapeAdminHTML(date);
    }

    return d.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* ============================================================
   7. CAPITALIZE
   ============================================================ */

function adminCap(value) {

    if (!value) return "";

    return String(value)
        .charAt(0)
        .toUpperCase() +
        String(value)
            .slice(1)
            .toLowerCase();
}


/* ============================================================
   8. GET SESSION
   ============================================================ */

async function getAdminSession() {

    const { data, error } =
        await adminSupabase.auth.getSession();

    if (error) {

        console.error(error);

        return null;
    }

    return data.session;
}


/* ============================================================
   9. LOAD PROFILE
   ============================================================ */

async function getAdminProfile(userId) {

    const { data, error } =
        await adminSupabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

    if (error) {

        console.error(error);

        return null;
    }

    return data;
}


/* ============================================================
   10. SECURITY CHECK
   ============================================================ */

async function checkAdminAccess() {

    const session =
        await getAdminSession();


    if (!session) {

        redirectToLogin(
            "Please login as an administrator."
        );

        return false;
    }


    adminState.user =
        session.user;


    adminState.profile =
        await getAdminProfile(
            session.user.id
        );


    if (
        !adminState.profile ||
        adminState.profile.role !== "admin"
    ) {

        adminToast(
            "You do not have admin access.",
            "error"
        );


        setTimeout(() => {

            window.location.href =
                "index.html";

        }, 1500);


        return false;
    }


    updateAdminUser();


    return true;
}


/* ============================================================
   11. REDIRECT TO LOGIN
   ============================================================ */

function redirectToLogin(message) {

    adminToast(
        message,
        "error"
    );


    setTimeout(() => {

        window.location.href =
            "index.html";

    }, 1200);
}


/* ============================================================
   12. ADMIN USER INFO
   ============================================================ */

function updateAdminUser() {

    const name =
        adminElement("adminName");

    const email =
        adminElement("adminEmail");


    if (name) {

        name.textContent =
            adminState.profile?.full_name ||
            "Administrator";
    }


    if (email) {

        email.textContent =
            adminState.user?.email ||
            "";
    }
}


/* ============================================================
   13. SWITCH ADMIN PAGE
   ============================================================ */

async function switchAdminPage(
    page,
    button
) {

    adminState.currentPage =
        page;


    document
        .querySelectorAll(".admin-nav button")
        .forEach(btn => {

            btn.classList.remove("active");

        });


    if (button) {

        button.classList.add("active");
    }


    updatePageHeading(page);


    /*
      Close mobile sidebar.
    */

    const sidebar =
        adminElement("adminSidebar");

    if (sidebar) {

        sidebar.classList.remove(
            "mobile-open"
        );
    }


    await loadAdminPage(page);
}


/* ============================================================
   14. PAGE HEADING
   ============================================================ */

function updatePageHeading(page) {

    const title =
        adminElement("adminPageTitle");

    const subtitle =
        adminElement("adminPageSubtitle");


    const headings = {

        overview: [
            "Dashboard",
            "Monitor BloodConnect activity and manage requests."
        ],

        pending: [
            "Pending Requests",
            "Review and verify new blood requests."
        ],

        requests: [
            "All Requests",
            "View and manage every blood request."
        ],

        donors: [
            "Donors",
            "View registered blood donors and their availability."
        ],

        responses: [
            "Donor Responses",
            "See donors who volunteered for blood requests."
        ]

    };


    const data =
        headings[page] ||
        headings.overview;


    if (title)
        title.textContent = data[0];


    if (subtitle)
        subtitle.textContent = data[1];
}


/* ============================================================
   15. LOAD PAGE
   ============================================================ */

async function loadAdminPage(page) {

    const container =
        adminElement("adminPageContent");

    if (!container) return;


    container.innerHTML = `
        <div class="loading-admin">
            <span class="spinner-admin"></span>
            Loading...
        </div>
    `;


    try {

        if (page === "overview") {

            await renderOverview();

        }

        else if (page === "pending") {

            await renderPending();

        }

        else if (page === "requests") {

            await renderRequests();

        }

        else if (page === "donors") {

            await renderDonors();

        }

        else if (page === "responses") {

            await renderResponses();

        }

    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty-admin">

                <div class="empty-admin-icon">
                    ⚠️
                </div>

                <h3>
                    Something went wrong
                </h3>

                <p>
                    ${escapeAdminHTML(error.message)}
                </p>

            </div>
        `;
    }
}


/* ============================================================
   16. OVERVIEW
   ============================================================ */

async function renderOverview() {

    const container =
        adminElement("adminPageContent");


    const [
        donors,
        availableDonors,
        requests,
        pending,
        verified,
        responses
    ] = await Promise.all([

        adminSupabase
            .from("profiles")
            .select("id", {
                count: "exact",
                head: true
            })
            .eq("role", "donor"),

        adminSupabase
            .from("profiles")
            .select("id", {
                count: "exact",
                head: true
            })
            .eq("role", "donor")
            .eq("is_available", true),

        adminSupabase
            .from("blood_requests")
            .select("id", {
                count: "exact",
                head: true
            }),

        adminSupabase
            .from("blood_requests")
            .select("id", {
                count: "exact",
                head: true
            })
            .eq("status", "pending"),

        adminSupabase
            .from("blood_requests")
            .select("id", {
                count: "exact",
                head: true
            })
            .eq("status", "verified"),

        adminSupabase
            .from("request_responses")
            .select("id", {
                count: "exact",
                head: true
            })

    ]);


    const stats = {

        donors:
            donors.count || 0,

        available:
            availableDonors.count || 0,

        requests:
            requests.count || 0,

        pending:
            pending.count || 0,

        verified:
            verified.count || 0,

        responses:
            responses.count || 0

    };


    container.innerHTML = `

        <div class="admin-stat-grid">

            <div class="admin-stat-card">

                <div class="admin-stat-top">

                    <div class="admin-stat-icon">
                        🩸
                    </div>

                </div>

                <strong>
                    ${stats.donors}
                </strong>

                <span>
                    Registered Donors
                </span>

            </div>


            <div class="admin-stat-card">

                <div class="admin-stat-top">

                    <div class="admin-stat-icon">
                        🟢
                    </div>

                </div>

                <strong>
                    ${stats.available}
                </strong>

                <span>
                    Available Donors
                </span>

            </div>


            <div class="admin-stat-card">

                <div class="admin-stat-top">

                    <div class="admin-stat-icon">
                        📋
                    </div>

                </div>

                <strong>
                    ${stats.requests}
                </strong>

                <span>
                    Total Requests
                </span>

            </div>


            <div class="admin-stat-card">

                <div class="admin-stat-top">

                    <div class="admin-stat-icon">
                        ⏳
                    </div>

                </div>

                <strong>
                    ${stats.pending}
                </strong>

                <span>
                    Pending Verification
                </span>

            </div>


            <div class="admin-stat-card">

                <div class="admin-stat-top">

                    <div class="admin-stat-icon">
                        ✓
                    </div>

                </div>

                <strong>
                    ${stats.verified}
                </strong>

                <span>
                    Verified Requests
                </span>

            </div>


            <div class="admin-stat-card">

                <div class="admin-stat-top">

                    <div class="admin-stat-icon">
                        ❤️
                    </div>

                </div>

                <strong>
                    ${stats.responses}
                </strong>

                <span>
                    Donor Responses
                </span>

            </div>

        </div>


        <div class="admin-panel">

            <div class="admin-panel-header">

                <div>

                    <h3>
                        Quick Actions
                    </h3>

                    <p>
                        Manage the most important BloodConnect activities.
                    </p>

                </div>

            </div>


            <div style="
                padding:22px;
                display:flex;
                gap:12px;
                flex-wrap:wrap;
            ">

                <button
                    class="btn btn-primary"
                    onclick="goToAdminPage('pending')"
                >
                    Review Pending Requests
                </button>


                <button
                    class="btn btn-secondary"
                    onclick="goToAdminPage('donors')"
                >
                    View Donors
                </button>


                <button
                    class="btn btn-secondary"
                    onclick="goToAdminPage('responses')"
                >
                    View Donor Responses
                </button>

            </div>

        </div>

    `;
}


/* ============================================================
   17. PENDING REQUESTS
   ============================================================ */

async function renderPending() {

    const container =
        adminElement("adminPageContent");


    const { data, error } =
        await adminSupabase
            .from("blood_requests")
            .select("*")
            .eq("status", "pending")
            .order("created_at", {
                ascending: true
            });


    if (error) throw error;


    if (!data?.length) {

        container.innerHTML = `

            <div class="admin-panel">

                <div class="empty-admin">

                    <div class="empty-admin-icon">
                        ✓
                    </div>

                    <h3>
                        No pending requests
                    </h3>

                    <p>
                        All blood requests have been reviewed.
                    </p>

                </div>

            </div>

        `;

        return;
    }


    container.innerHTML = `

        <div class="admin-panel">

            <div class="admin-panel-header">

                <div>

                    <h3>
                        Requests Waiting for Verification
                    </h3>

                    <p>
                        Verify genuine requests before making them visible to donors.
                    </p>

                </div>

            </div>


            <div class="admin-table-wrap">

                <table class="admin-table">

                    <thead>

                        <tr>

                            <th>Patient</th>

                            <th>Blood</th>

                            <th>Units</th>

                            <th>Hospital</th>

                            <th>Location</th>

                            <th>Priority</th>

                            <th>Date</th>

                            <th>Action</th>

                        </tr>

                    </thead>


                    <tbody>

                        ${data.map(request => `

                            <tr>

                                <td>
                                    <strong>
                                        ${escapeAdminHTML(
                                            request.patient_name
                                        )}
                                    </strong>
                                </td>

                                <td>
                                    <span class="blood-group">
                                        ${escapeAdminHTML(
                                            request.blood_group
                                        )}
                                    </span>
                                </td>

                                <td>
                                    ${request.units_required}
                                </td>

                                <td>
                                    ${escapeAdminHTML(
                                        request.hospital
                                    )}
                                </td>

                                <td>
                                    ${escapeAdminHTML(
                                        request.location
                                    )}
                                </td>

                                <td>
                                    ${adminCap(
                                        request.priority
                                    )}
                                </td>

                                <td>
                                    ${request.required_date
                                        ? adminDate(
                                            request.required_date
                                        )
                                        : "—"
                                    }
                                </td>

                                <td>

                                    <div class="admin-actions">

                                        <button
                                            class="admin-btn verify"
                                            onclick="verifyAdminRequest('${request.id}')"
                                        >
                                            ✓ Verify
                                        </button>

                                        <button
                                            class="admin-btn reject"
                                            onclick="rejectAdminRequest('${request.id}')"
                                        >
                                            ✕ Reject
                                        </button>

                                    </div>

                                </td>

                            </tr>

                        `).join("")}

                    </tbody>

                </table>

            </div>

        </div>

    `;
}


/* ============================================================
   18. ALL REQUESTS
   ============================================================ */

async function renderRequests() {

    const container =
        adminElement("adminPageContent");


    const { data, error } =
        await adminSupabase
            .from("blood_requests")
            .select("*")
            .order("created_at", {
                ascending: false
            });


    if (error) throw error;


    if (!data?.length) {

        container.innerHTML = `

            <div class="admin-panel">

                <div class="empty-admin">

                    <div class="empty-admin-icon">
                        📋
                    </div>

                    <h3>
                        No requests found
                    </h3>

                    <p>
                        Blood requests will appear here.
                    </p>

                </div>

            </div>

        `;

        return;
    }


    container.innerHTML = `

        <div class="admin-panel">

            <div class="admin-panel-header">

                <div>

                    <h3>
                        All Blood Requests
                    </h3>

                    <p>
                        Complete request history.
                    </p>

                </div>

            </div>


            <div class="admin-table-wrap">

                <table class="admin-table">

                    <thead>

                        <tr>

                            <th>Patient</th>

                            <th>Blood</th>

                            <th>Units</th>

                            <th>Hospital</th>

                            <th>Priority</th>

                            <th>Status</th>

                            <th>Created</th>

                            <th>Action</th>

                        </tr>

                    </thead>


                    <tbody>

                        ${data.map(request => `

                            <tr>

                                <td>
                                    ${escapeAdminHTML(
                                        request.patient_name
                                    )}
                                </td>

                                <td>

                                    <span class="blood-group">
                                        ${escapeAdminHTML(
                                            request.blood_group
                                        )}
                                    </span>

                                </td>

                                <td>
                                    ${request.units_required}
                                </td>

                                <td>
                                    ${escapeAdminHTML(
                                        request.hospital
                                    )}
                                </td>

                                <td>
                                    ${adminCap(
                                        request.priority
                                    )}
                                </td>

                                <td>

                                    <span class="status ${escapeAdminHTML(
                                        request.status
                                    )}">
                                        ${adminCap(
                                            request.status
                                        )}
                                    </span>

                                </td>

                                <td>
                                    ${adminDate(
                                        request.created_at
                                    )}
                                </td>

                                <td>

                                    <div class="admin-actions">

                                        ${
                                            request.status === "pending"
                                            ?
                                            `
                                            <button
                                                class="admin-btn verify"
                                                onclick="verifyAdminRequest('${request.id}')"
                                            >
                                                Verify
                                            </button>

                                            <button
                                                class="admin-btn reject"
                                                onclick="rejectAdminRequest('${request.id}')"
                                            >
                                                Reject
                                            </button>
                                            `
                                            :
                                            request.status === "verified"
                                            ?
                                            `
                                            <button
                                                class="admin-btn cancel"
                                                onclick="cancelAdminRequest('${request.id}')"
                                            >
                                                Cancel
                                            </button>
                                            `
                                            :
                                            "—"
                                        }

                                    </div>

                                </td>

                            </tr>

                        `).join("")}

                    </tbody>

                </table>

            </div>

        </div>

    `;
}


/* ============================================================
   19. DONORS
   ============================================================ */

async function renderDonors() {

    const container =
        adminElement("adminPageContent");


    const { data, error } =
        await adminSupabase
            .from("profiles")
            .select("*")
            .eq("role", "donor")
            .order("created_at", {
                ascending: false
            });


    if (error) throw error;


    if (!data?.length) {

        container.innerHTML = `

            <div class="admin-panel">

                <div class="empty-admin">

                    <div class="empty-admin-icon">
                        🩸
                    </div>

                    <h3>
                        No donors registered
                    </h3>

                </div>

            </div>

        `;

        return;
    }


    container.innerHTML = `

        <div class="admin-panel">

            <div class="admin-panel-header">

                <div>

                    <h3>
                        Registered Donors
                    </h3>

                    <p>
                        Donor information and current availability.
                    </p>

                </div>

            </div>


            <div class="admin-table-wrap">

                <table class="admin-table">

                    <thead>

                        <tr>

                            <th>Name</th>

                            <th>Blood Group</th>

                            <th>Phone</th>

                            <th>Location</th>

                            <th>Availability</th>

                            <th>Joined</th>

                        </tr>

                    </thead>


                    <tbody>

                        ${data.map(donor => `

                            <tr>

                                <td>
                                    <strong>
                                        ${escapeAdminHTML(
                                            donor.full_name || "—"
                                        )}
                                    </strong>
                                </td>

                                <td>

                                    <span class="blood-group">
                                        ${escapeAdminHTML(
                                            donor.blood_group || "—"
                                        )}
                                    </span>

                                </td>

                                <td>
                                    ${escapeAdminHTML(
                                        donor.phone || "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeAdminHTML(
                                        donor.location || "—"
                                    )}
                                </td>

                                <td>

                                    ${
                                        donor.is_available
                                        ?
                                        `
                                        <span class="status available">
                                            Available
                                        </span>
                                        `
                                        :
                                        `
                                        <span class="status unavailable">
                                            Unavailable
                                        </span>
                                        `
                                    }

                                </td>

                                <td>
                                    ${adminDate(
                                        donor.created_at
                                    )}
                                </td>

                            </tr>

                        `).join("")}

                    </tbody>

                </table>

            </div>

        </div>

    `;
}


/* ============================================================
   20. DONOR RESPONSES
   ============================================================ */

async function renderResponses() {

    const container =
        adminElement("adminPageContent");


    const { data, error } =
        await adminSupabase
            .from("request_responses")
            .select(`
                *,
                profiles:donor_id (
                    full_name,
                    blood_group,
                    phone,
                    location
                ),
                blood_requests:request_id (
                    patient_name,
                    blood_group,
                    hospital,
                    status
                )
            `)
            .order("created_at", {
                ascending: false
            });


    if (error) throw error;


    if (!data?.length) {

        container.innerHTML = `

            <div class="admin-panel">

                <div class="empty-admin">

                    <div class="empty-admin-icon">
                        ❤️
                    </div>

                    <h3>
                        No donor responses
                    </h3>

                    <p>
                        Donor responses will appear here.
                    </p>

                </div>

            </div>

        `;

        return;
    }


    container.innerHTML = `

        <div class="admin-panel">

            <div class="admin-panel-header">

                <div>

                    <h3>
                        Donor Responses
                    </h3>

                    <p>
                        Donors who volunteered to help with blood requests.
                    </p>

                </div>

            </div>


            <div class="admin-table-wrap">

                <table class="admin-table">

                    <thead>

                        <tr>

                            <th>Donor</th>

                            <th>Blood</th>

                            <th>Phone</th>

                            <th>Location</th>

                            <th>Patient</th>

                            <th>Hospital</th>

                            <th>Request Status</th>

                            <th>Response</th>

                        </tr>

                    </thead>


                    <tbody>

                        ${data.map(response => {

                            const donor =
                                response.profiles || {};

                            const request =
                                response.blood_requests || {};


                            return `

                                <tr>

                                    <td>

                                        <strong>
                                            ${escapeAdminHTML(
                                                donor.full_name || "—"
                                            )}
                                        </strong>

                                    </td>

                                    <td>

                                        <span class="blood-group">
                                            ${escapeAdminHTML(
                                                donor.blood_group || "—"
                                            )}
                                        </span>

                                    </td>

                                    <td>
                                        ${escapeAdminHTML(
                                            donor.phone || "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeAdminHTML(
                                            donor.location || "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeAdminHTML(
                                            request.patient_name || "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeAdminHTML(
                                            request.hospital || "—"
                                        )}
                                    </td>

                                    <td>

                                        <span class="status ${
                                            escapeAdminHTML(
                                                request.status || ""
                                            )
                                        }">

                                            ${adminCap(
                                                request.status || "unknown"
                                            )}

                                        </span>

                                    </td>

                                    <td>

                                        <span class="status">
                                            ${adminCap(
                                                response.status || "interested"
                                            )}
                                        </span>

                                    </td>

                                </tr>

                            `;

                        }).join("")}

                    </tbody>

                </table>

            </div>

        </div>

    `;
}


/* ============================================================
   21. VERIFY REQUEST
   ============================================================ */

async function verifyAdminRequest(id) {

    const confirmed =
        confirm(
            "Are you sure you want to verify this blood request?"
        );


    if (!confirmed) return;


    try {

        const { error } =
            await adminSupabase
                .from("blood_requests")
                .update({
                    status: "verified"
                })
                .eq("id", id);


        if (error) throw error;


        adminToast(
            "Blood request verified successfully."
        );


        await loadAdminPage(
            adminState.currentPage
        );


    } catch (error) {

        console.error(error);

        adminToast(
            error.message ||
            "Unable to verify request.",
            "error"
        );
    }
}


/* ============================================================
   22. REJECT REQUEST
   ============================================================ */

async function rejectAdminRequest(id) {

    const confirmed =
        confirm(
            "Are you sure you want to reject this blood request?"
        );


    if (!confirmed) return;


    try {

        const { error } =
            await adminSupabase
                .from("blood_requests")
                .update({
                    status: "rejected"
                })
                .eq("id", id);


        if (error) throw error;


        adminToast(
            "Blood request rejected."
        );


        await loadAdminPage(
            adminState.currentPage
        );


    } catch (error) {

        console.error(error);

        adminToast(
            error.message ||
            "Unable to reject request.",
            "error"
        );
    }
}


/* ============================================================
   23. CANCEL REQUEST
   ============================================================ */

async function cancelAdminRequest(id) {

    const confirmed =
        confirm(
            "Are you sure you want to cancel this request?"
        );


    if (!confirmed) return;


    try {

        const { error } =
            await adminSupabase
                .from("blood_requests")
                .update({
                    status: "cancelled"
                })
                .eq("id", id);


        if (error) throw error;


        adminToast(
            "Request cancelled."
        );


        await loadAdminPage(
            adminState.currentPage
        );


    } catch (error) {

        console.error(error);

        adminToast(
            error.message ||
            "Unable to cancel request.",
            "error"
        );
    }
}


/* ============================================================
   24. QUICK NAVIGATION
   ============================================================ */

function goToAdminPage(page) {

    const button =
        document.querySelector(
            `.admin-nav button[data-tab="${page}"]`
        );


    switchAdminPage(
        page,
        button
    );
}


/* ============================================================
   25. MOBILE SIDEBAR
   ============================================================ */

function toggleAdminSidebar() {

    const sidebar =
        adminElement("adminSidebar");

    if (!sidebar) return;

    sidebar.classList.toggle(
        "mobile-open"
    );
}


/* ============================================================
   26. LOGOUT
   ============================================================ */

async function adminLogout() {

    const confirmed =
        confirm(
            "Do you want to logout?"
        );


    if (!confirmed) return;


    const { error } =
        await adminSupabase.auth.signOut();


    if (error) {

        adminToast(
            error.message ||
            "Logout failed.",
            "error"
        );

        return;
    }


    window.location.href =
        "index.html";
}


/* ============================================================
   27. AUTH STATE
   ============================================================ */

adminSupabase.auth.onAuthStateChange(
    async (event, session) => {

        if (!session) {

            return;
        }

        adminState.user =
            session.user;

    }
);


/* ============================================================
   28. INITIALIZE
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const hasAccess =
            await checkAdminAccess();


        if (!hasAccess) return;


        await loadAdminPage(
            "overview"
        );

    }
);


/* ============================================================
   29. GLOBAL FUNCTIONS
   ============================================================ */

window.switchAdminPage =
    switchAdminPage;

window.verifyAdminRequest =
    verifyAdminRequest;

window.rejectAdminRequest =
    rejectAdminRequest;

window.cancelAdminRequest =
    cancelAdminRequest;

window.goToAdminPage =
    goToAdminPage;

window.toggleAdminSidebar =
    toggleAdminSidebar;

window.adminLogout =
    adminLogout;


/* ============================================================
   ADMIN READY
   ============================================================ */

console.log(
    "🩸 BloodConnect Admin Dashboard loaded."
);