/* ============================================================
   BLOODCONNECT — app.js
   Main Website JavaScript
   Frontend: HTML + CSS + Vanilla JavaScript
   Backend: Supabase Auth + PostgreSQL
   Admin: Separate admin.html + admin.js
   ============================================================ */


/* ============================================================
   1. SUPABASE SETUP
   ============================================================ */

if (!window.SUPABASE_CONFIG) {
    console.error("Supabase configuration is missing.");
    alert("Supabase configuration is missing. Please check config.js.");
}

const supabaseClient = supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);


/* ============================================================
   2. GLOBAL STATE
   ============================================================ */

const state = {
    user: null,
    profile: null,
    donors: [],
    requests: [],
    loading: false
};


/* ============================================================
   3. BASIC HELPERS
   ============================================================ */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);

function getElement(id) {
    return document.getElementById(id);
}


/* ============================================================
   4. TOAST
   ============================================================ */

function showToast(message, type = "success") {

    let toast = getElement("toast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "toast";

        toast.className = "toast";

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


/* ============================================================
   5. LOADING BUTTON
   ============================================================ */

function setLoading(button, loading, text = "Loading...") {

    if (!button) return;

    if (loading) {

        button.dataset.originalText =
            button.innerHTML;

        button.disabled = true;

        button.innerHTML = `
            <span class="spinner"></span>
            ${text}
        `;

    } else {

        button.disabled = false;

        if (button.dataset.originalText) {

            button.innerHTML =
                button.dataset.originalText;
        }
    }
}


/* ============================================================
   6. MODALS
   ============================================================ */

function openModal(id) {

    const modal = getElement(id);

    if (!modal) {
        console.warn(`Modal #${id} not found.`);
        return;
    }

    modal.classList.add("active");
    modal.classList.add("show");

    document.body.classList.add("modal-open");
}


function closeModal(id) {

    const modal = getElement(id);

    if (!modal) return;

    modal.classList.remove("active");
    modal.classList.remove("show");

    document.body.classList.remove("modal-open");
}


function closeAllModals() {

    $$(".modal").forEach(modal => {

        modal.classList.remove("active");
        modal.classList.remove("show");

    });

    document.body.classList.remove("modal-open");
}


/* Close modal when clicking outside */

document.addEventListener("click", (event) => {

    if (event.target.classList.contains("modal")) {

        event.target.classList.remove("active");
        event.target.classList.remove("show");

        document.body.classList.remove("modal-open");
    }

});


/* ============================================================
   7. SESSION
   ============================================================ */

async function getSession() {

    const {
        data,
        error
    } = await supabaseClient.auth.getSession();

    if (error) {

        console.error(
            "Session error:",
            error
        );

        return null;
    }

    return data.session;
}


/* ============================================================
   8. PROFILE
   ============================================================ */

async function loadProfile(userId) {

    if (!userId) return null;

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    if (error) {

        console.error(
            "Profile error:",
            error
        );

        return null;
    }

    return data;
}


/* ============================================================
   9. LOGIN
   ============================================================ */

async function login(event) {

    event.preventDefault();

    const form = event.target;

    const email =
        form.querySelector(
            '[name="email"]'
        )?.value.trim();

    const password =
        form.querySelector(
            '[name="password"]'
        )?.value;


    if (!email || !password) {

        showToast(
            "Please enter email and password.",
            "error"
        );

        return;
    }


    const button =
        form.querySelector(
            'button[type="submit"]'
        );

    setLoading(
        button,
        true,
        "Signing in..."
    );


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.signInWithPassword({

                email: email,

                password: password

            });


        if (error) throw error;


        state.user =
            data.user;


        state.profile =
            await loadProfile(
                data.user.id
            );


        showToast(
            "Login successful!",
            "success"
        );


        closeAllModals();

        form.reset();

        renderNavigation();

        await refreshPublicData();


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Login failed.",
            "error"
        );

    } finally {

        setLoading(
            button,
            false
        );
    }
}


/* ============================================================
   10. SIGN UP
   ============================================================ */

async function signup(event) {

    event.preventDefault();

    const form = event.target;


    const fullName =
        form.querySelector(
            '[name="full_name"]'
        )?.value.trim();

    const email =
        form.querySelector(
            '[name="email"]'
        )?.value.trim();

    const password =
        form.querySelector(
            '[name="password"]'
        )?.value;

    const phone =
        form.querySelector(
            '[name="phone"]'
        )?.value.trim();

    const bloodGroup =
        form.querySelector(
            '[name="blood_group"]'
        )?.value;

    const location =
        form.querySelector(
            '[name="location"]'
        )?.value.trim();

    const role =
        form.querySelector(
            '[name="role"]'
        )?.value || "donor";


    if (
        !fullName ||
        !email ||
        !password
    ) {

        showToast(
            "Please fill all required fields.",
            "error"
        );

        return;
    }


    if (password.length < 6) {

        showToast(
            "Password must contain at least 6 characters.",
            "error"
        );

        return;
    }


    const button =
        form.querySelector(
            'button[type="submit"]'
        );

    setLoading(
        button,
        true,
        "Creating account..."
    );


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {

                    data: {

                        full_name:
                            fullName,

                        phone:
                            phone || null,

                        blood_group:
                            bloodGroup || null,

                        location:
                            location || null,

                        role:
                            role

                    }
                }

            });


        if (error) throw error;


        if (!data.user) {

            throw new Error(
                "Account could not be created."
            );
        }


        form.reset();

        closeAllModals();


        if (data.session) {

            state.user =
                data.user;

            state.profile =
                await loadProfile(
                    data.user.id
                );

            renderNavigation();

            showToast(
                "Account created successfully!",
                "success"
            );

        } else {

            showToast(
                "Account created. Please check your email and confirm your account.",
                "success"
            );
        }


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Unable to create account.",
            "error"
        );

    } finally {

        setLoading(
            button,
            false
        );
    }
}


/* ============================================================
   11. LOGOUT
   ============================================================ */

async function logout() {

    try {

        const {
            error
        } =
            await supabaseClient.auth.signOut();


        if (error) throw error;


        state.user = null;

        state.profile = null;


        renderNavigation();

        showToast(
            "You have been logged out.",
            "success"
        );


        await refreshPublicData();


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Logout failed.",
            "error"
        );
    }
}


/* ============================================================
   12. NAVIGATION
   ============================================================ */

function renderNavigation() {

    const loginBtn =
        getElement("loginBtn");

    const donorBtn =
        getElement("becomeDonorBtn");

    const dashboardBtn =
        getElement("dashboardBtn");

    const adminBtn =
        getElement("adminBtn");

    const logoutBtn =
        getElement("logoutBtn");


    if (!state.user) {

        if (loginBtn)
            loginBtn.style.display = "";

        if (donorBtn)
            donorBtn.style.display = "";

        if (dashboardBtn)
            dashboardBtn.style.display = "none";

        if (adminBtn)
            adminBtn.style.display = "none";

        if (logoutBtn)
            logoutBtn.style.display = "none";

        return;
    }


    if (loginBtn)
        loginBtn.style.display = "none";

    if (donorBtn)
        donorBtn.style.display = "none";

    if (dashboardBtn)
        dashboardBtn.style.display = "";

    if (logoutBtn)
        logoutBtn.style.display = "";


    if (
        adminBtn &&
        state.profile &&
        state.profile.role === "admin"
    ) {

        adminBtn.style.display = "";

    } else if (adminBtn) {

        adminBtn.style.display = "none";
    }
}


/* ============================================================
   13. ADMIN REDIRECT
   ============================================================ */

function openAdminDashboard() {

    if (!state.user) {

        showToast(
            "Please login first.",
            "error"
        );

        openModal("authModal");

        return;
    }


    if (
        !state.profile ||
        state.profile.role !== "admin"
    ) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;
    }


    window.location.href =
        "admin.html";
}


/* ============================================================
   14. DONOR SEARCH
   ============================================================ */

async function loadDonors() {

    const container =
        getElement("donorGrid") ||
        getElement("donorsContainer");


    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">
            <span class="spinner"></span>
            Finding available donors...
        </div>
    `;


    const bloodGroup =
        getElement(
            "searchBloodGroup"
        )?.value || "";


    const location =
        getElement(
            "searchLocation"
        )?.value.trim() || "";


    try {

        let query =
            supabaseClient
                .from("profiles")
                .select("*")
                .eq("role", "donor")
                .eq("is_available", true)
                .order("created_at", {
                    ascending: false
                });


        if (bloodGroup) {

            query =
                query.eq(
                    "blood_group",
                    bloodGroup
                );
        }


        if (location) {

            query =
                query.ilike(
                    "location",
                    `%${location}%`
                );
        }


        const {
            data,
            error
        } =
            await query;


        if (error) throw error;


        state.donors =
            data || [];


        renderDonors(
            state.donors
        );


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty-state">

                <h3>
                    Unable to load donors
                </h3>

                <p>
                    Please check your Supabase setup and try again.
                </p>

            </div>
        `;
    }
}


/* ============================================================
   15. RENDER DONORS
   ============================================================ */

function renderDonors(donors) {

    const container =
        getElement("donorGrid") ||
        getElement("donorsContainer");


    if (!container) return;


    if (!donors.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🩸
                </div>

                <h3>
                    No available donors found
                </h3>

                <p>
                    Try another blood group or location.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        donors.map(donor => {

            const name =
                escapeHTML(
                    donor.full_name ||
                    "Blood Donor"
                );

            const blood =
                escapeHTML(
                    donor.blood_group ||
                    "—"
                );

            const location =
                escapeHTML(
                    donor.location ||
                    "Location not provided"
                );


            return `

                <article class="donor-card">

                    <div class="donor-avatar">
                        ${getInitials(name)}
                    </div>


                    <div class="donor-info">

                        <h3>
                            ${name}
                        </h3>

                        <span class="blood-badge">
                            ${blood}
                        </span>

                        <p class="donor-location">
                            📍 ${location}
                        </p>

                        <span class="available-badge">
                            ● Available
                        </span>

                    </div>


                    <button
                        class="btn btn-primary"
                        onclick="contactDonor('${donor.id}')"
                    >
                        Contact
                    </button>

                </article>

            `;

        }).join("");
}


/* ============================================================
   16. CONTACT DONOR
   ============================================================ */

async function contactDonor(donorId) {

    if (!state.user) {

        showToast(
            "Please login to contact a donor.",
            "error"
        );

        openModal("authModal");

        return;
    }


    const donor =
        state.donors.find(
            item =>
                item.id === donorId
        );


    if (!donor) {

        showToast(
            "Donor not found.",
            "error"
        );

        return;
    }


    if (!donor.phone) {

        showToast(
            "This donor has not added a phone number.",
            "error"
        );

        return;
    }


    const confirmed =
        confirm(
            `Contact ${donor.full_name || "this donor"} at ${donor.phone}?`
        );


    if (!confirmed) return;


    window.location.href =
        `tel:${donor.phone.replace(
            /\s+/g,
            ""
        )}`;
}


/* ============================================================
   17. BLOOD REQUESTS
   ============================================================ */

async function loadRequests() {

    const container =
        getElement("requestGrid") ||
        getElement("requestsContainer");


    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">

            <span class="spinner"></span>

            Loading blood requests...

        </div>
    `;


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("blood_requests")
                .select("*")
                .eq("status", "verified")
                .order("created_at", {
                    ascending: false
                });


        if (error) throw error;


        state.requests =
            data || [];


        renderRequests(
            state.requests
        );


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty-state">

                <h3>
                    Unable to load requests
                </h3>

                <p>
                    Please try again later.
                </p>

            </div>
        `;
    }
}


/* ============================================================
   18. RENDER REQUESTS
   ============================================================ */

function renderRequests(requests) {

    const container =
        getElement("requestGrid") ||
        getElement("requestsContainer");


    if (!container) return;


    if (!requests.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    ❤️
                </div>

                <h3>
                    No verified blood requests
                </h3>

                <p>
                    There are currently no active verified requests.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        requests.map(request => {

            const patient =
                escapeHTML(
                    request.patient_name ||
                    "Patient"
                );

            const blood =
                escapeHTML(
                    request.blood_group ||
                    "—"
                );

            const hospital =
                escapeHTML(
                    request.hospital ||
                    "Hospital not provided"
                );

            const location =
                escapeHTML(
                    request.location ||
                    "Location not provided"
                );

            const units =
                Number(
                    request.units_required || 1
                );

            const priority =
                escapeHTML(
                    request.priority ||
                    "normal"
                );

            const date =
                request.required_date
                    ? formatDate(
                        request.required_date
                    )
                    : "As soon as possible";


            return `

                <article class="request-card">

                    <div class="request-header">

                        <span class="blood-badge large">
                            ${blood}
                        </span>

                        <span class="priority-badge ${priority}">
                            ${capitalize(priority)}
                        </span>

                    </div>


                    <h3>
                        Blood needed for ${patient}
                    </h3>


                    <div class="request-details">

                        <p>
                            🏥 ${hospital}
                        </p>

                        <p>
                            📍 ${location}
                        </p>

                        <p>
                            🩸 ${units}
                            unit${units !== 1 ? "s" : ""}
                        </p>

                        <p>
                            📅 ${date}
                        </p>

                    </div>


                    <button
                        class="btn btn-primary full-width"
                        onclick="respondToRequest('${request.id}')"
                    >
                        ${
                            state.user
                                ? "I Can Donate"
                                : "Login to Respond"
                        }
                    </button>

                </article>

            `;

        }).join("");
}


/* ============================================================
   19. OPEN REQUEST MODAL
   ============================================================ */

function openRequestModal() {

    if (!state.user) {

        showToast(
            "Please login to request blood.",
            "error"
        );

        openModal("authModal");

        return;
    }


    openModal(
        "requestModal"
    );
}


/* ============================================================
   20. SUBMIT BLOOD REQUEST
   ============================================================ */

async function submitBloodRequest(event) {

    event.preventDefault();


    if (!state.user) {

        showToast(
            "Please login first.",
            "error"
        );

        return;
    }


    const form =
        event.target;


    const patientName =
        form.querySelector(
            '[name="patient_name"]'
        )?.value.trim();


    const bloodGroup =
        form.querySelector(
            '[name="blood_group"]'
        )?.value;


    const units =
        Number(
            form.querySelector(
                '[name="units_required"]'
            )?.value || 1
        );


    const hospital =
        form.querySelector(
            '[name="hospital"]'
        )?.value.trim();


    const location =
        form.querySelector(
            '[name="location"]'
        )?.value.trim();


    const requiredDate =
        form.querySelector(
            '[name="required_date"]'
        )?.value || null;


    const priority =
        form.querySelector(
            '[name="priority"]'
        )?.value || "normal";


    const notes =
        form.querySelector(
            '[name="notes"]'
        )?.value.trim();


    if (
        !patientName ||
        !bloodGroup ||
        !hospital ||
        !location
    ) {

        showToast(
            "Please fill all required fields.",
            "error"
        );

        return;
    }


    if (
        !Number.isFinite(units) ||
        units <= 0
    ) {

        showToast(
            "Please enter a valid number of units.",
            "error"
        );

        return;
    }


    const button =
        form.querySelector(
            'button[type="submit"]'
        );


    setLoading(
        button,
        true,
        "Submitting..."
    );


    try {

        const {
            error
        } =
            await supabaseClient
                .from("blood_requests")
                .insert({

                    requester_id:
                        state.user.id,

                    patient_name:
                        patientName,

                    blood_group:
                        bloodGroup,

                    units_required:
                        units,

                    hospital:
                        hospital,

                    location:
                        location,

                    required_date:
                        requiredDate,

                    notes:
                        notes || null,

                    priority:
                        priority,

                    status:
                        "pending"

                });


        if (error) throw error;


        showToast(
            "Request submitted successfully. It is waiting for admin verification.",
            "success"
        );


        form.reset();

        closeModal(
            "requestModal"
        );


        /*
          Refresh request list.
        */

        await loadRequests();


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Unable to submit request.",
            "error"
        );

    } finally {

        setLoading(
            button,
            false
        );
    }
}


/* ============================================================
   21. DONOR RESPONSE
   ============================================================ */

async function respondToRequest(
    requestId
) {

    if (!state.user) {

        showToast(
            "Please login to respond to a blood request.",
            "error"
        );

        openModal(
            "authModal"
        );

        return;
    }


    if (
        !state.profile ||
        state.profile.role !== "donor"
    ) {

        showToast(
            "Only registered donors can respond to blood requests.",
            "error"
        );

        return;
    }


    try {

        const {
            error
        } =
            await supabaseClient
                .from("request_responses")
                .insert({

                    request_id:
                        requestId,

                    donor_id:
                        state.user.id,

                    status:
                        "interested"

                });


        if (error) {

            if (
                error.code ===
                "23505"
            ) {

                showToast(
                    "You have already responded to this request.",
                    "error"
                );

                return;
            }

            throw error;
        }


        showToast(
            "Thank you for volunteering! The request can now be followed up with you.",
            "success"
        );


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Unable to submit your response.",
            "error"
        );
    }
}


/* ============================================================
   22. DASHBOARD
   ============================================================ */

async function openDashboard() {

    if (!state.user) {

        showToast(
            "Please login first.",
            "error"
        );

        openModal(
            "authModal"
        );

        return;
    }


    openModal(
        "dashboardModal"
    );


    await loadDashboard();
}


/* ============================================================
   23. LOAD DASHBOARD
   ============================================================ */

async function loadDashboard() {

    const container =
        getElement(
            "dashboardContent"
        );


    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">

            <span class="spinner"></span>

            Loading dashboard...

        </div>
    `;


    try {

        state.profile =
            await loadProfile(
                state.user.id
            );


        const [
            donationsResult,
            requestsResult
        ] =
            await Promise.all([

                supabaseClient
                    .from("donations")
                    .select("*")
                    .eq(
                        "donor_id",
                        state.user.id
                    )
                    .order(
                        "donation_date",
                        {
                            ascending: false
                        }
                    ),

                supabaseClient
                    .from("blood_requests")
                    .select("*")
                    .eq(
                        "requester_id",
                        state.user.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    )

            ]);


        if (
            donationsResult.error
        ) {
            throw donationsResult.error;
        }


        if (
            requestsResult.error
        ) {
            throw requestsResult.error;
        }


        const donations =
            donationsResult.data || [];


        const requests =
            requestsResult.data || [];


        renderDashboard(
            state.profile,
            donations,
            requests
        );


    } catch (error) {

        console.error(error);

        container.innerHTML = `

            <div class="empty-state">

                <h3>
                    Unable to load dashboard
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;
    }
}


/* ============================================================
   24. RENDER DASHBOARD
   ============================================================ */

function renderDashboard(
    profile,
    donations,
    requests
) {

    const container =
        getElement(
            "dashboardContent"
        );


    if (!container) return;


    const totalUnits =
        donations.reduce(
            (total, donation) =>
                total +
                Number(
                    donation.units || 0
                ),
            0
        );


    container.innerHTML = `

        <div class="dashboard-header">

            <div>

                <h2>
                    Welcome,
                    ${escapeHTML(
                        profile?.full_name ||
                        "User"
                    )}
                </h2>

                <p>
                    Manage your BloodConnect account.
                </p>

            </div>

        </div>


        <div class="dashboard-stats">

            <div class="stat-card">

                <span>🩸</span>

                <strong>
                    ${donations.length}
                </strong>

                <small>
                    Donations
                </small>

            </div>


            <div class="stat-card">

                <span>❤️</span>

                <strong>
                    ${totalUnits}
                </strong>

                <small>
                    Units Donated
                </small>

            </div>


            <div class="stat-card">

                <span>📋</span>

                <strong>
                    ${requests.length}
                </strong>

                <small>
                    My Requests
                </small>

            </div>


            <div class="stat-card">

                <span>🟢</span>

                <strong>
                    ${
                        profile?.is_available
                            ? "YES"
                            : "NO"
                    }
                </strong>

                <small>
                    Available
                </small>

            </div>

        </div>


        ${
            profile?.role === "donor"
            ?
            `

            <div class="dashboard-section">

                <div class="section-header">

                    <div>

                        <h3>
                            Donor Availability
                        </h3>

                        <p>
                            Let people know whether you are currently available.
                        </p>

                    </div>


                    <label class="switch">

                        <input
                            type="checkbox"
                            id="availabilityToggle"
                            ${
                                profile.is_available
                                    ? "checked"
                                    : ""
                            }
                            onchange="toggleAvailability(this.checked)"
                        >

                        <span class="slider"></span>

                    </label>

                </div>

            </div>

            `
            :
            ""
        }


        ${
            profile?.role === "donor"
            ?
            `

            <div class="dashboard-section">

                <div class="section-header">

                    <div>

                        <h3>
                            Donation History
                        </h3>

                        <p>
                            Keep track of your previous donations.
                        </p>

                    </div>


                    <button
                        class="btn btn-primary"
                        onclick="addDonation()"
                    >
                        + Add Donation
                    </button>

                </div>


                ${
                    renderDonationHistory(
                        donations
                    )
                }

            </div>

            `
            :
            ""
        }


        <div class="dashboard-section">

            <div class="section-header">

                <div>

                    <h3>
                        My Blood Requests
                    </h3>

                    <p>
                        Track the requests submitted by you.
                    </p>

                </div>


                <button
                    class="btn btn-primary"
                    onclick="openRequestModal()"
                >
                    + Request Blood
                </button>

            </div>


            ${
                renderMyRequests(
                    requests
                )
            }

        </div>

    `;
}


/* ============================================================
   25. DONATION HISTORY
   ============================================================ */

function renderDonationHistory(
    donations
) {

    if (!donations.length) {

        return `

            <div class="empty-state compact">

                <p>
                    No donation history yet.
                </p>

            </div>

        `;
    }


    return `

        <div class="table-wrapper">

            <table>

                <thead>

                    <tr>

                        <th>
                            Date
                        </th>

                        <th>
                            Units
                        </th>

                        <th>
                            Notes
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${
                        donations.map(
                            donation => `

                            <tr>

                                <td>
                                    ${formatDate(
                                        donation.donation_date
                                    )}
                                </td>

                                <td>
                                    ${Number(
                                        donation.units || 1
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        donation.notes ||
                                        "—"
                                    )}
                                </td>

                            </tr>

                        `
                        ).join("")
                    }

                </tbody>

            </table>

        </div>

    `;
}


/* ============================================================
   26. MY REQUESTS
   ============================================================ */

function renderMyRequests(
    requests
) {

    if (!requests.length) {

        return `

            <div class="empty-state compact">

                <p>
                    You have not submitted any blood requests.
                </p>

            </div>

        `;
    }


    return `

        <div class="request-list">

            ${
                requests.map(
                    request => `

                    <div class="my-request-item">

                        <div>

                            <strong>
                                ${escapeHTML(
                                    request.patient_name ||
                                    "Patient"
                                )}
                            </strong>

                            <span class="blood-badge">
                                ${escapeHTML(
                                    request.blood_group ||
                                    "—"
                                )}
                            </span>

                            <p>
                                ${escapeHTML(
                                    request.hospital ||
                                    ""
                                )}
                            </p>

                        </div>


                        <div class="request-status">

                            <span class="status-badge ${
                                escapeHTML(
                                    request.status ||
                                    ""
                                )
                            }">

                                ${capitalize(
                                    request.status ||
                                    "unknown"
                                )}

                            </span>


                            <small>
                                ${formatDate(
                                    request.created_at
                                )}
                            </small>

                        </div>

                    </div>

                `
                ).join("")
            }

        </div>

    `;
}


/* ============================================================
   27. TOGGLE AVAILABILITY
   ============================================================ */

async function toggleAvailability(
    value
) {

    if (!state.user) return;


    try {

        const {
            error
        } =
            await supabaseClient
                .from("profiles")
                .update({
                    is_available:
                        Boolean(value)
                })
                .eq(
                    "id",
                    state.user.id
                );


        if (error) throw error;


        if (state.profile) {

            state.profile.is_available =
                Boolean(value);
        }


        showToast(
            value
                ? "You are now available for blood donation."
                : "You are now unavailable.",
            "success"
        );


        await loadDonors();


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Unable to update availability.",
            "error"
        );
    }
}


/* ============================================================
   28. ADD DONATION
   ============================================================ */

async function addDonation() {

    if (!state.user) {

        requireLogin();

        return;
    }


    const date =
        prompt(
            "Enter donation date (YYYY-MM-DD):"
        );


    if (!date) return;


    const parsedDate =
        new Date(date);


    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {

        showToast(
            "Please enter a valid date.",
            "error"
        );

        return;
    }


    const unitsInput =
        prompt(
            "How many units did you donate?",
            "1"
        );


    if (!unitsInput) return;


    const units =
        Number(unitsInput);


    if (
        !Number.isFinite(units) ||
        units <= 0
    ) {

        showToast(
            "Please enter a valid number of units.",
            "error"
        );

        return;
    }


    const notes =
        prompt(
            "Any notes? Optional."
        );


    try {

        const {
            error
        } =
            await supabaseClient
                .from("donations")
                .insert({

                    donor_id:
                        state.user.id,

                    donation_date:
                        date,

                    units:
                        units,

                    notes:
                        notes || null

                });


        if (error) throw error;


        showToast(
            "Donation added successfully.",
            "success"
        );


        await loadDashboard();


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Unable to add donation.",
            "error"
        );
    }
}


/* ============================================================
   29. LOGIN REQUIRED
   ============================================================ */

function requireLogin() {

    showToast(
        "Please login to continue.",
        "error"
    );

    openModal(
        "authModal"
    );
}


/* ============================================================
   30. REFRESH PUBLIC DATA
   ============================================================ */

async function refreshPublicData() {

    await Promise.all([
        loadDonors(),
        loadRequests()
    ]);
}


/* ============================================================
   31. SMOOTH SCROLL
   ============================================================ */

function scrollToSection(id) {

    const element =
        getElement(id);


    if (!element) return;


    element.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


/* ============================================================
   32. DATE FORMATTER
   ============================================================ */

function formatDate(date) {

    if (!date) return "—";


    const parsed =
        new Date(date);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return escapeHTML(
            date
        );
    }


    return parsed.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* ============================================================
   33. CAPITALIZE
   ============================================================ */

function capitalize(value) {

    if (!value) return "";


    const text =
        String(value);


    return (
        text.charAt(0).toUpperCase() +
        text.slice(1).toLowerCase()
    );
}


/* ============================================================
   34. INITIALS
   ============================================================ */

function getInitials(name) {

    if (!name) return "D";


    const words =
        String(name)
            .trim()
            .split(/\s+/)
            .slice(0, 2);


    return words
        .map(
            word =>
                word
                    .charAt(0)
                    .toUpperCase()
        )
        .join("");
}


/* ============================================================
   35. HTML ESCAPE
   ============================================================ */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* ============================================================
   36. FORM SETUP
   ============================================================ */

function setupForms() {

    const loginForm =
        getElement("loginForm");


    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            login
        );
    }


    const signupForm =
        getElement("signupForm");


    if (signupForm) {

        signupForm.addEventListener(
            "submit",
            signup
        );
    }


    const requestForm =
        getElement("requestForm");


    if (requestForm) {

        requestForm.addEventListener(
            "submit",
            submitBloodRequest
        );
    }
}


/* ============================================================
   37. BUTTON SETUP
   ============================================================ */

function setupButtons() {

    /*
      Search donors
    */

    const searchButton =
        getElement(
            "searchDonorsBtn"
        );


    if (searchButton) {

        searchButton.addEventListener(
            "click",
            loadDonors
        );
    }


    /*
      Login buttons
    */

    $$("[data-login]").forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    openModal(
                        "authModal"
                    );

                }
            );

        }
    );


    /*
      Dashboard buttons
    */

    $$("[data-dashboard]").forEach(
        button => {

            button.addEventListener(
                "click",
                openDashboard
            );

        }
    );


    /*
      Admin buttons
    */

    $$("[data-admin]").forEach(
        button => {

            button.addEventListener(
                "click",
                openAdminDashboard
            );

        }
    );


    /*
      Logout buttons
    */

    $$("[data-logout]").forEach(
        button => {

            button.addEventListener(
                "click",
                logout
            );

        }
    );


    /*
      Request blood
    */

    $$("[data-request-blood]").forEach(
        button => {

            button.addEventListener(
                "click",
                openRequestModal
            );

        }
    );


    /*
      Become donor
    */

    $$("[data-become-donor]").forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    openModal(
                        "authModal"
                    );


                    const signupTab =
                        getElement(
                            "signupTab"
                        );


                    if (signupTab) {

                        signupTab.click();
                    }

                }
            );

        }
    );
}


/* ============================================================
   38. AUTH STATE LISTENER
   ============================================================ */

function setupAuthListener() {

    supabaseClient.auth.onAuthStateChange(
        async (event, session) => {

            console.log(
                "Auth event:",
                event
            );


            state.user =
                session?.user ||
                null;


            if (state.user) {

                state.profile =
                    await loadProfile(
                        state.user.id
                    );

            } else {

                state.profile =
                    null;
            }


            renderNavigation();


            /*
              Refresh donor/request sections.
            */

            await refreshPublicData();

        }
    );
}


/* ============================================================
   39. INITIALIZE APP
   ============================================================ */

async function initializeApp() {

    try {

        const session =
            await getSession();


        state.user =
            session?.user ||
            null;


        if (state.user) {

            state.profile =
                await loadProfile(
                    state.user.id
                );
        }


        renderNavigation();


        await refreshPublicData();


        console.log(
            "🩸 BloodConnect initialized successfully."
        );


    } catch (error) {

        console.error(
            "BloodConnect initialization error:",
            error
        );
    }
}


/* ============================================================
   40. DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupForms();

        setupButtons();

        setupAuthListener();

        initializeApp();

    }
);


/* ============================================================
   41. GLOBAL FUNCTIONS
   Required for onclick="" in HTML
   ============================================================ */

window.openModal =
    openModal;

window.closeModal =
    closeModal;

window.closeAllModals =
    closeAllModals;

window.login =
    login;

window.signup =
    signup;

window.logout =
    logout;

window.openAdminDashboard =
    openAdminDashboard;

window.loadDonors =
    loadDonors;

window.loadRequests =
    loadRequests;

window.contactDonor =
    contactDonor;

window.openRequestModal =
    openRequestModal;

window.submitBloodRequest =
    submitBloodRequest;

window.respondToRequest =
    respondToRequest;

window.openDashboard =
    openDashboard;

window.loadDashboard =
    loadDashboard;

window.toggleAvailability =
    toggleAvailability;

window.addDonation =
    addDonation;

window.requireLogin =
    requireLogin;

window.scrollToSection =
    scrollToSection;


/* ============================================================
   END
   ============================================================ */