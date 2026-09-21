/* ============================================================
   BLOODCONNECT — app.js
   Blood Donation Network
   Frontend: HTML + CSS + Vanilla JavaScript
   Backend: Supabase Auth + PostgreSQL
   ============================================================ */


/* ============================================================
   1. SUPABASE SETUP
   ============================================================ */

const { createClient } = supabase;

if (!window.SUPABASE_CONFIG) {
    console.error("SUPABASE_CONFIG is missing.");
    alert("Supabase configuration is missing. Please check config.js.");
}

const supabaseClient = createClient(
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
    currentAdminTab: "pending",
    loading: false
};


/* ============================================================
   3. DOM HELPERS
   ============================================================ */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);

function getElement(id) {
    return document.getElementById(id);
}


/* ============================================================
   4. TOAST / ALERT SYSTEM
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
   5. LOADING
   ============================================================ */

function setLoading(button, loading, text = "Loading...") {

    if (!button) return;

    if (loading) {

        button.dataset.originalText = button.innerHTML;

        button.disabled = true;

        button.innerHTML = `
            <span class="spinner"></span>
            ${text}
        `;

    } else {

        button.disabled = false;

        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }
    }
}


/* ============================================================
   6. MODAL FUNCTIONS
   ============================================================ */

function openModal(id) {

    const modal = getElement(id);

    if (!modal) return;

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


/* Close modal when clicking outside */

document.addEventListener("click", function (event) {

    if (event.target.classList.contains("modal")) {

        event.target.classList.remove("active");
        event.target.classList.remove("show");

        document.body.classList.remove("modal-open");
    }

});


/* ============================================================
   7. AUTHENTICATION
   ============================================================ */

async function getSession() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {

        console.error(error);

        return null;
    }

    return data.session;
}


/* ============================================================
   LOAD USER PROFILE
   ============================================================ */

async function loadProfile(userId) {

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    if (error) {

        console.error("Profile error:", error);

        return null;
    }

    return data;
}


/* ============================================================
   SIGN UP
   ============================================================ */

async function signup(event) {

    event.preventDefault();

    const form = event.target;

    const fullName =
        form.querySelector('[name="full_name"]')?.value.trim();

    const email =
        form.querySelector('[name="email"]')?.value.trim();

    const password =
        form.querySelector('[name="password"]')?.value;

    const phone =
        form.querySelector('[name="phone"]')?.value.trim();

    const bloodGroup =
        form.querySelector('[name="blood_group"]')?.value;

    const location =
        form.querySelector('[name="location"]')?.value.trim();

    const role =
        form.querySelector('[name="role"]')?.value || "donor";


    if (!fullName || !email || !password) {

        showToast("Please fill all required fields.", "error");

        return;
    }


    if (password.length < 6) {

        showToast(
            "Password must be at least 6 characters.",
            "error"
        );

        return;
    }


    const button =
        form.querySelector('button[type="submit"]');

    setLoading(button, true, "Creating account...");


    try {

        const { data, error } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {

                    data: {

                        full_name: fullName,

                        phone: phone,

                        blood_group: bloodGroup,

                        location: location,

                        role: role || "donor"

                    }
                }
            });


        if (error) throw error;


        if (data.user) {

            showToast(
                "Account created successfully!",
                "success"
            );

            closeAllModals();

            form.reset();

            /*
             Supabase may require email confirmation.
            */

            if (!data.session) {

                showToast(
                    "Please check your email to confirm your account.",
                    "success"
                );
            }
        }


    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Unable to create account.",
            "error"
        );

    } finally {

        setLoading(button, false);
    }
}


/* ============================================================
   LOGIN
   ============================================================ */

async function login(event) {

    event.preventDefault();

    const form = event.target;

    const email =
        form.querySelector('[name="email"]')?.value.trim();

    const password =
        form.querySelector('[name="password"]')?.value;


    if (!email || !password) {

        showToast(
            "Enter your email and password.",
            "error"
        );

        return;
    }


    const button =
        form.querySelector('button[type="submit"]');

    setLoading(button, true, "Signing in...");


    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({

                email,

                password

            });


        if (error) throw error;


        state.user = data.user;

        state.profile =
            await loadProfile(data.user.id);


        showToast(
            "Welcome back!",
            "success"
        );


        closeAllModals();

        form.reset();

        renderNavigation();


    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Login failed.",
            "error"
        );

    } finally {

        setLoading(button, false);
    }
}


/* ============================================================
   LOGOUT
   ============================================================ */

async function logout() {

    const { error } =
        await supabaseClient.auth.signOut();


    if (error) {

        showToast(
            error.message || "Logout failed.",
            "error"
        );

        return;
    }


    state.user = null;

    state.profile = null;


    showToast(
        "You have been logged out.",
        "success"
    );


    renderNavigation();

    closeAllModals();
}


/* ============================================================
   CLOSE ALL MODALS
   ============================================================ */

function closeAllModals() {

    $$(".modal").forEach(modal => {

        modal.classList.remove("active");
        modal.classList.remove("show");

    });

    document.body.classList.remove("modal-open");
}


/* ============================================================
   8. NAVIGATION
   ============================================================ */

function renderNavigation() {

    const loginButton =
        getElement("loginBtn");

    const donorButton =
        getElement("becomeDonorBtn");

    const dashboardButton =
        getElement("dashboardBtn");

    const adminButton =
        getElement("adminBtn");

    const logoutButton =
        getElement("logoutBtn");


    if (!state.user) {

        if (loginButton)
            loginButton.style.display = "";

        if (donorButton)
            donorButton.style.display = "";

        if (dashboardButton)
            dashboardButton.style.display = "none";

        if (adminButton)
            adminButton.style.display = "none";

        if (logoutButton)
            logoutButton.style.display = "none";

        return;
    }


    if (loginButton)
        loginButton.style.display = "none";

    if (donorButton)
        donorButton.style.display = "none";

    if (dashboardButton)
        dashboardButton.style.display = "";

    if (logoutButton)
        logoutButton.style.display = "";


    if (
        adminButton &&
        state.profile &&
        state.profile.role === "admin"
    ) {

        adminButton.style.display = "";

    } else if (adminButton) {

        adminButton.style.display = "none";
    }
}


/* ============================================================
   9. DONOR SEARCH
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
        getElement("searchBloodGroup")?.value || "";

    const location =
        getElement("searchLocation")?.value.trim() || "";


    try {

        let query = supabaseClient
            .from("profiles")
            .select("*")
            .eq("role", "donor")
            .eq("is_available", true)
            .order("created_at", {
                ascending: false
            });


        if (bloodGroup) {

            query =
                query.eq("blood_group", bloodGroup);
        }


        if (location) {

            query =
                query.ilike(
                    "location",
                    `%${location}%`
                );
        }


        const { data, error } =
            await query;


        if (error) throw error;


        state.donors = data || [];


        renderDonors(state.donors);


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load donors</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}


/* ============================================================
   RENDER DONORS
   ============================================================ */

function renderDonors(donors) {

    const container =
        getElement("donorGrid") ||
        getElement("donorsContainer");

    if (!container) return;


    if (!donors.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🩸</div>

                <h3>No available donors found</h3>

                <p>
                    Try another blood group or location.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML = donors.map(donor => {

        const name =
            escapeHTML(
                donor.full_name || "Anonymous Donor"
            );

        const blood =
            escapeHTML(
                donor.blood_group || "—"
            );

        const location =
            escapeHTML(
                donor.location || "Location not provided"
            );


        return `

            <article class="donor-card">

                <div class="donor-avatar">
                    ${getInitials(name)}
                </div>

                <div class="donor-info">

                    <h3>${name}</h3>

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
   DONOR CONTACT
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
            item => item.id === donorId
        );


    if (!donor) {

        showToast(
            "Donor information not found.",
            "error"
        );

        return;
    }


    const phone =
        donor.phone;


    if (!phone) {

        showToast(
            "This donor has not provided a phone number.",
            "error"
        );

        return;
    }


    const cleanPhone =
        phone.replace(/\s+/g, "");


    const confirmed =
        confirm(
            `Contact ${donor.full_name || "this donor"} at ${phone}?`
        );


    if (confirmed) {

        window.location.href =
            `tel:${cleanPhone}`;
    }
}


/* ============================================================
   10. BLOOD REQUESTS
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

        const { data, error } =
            await supabaseClient
                .from("blood_requests")
                .select("*")
                .eq("status", "verified")
                .order("priority", {
                    ascending: false
                })
                .order("required_date", {
                    ascending: true
                });


        if (error) throw error;


        state.requests = data || [];


        renderRequests(state.requests);


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load requests</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}


/* ============================================================
   RENDER REQUESTS
   ============================================================ */

function renderRequests(requests) {

    const container =
        getElement("requestGrid") ||
        getElement("requestsContainer");

    if (!container) return;


    if (!requests.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">❤️</div>

                <h3>No verified blood requests</h3>

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
                    request.patient_name || "Patient"
                );

            const hospital =
                escapeHTML(
                    request.hospital || "Hospital not provided"
                );

            const location =
                escapeHTML(
                    request.location || "Location not provided"
                );

            const blood =
                escapeHTML(
                    request.blood_group || "—"
                );

            const units =
                request.units_required || 1;

            const priority =
                escapeHTML(
                    request.priority || "normal"
                );

            const date =
                request.required_date
                    ? formatDate(request.required_date)
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
                            🩸 ${units} unit${units > 1 ? "s" : ""}
                        </p>

                        <p>
                            📅 ${date}
                        </p>

                    </div>


                    ${
                        state.user &&
                        state.profile &&
                        state.profile.role === "donor"
                        ?
                        `
                        <button
                            class="btn btn-primary full-width"
                            onclick="respondToRequest('${request.id}')"
                        >
                            I Can Donate
                        </button>
                        `
                        :
                        `
                        <button
                            class="btn btn-primary full-width"
                            onclick="requireLogin()"
                        >
                            Login to Respond
                        </button>
                        `
                    }

                </article>

            `;

        }).join("");
}


/* ============================================================
   11. CREATE BLOOD REQUEST
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


    openModal("requestModal");
}


/* ============================================================
   SUBMIT BLOOD REQUEST
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


    const form = event.target;


    const patientName =
        form.querySelector('[name="patient_name"]')?.value.trim();

    const bloodGroup =
        form.querySelector('[name="blood_group"]')?.value;

    const units =
        parseInt(
            form.querySelector('[name="units_required"]')?.value || "1",
            10
        );

    const hospital =
        form.querySelector('[name="hospital"]')?.value.trim();

    const location =
        form.querySelector('[name="location"]')?.value.trim();

    const requiredDate =
        form.querySelector('[name="required_date"]')?.value || null;

    const priority =
        form.querySelector('[name="priority"]')?.value || "normal";

    const notes =
        form.querySelector('[name="notes"]')?.value.trim();


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


    const button =
        form.querySelector('button[type="submit"]');

    setLoading(
        button,
        true,
        "Submitting request..."
    );


    try {

        const { error } =
            await supabaseClient
                .from("blood_requests")
                .insert({

                    requester_id: state.user.id,

                    patient_name: patientName,

                    blood_group: bloodGroup,

                    units_required: units,

                    hospital: hospital,

                    location: location,

                    required_date: requiredDate,

                    notes: notes,

                    priority: priority,

                    status: "pending"

                });


        if (error) throw error;


        showToast(
            "Blood request submitted for verification.",
            "success"
        );


        closeModal("requestModal");

        form.reset();


        await loadRequests();


    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Unable to submit request.",
            "error"
        );

    } finally {

        setLoading(button, false);
    }
}


/* ============================================================
   12. DONOR RESPONSE
   ============================================================ */

async function respondToRequest(requestId) {

    if (!state.user) {

        requireLogin();

        return;
    }


    if (
        !state.profile ||
        state.profile.role !== "donor"
    ) {

        showToast(
            "Only registered donors can respond.",
            "error"
        );

        return;
    }


    try {

        const { error } =
            await supabaseClient
                .from("request_responses")
                .insert({

                    request_id: requestId,

                    donor_id: state.user.id,

                    status: "interested"

                });


        if (error) {

            if (
                error.code === "23505"
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
            "Thank you! The request owner can now see that you can donate.",
            "success"
        );


    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Unable to respond.",
            "error"
        );
    }
}


/* ============================================================
   13. USER DASHBOARD
   ============================================================ */

async function openDashboard() {

    if (!state.user) {

        requireLogin();

        return;
    }


    openModal("dashboardModal");

    await loadDashboard();
}


/* ============================================================
   LOAD DASHBOARD
   ============================================================ */

async function loadDashboard() {

    const container =
        getElement("dashboardContent");

    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">
            <span class="spinner"></span>
            Loading dashboard...
        </div>
    `;


    try {

        const profile =
            state.profile ||
            await loadProfile(state.user.id);


        state.profile = profile;


        const [
            donationsResult,
            requestsResult
        ] = await Promise.all([

            supabaseClient
                .from("donations")
                .select("*")
                .eq("donor_id", state.user.id)
                .order("donation_date", {
                    ascending: false
                }),

            supabaseClient
                .from("blood_requests")
                .select("*")
                .eq("requester_id", state.user.id)
                .order("created_at", {
                    ascending: false
                })

        ]);


        if (donationsResult.error)
            throw donationsResult.error;

        if (requestsResult.error)
            throw requestsResult.error;


        const donations =
            donationsResult.data || [];

        const requests =
            requestsResult.data || [];


        renderDashboard(
            profile,
            donations,
            requests
        );


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load dashboard</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


/* ============================================================
   RENDER DASHBOARD
   ============================================================ */

function renderDashboard(
    profile,
    donations,
    requests
) {

    const container =
        getElement("dashboardContent");

    if (!container) return;


    const totalUnits =
        donations.reduce(
            (sum, item) =>
                sum + Number(item.units || 0),
            0
        );


    const available =
        profile?.is_available;


    container.innerHTML = `

        <div class="dashboard-header">

            <div>

                <h2>
                    Welcome, ${escapeHTML(
                        profile?.full_name || "User"
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
                    ${available ? "YES" : "NO"}
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

                        <h3>Donor Availability</h3>

                        <p>
                            Let people know if you are currently available to donate.
                        </p>

                    </div>


                    <label class="switch">

                        <input
                            type="checkbox"
                            id="availabilityToggle"
                            ${available ? "checked" : ""}
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

                        <h3>Donation History</h3>

                        <p>
                            Keep track of your blood donations.
                        </p>

                    </div>

                    <button
                        class="btn btn-primary"
                        onclick="addDonation()"
                    >
                        + Add Donation
                    </button>

                </div>


                ${renderDonationHistory(donations)}

            </div>
            `
            :
            ""
        }


        <div class="dashboard-section">

            <div class="section-header">

                <div>

                    <h3>My Blood Requests</h3>

                    <p>
                        Track requests submitted by you.
                    </p>

                </div>


                <button
                    class="btn btn-primary"
                    onclick="openRequestModal()"
                >
                    + Request Blood
                </button>

            </div>


            ${renderMyRequests(requests)}

        </div>

    `;
}


/* ============================================================
   DONATION HISTORY
   ============================================================ */

function renderDonationHistory(donations) {

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

                        <th>Date</th>

                        <th>Units</th>

                        <th>Notes</th>

                    </tr>

                </thead>


                <tbody>

                    ${donations.map(item => `

                        <tr>

                            <td>
                                ${formatDate(item.donation_date)}
                            </td>

                            <td>
                                ${item.units || 1}
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.notes || "—"
                                )}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>

    `;
}


/* ============================================================
   MY REQUESTS
   ============================================================ */

function renderMyRequests(requests) {

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

            ${requests.map(request => `

                <div class="my-request-item">

                    <div>

                        <strong>
                            ${escapeHTML(
                                request.patient_name || "Patient"
                            )}
                        </strong>

                        <span class="blood-badge">
                            ${escapeHTML(
                                request.blood_group
                            )}
                        </span>

                        <p>
                            ${escapeHTML(
                                request.hospital || ""
                            )}
                        </p>

                    </div>


                    <div class="request-status">

                        <span class="status-badge ${request.status}">
                            ${capitalize(request.status)}
                        </span>

                        <small>
                            ${formatDate(request.created_at)}
                        </small>

                    </div>

                </div>

            `).join("")}

        </div>

    `;
}


/* ============================================================
   TOGGLE DONOR AVAILABILITY
   ============================================================ */

async function toggleAvailability(value) {

    if (!state.user) return;


    try {

        const { error } =
            await supabaseClient
                .from("profiles")
                .update({
                    is_available: value
                })
                .eq("id", state.user.id);


        if (error) throw error;


        if (state.profile) {

            state.profile.is_available = value;
        }


        showToast(
            value
                ? "You are now marked as available."
                : "You are now marked as unavailable.",
            "success"
        );


        await loadDonors();


    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Unable to update availability.",
            "error"
        );
    }
}


/* ============================================================
   ADD DONATION
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


    const unitsInput =
        prompt(
            "How many units did you donate?",
            "1"
        );


    if (!unitsInput) return;


    const units =
        Number(unitsInput);


    if (!Number.isFinite(units) || units <= 0) {

        showToast(
            "Please enter a valid number of units.",
            "error"
        );

        return;
    }


    const notes =
        prompt(
            "Any notes? (Optional)"
        );


    try {

        const { error } =
            await supabaseClient
                .from("donations")
                .insert({

                    donor_id: state.user.id,

                    donation_date: date,

                    units: units,

                    notes: notes || null

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
            error.message || "Unable to add donation.",
            "error"
        );
    }
}


/* ============================================================
   14. ADMIN DASHBOARD
   ============================================================ */

async function openAdminDashboard() {

    if (!state.user) {

        requireLogin();

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


    openModal("adminModal");

    await loadAdminDashboard();
}


/* ============================================================
   LOAD ADMIN DASHBOARD
   ============================================================ */

async function loadAdminDashboard() {

    const container =
        getElement("adminContent");

    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">
            <span class="spinner"></span>
            Loading admin dashboard...
        </div>
    `;


    try {

        const [
            donorsResult,
            pendingResult,
            requestsResult,
            responsesResult
        ] = await Promise.all([

            supabaseClient
                .from("profiles")
                .select("id", {
                    count: "exact",
                    head: true
                })
                .eq("role", "donor"),

            supabaseClient
                .from("blood_requests")
                .select("id", {
                    count: "exact",
                    head: true
                })
                .eq("status", "pending"),

            supabaseClient
                .from("blood_requests")
                .select("id", {
                    count: "exact",
                    head: true
                }),

            supabaseClient
                .from("request_responses")
                .select("id", {
                    count: "exact",
                    head: true
                })

        ]);


        renderAdminDashboard({

            donors:
                donorsResult.count || 0,

            pending:
                pendingResult.count || 0,

            requests:
                requestsResult.count || 0,

            responses:
                responsesResult.count || 0

        });


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty-state">

                <h3>
                    Unable to load admin dashboard
                </h3>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>
        `;
    }
}


/* ============================================================
   RENDER ADMIN
   ============================================================ */

function renderAdminDashboard(stats) {

    const container =
        getElement("adminContent");

    if (!container) return;


    container.innerHTML = `

        <div class="admin-kpis">

            <div class="admin-kpi">

                <span>🩸</span>

                <strong>
                    ${stats.donors}
                </strong>

                <small>
                    Donors
                </small>

            </div>


            <div class="admin-kpi">

                <span>⏳</span>

                <strong>
                    ${stats.pending}
                </strong>

                <small>
                    Pending Requests
                </small>

            </div>


            <div class="admin-kpi">

                <span>📋</span>

                <strong>
                    ${stats.requests}
                </strong>

                <small>
                    Total Requests
                </small>

            </div>


            <div class="admin-kpi">

                <span>❤️</span>

                <strong>
                    ${stats.responses}
                </strong>

                <small>
                    Donor Responses
                </small>

            </div>

        </div>


        <div class="admin-tabs">

            <button
                class="admin-tab active"
                onclick="switchAdminTab('pending', this)"
            >
                Pending Requests
            </button>

            <button
                class="admin-tab"
                onclick="switchAdminTab('requests', this)"
            >
                All Requests
            </button>

            <button
                class="admin-tab"
                onclick="switchAdminTab('donors', this)"
            >
                Donors
            </button>

            <button
                class="admin-tab"
                onclick="switchAdminTab('responses', this)"
            >
                Responses
            </button>

        </div>


        <div id="adminTabContent">

            <div class="loading-state">
                Loading...
            </div>

        </div>

    `;


    renderAdminTab("pending");
}


/* ============================================================
   ADMIN TAB SWITCH
   ============================================================ */

async function switchAdminTab(tab, button) {

    $$(".admin-tab").forEach(item => {

        item.classList.remove("active");

    });


    if (button) {

        button.classList.add("active");

    }


    state.currentAdminTab = tab;


    await renderAdminTab(tab);
}


/* ============================================================
   RENDER ADMIN TAB
   ============================================================ */

async function renderAdminTab(tab) {

    const container =
        getElement("adminTabContent");

    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">
            <span class="spinner"></span>
            Loading...
        </div>
    `;


    try {

        if (tab === "pending") {

            await renderPendingRequests();

        }

        else if (tab === "requests") {

            await renderAllRequests();

        }

        else if (tab === "donors") {

            await renderAdminDonors();

        }

        else if (tab === "responses") {

            await renderResponses();

        }


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load data</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


/* ============================================================
   PENDING REQUESTS
   ============================================================ */

async function renderPendingRequests() {

    const container =
        getElement("adminTabContent");


    const { data, error } =
        await supabaseClient
            .from("blood_requests")
            .select("*")
            .eq("status", "pending")
            .order("created_at", {
                ascending: true
            });


    if (error) throw error;


    if (!data?.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ✓
                </div>

                <h3>
                    No pending requests
                </h3>

                <p>
                    All requests have been reviewed.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="admin-request-list">

            ${data.map(request => `

                <div class="admin-request-card">

                    <div class="admin-request-main">

                        <div class="blood-badge large">
                            ${escapeHTML(
                                request.blood_group
                            )}
                        </div>

                        <div>

                            <h3>
                                ${escapeHTML(
                                    request.patient_name
                                )}
                            </h3>

                            <p>
                                🏥 ${escapeHTML(
                                    request.hospital
                                )}
                            </p>

                            <p>
                                📍 ${escapeHTML(
                                    request.location
                                )}
                            </p>

                            <p>
                                🩸 ${request.units_required} unit(s)
                            </p>

                            <p>
                                📅 ${
                                    request.required_date
                                    ? formatDate(request.required_date)
                                    : "Not specified"
                                }
                            </p>

                        </div>

                    </div>


                    <div class="admin-actions">

                        <button
                            class="btn btn-success"
                            onclick="verifyRequest('${request.id}')"
                        >
                            ✓ Verify
                        </button>

                        <button
                            class="btn btn-danger"
                            onclick="rejectRequest('${request.id}')"
                        >
                            ✕ Reject
                        </button>

                    </div>

                </div>

            `).join("")}

        </div>

    `;
}


/* ============================================================
   VERIFY REQUEST
   ============================================================ */

async function verifyRequest(id) {

    if (!confirm("Verify this blood request?")) {
        return;
    }


    try {

        const { error } =
            await supabaseClient
                .from("blood_requests")
                .update({
                    status: "verified"
                })
                .eq("id", id);


        if (error) throw error;


        showToast(
            "Request verified successfully.",
            "success"
        );


        await loadAdminDashboard();

        await loadRequests();


    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Unable to verify request.",
            "error"
        );
    }
}


/* ============================================================
   REJECT REQUEST
   ============================================================ */

async function rejectRequest(id) {

    if (!confirm("Reject this blood request?")) {
        return;
    }


    try {

        const { error } =
            await supabaseClient
                .from("blood_requests")
                .update({
                    status: "rejected"
                })
                .eq("id", id);


        if (error) throw error;


        showToast(
            "Request rejected.",
            "success"
        );


        await loadAdminDashboard();


    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Unable to reject request.",
            "error"
        );
    }
}


/* ============================================================
   ALL REQUESTS
   ============================================================ */

async function renderAllRequests() {

    const container =
        getElement("adminTabContent");


    const { data, error } =
        await supabaseClient
            .from("blood_requests")
            .select("*")
            .order("created_at", {
                ascending: false
            });


    if (error) throw error;


    if (!data?.length) {

        container.innerHTML = `
            <div class="empty-state">
                <h3>No requests found</h3>
            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>Patient</th>

                        <th>Blood</th>

                        <th>Hospital</th>

                        <th>Units</th>

                        <th>Priority</th>

                        <th>Status</th>

                        <th>Date</th>

                        <th>Action</th>

                    </tr>

                </thead>


                <tbody>

                    ${data.map(request => `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    request.patient_name
                                )}
                            </td>

                            <td>
                                <span class="blood-badge">
                                    ${escapeHTML(
                                        request.blood_group
                                    )}
                                </span>
                            </td>

                            <td>
                                ${escapeHTML(
                                    request.hospital
                                )}
                            </td>

                            <td>
                                ${request.units_required}
                            </td>

                            <td>
                                ${capitalize(
                                    request.priority
                                )}
                            </td>

                            <td>

                                <span class="status-badge ${request.status}">
                                    ${capitalize(
                                        request.status
                                    )}
                                </span>

                            </td>

                            <td>
                                ${formatDate(
                                    request.created_at
                                )}
                            </td>

                            <td>

                                ${
                                    request.status === "pending"
                                    ?
                                    `
                                    <button
                                        class="btn btn-small btn-success"
                                        onclick="verifyRequest('${request.id}')"
                                    >
                                        Verify
                                    </button>

                                    <button
                                        class="btn btn-small btn-danger"
                                        onclick="rejectRequest('${request.id}')"
                                    >
                                        Reject
                                    </button>
                                    `
                                    :
                                    request.status === "verified"
                                    ?
                                    `
                                    <button
                                        class="btn btn-small btn-warning"
                                        onclick="cancelRequest('${request.id}')"
                                    >
                                        Cancel
                                    </button>
                                    `
                                    :
                                    "—"
                                }

                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>

    `;
}


/* ============================================================
   CANCEL REQUEST
   ============================================================ */

async function cancelRequest(id) {

    if (!confirm("Cancel this request?")) {
        return;
    }


    try {

        const { error } =
            await supabaseClient
                .from("blood_requests")
                .update({
                    status: "cancelled"
                })
                .eq("id", id);


        if (error) throw error;


        showToast(
            "Request cancelled.",
            "success"
        );


        await loadAdminDashboard();


    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Unable to cancel request.",
            "error"
        );
    }
}


/* ============================================================
   ADMIN DONORS
   ============================================================ */

async function renderAdminDonors() {

    const container =
        getElement("adminTabContent");


    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq("role", "donor")
            .order("created_at", {
                ascending: false
            });


    if (error) throw error;


    if (!data?.length) {

        container.innerHTML = `
            <div class="empty-state">
                <h3>No donors found</h3>
            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>Name</th>

                        <th>Blood Group</th>

                        <th>Location</th>

                        <th>Phone</th>

                        <th>Availability</th>

                        <th>Joined</th>

                    </tr>

                </thead>


                <tbody>

                    ${data.map(donor => `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    donor.full_name || "—"
                                )}
                            </td>

                            <td>

                                <span class="blood-badge">
                                    ${escapeHTML(
                                        donor.blood_group || "—"
                                    )}
                                </span>

                            </td>

                            <td>
                                ${escapeHTML(
                                    donor.location || "—"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    donor.phone || "—"
                                )}
                            </td>

                            <td>

                                ${
                                    donor.is_available
                                    ?
                                    `
                                    <span class="status-badge available">
                                        Available
                                    </span>
                                    `
                                    :
                                    `
                                    <span class="status-badge unavailable">
                                        Unavailable
                                    </span>
                                    `
                                }

                            </td>

                            <td>
                                ${formatDate(
                                    donor.created_at
                                )}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>

    `;
}


/* ============================================================
   REQUEST RESPONSES
   ============================================================ */

async function renderResponses() {

    const container =
        getElement("adminTabContent");


    const { data, error } =
        await supabaseClient
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
            <div class="empty-state">

                <h3>
                    No donor responses yet
                </h3>

                <p>
                    Responses will appear here when donors volunteer.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>Donor</th>

                        <th>Blood</th>

                        <th>Location</th>

                        <th>Phone</th>

                        <th>Patient</th>

                        <th>Request Blood</th>

                        <th>Status</th>

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
                                    ${escapeHTML(
                                        donor.full_name || "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        donor.blood_group || "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        donor.location || "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        donor.phone || "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        request.patient_name || "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        request.blood_group || "—"
                                    )}
                                </td>

                                <td>
                                    <span class="status-badge">
                                        ${capitalize(
                                            response.status
                                        )}
                                    </span>
                                </td>

                            </tr>

                        `;

                    }).join("")}

                </tbody>

            </table>

        </div>

    `;
}


/* ============================================================
   15. REQUIRE LOGIN
   ============================================================ */

function requireLogin() {

    showToast(
        "Please login to continue.",
        "error"
    );

    openModal("authModal");
}


/* ============================================================
   16. NAVIGATION HELPERS
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
   17. FORM EVENT LISTENERS
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    /* Login */

    const loginForm =
        getElement("loginForm");

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            login
        );
    }


    /* Signup */

    const signupForm =
        getElement("signupForm");

    if (signupForm) {

        signupForm.addEventListener(
            "submit",
            signup
        );
    }


    /* Blood request */

    const requestForm =
        getElement("requestForm");

    if (requestForm) {

        requestForm.addEventListener(
            "submit",
            submitBloodRequest
        );
    }


    /* Search */

    const searchButton =
        getElement("searchDonorsBtn");

    if (searchButton) {

        searchButton.addEventListener(
            "click",
            loadDonors
        );
    }


    /* Request blood buttons */

    $$("[data-request-blood]").forEach(button => {

        button.addEventListener(
            "click",
            openRequestModal
        );

    });


    /* Login buttons */

    $$("[data-login]").forEach(button => {

        button.addEventListener(
            "click",
            () => openModal("authModal")
        );

    });


    /* Dashboard */

    $$("[data-dashboard]").forEach(button => {

        button.addEventListener(
            "click",
            openDashboard
        );

    });


    /* Admin */

    $$("[data-admin]").forEach(button => {

        button.addEventListener(
            "click",
            openAdminDashboard
        );

    });


    /* Logout */

    $$("[data-logout]").forEach(button => {

        button.addEventListener(
            "click",
            logout
        );

    });


    /* Become donor */

    $$("[data-become-donor]").forEach(button => {

        button.addEventListener(
            "click",
            () => {

                openModal("authModal");

                /*
                  If your auth modal has signup tabs,
                  try switching to signup.
                */

                const signupTab =
                    getElement("signupTab");

                if (signupTab) {

                    signupTab.click();
                }

            }
        );

    });


    /*
      Auth state changes
    */

    supabaseClient.auth.onAuthStateChange(
        async (event, session) => {

            console.log(
                "Auth event:",
                event
            );


            state.user =
                session?.user || null;


            if (state.user) {

                state.profile =
                    await loadProfile(
                        state.user.id
                    );

            } else {

                state.profile = null;
            }


            renderNavigation();


            /*
              Refresh public data after login/logout.
            */

            loadDonors();

            loadRequests();

        }
    );


    /*
      Initial session
    */

    initializeApp();

});


/* ============================================================
   18. INITIALIZE APPLICATION
   ============================================================ */

async function initializeApp() {

    try {

        const session =
            await getSession();


        state.user =
            session?.user || null;


        if (state.user) {

            state.profile =
                await loadProfile(
                    state.user.id
                );
        }


        renderNavigation();


        /*
          Load public sections.
        */

        await Promise.all([

            loadDonors(),

            loadRequests()

        ]);


    } catch (error) {

        console.error(
            "Application initialization error:",
            error
        );
    }
}


/* ============================================================
   19. UTILITY FUNCTIONS
   ============================================================ */


/* Escape HTML */

function escapeHTML(value) {

    if (value === null || value === undefined) {
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
   CAPITALIZE
   ============================================================ */

function capitalize(value) {

    if (!value) return "";

    return String(value)
        .charAt(0)
        .toUpperCase() +
        String(value)
            .slice(1)
            .toLowerCase();
}


/* ============================================================
   FORMAT DATE
   ============================================================ */

function formatDate(date) {

    if (!date) return "—";


    const parsed =
        new Date(date);


    if (Number.isNaN(parsed.getTime())) {

        return escapeHTML(date);
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
   GET INITIALS
   ============================================================ */

function getInitials(name) {

    if (!name) return "D";


    const words =
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2);


    return words
        .map(word =>
            word.charAt(0).toUpperCase()
        )
        .join("");
}


/* ============================================================
   20. GLOBAL FUNCTIONS
   Make functions accessible to HTML onclick=""
   ============================================================ */

window.openModal = openModal;

window.closeModal = closeModal;

window.closeAllModals = closeAllModals;

window.login = login;

window.signup = signup;

window.logout = logout;

window.loadDonors = loadDonors;

window.loadRequests = loadRequests;

window.contactDonor = contactDonor;

window.respondToRequest = respondToRequest;

window.openRequestModal = openRequestModal;

window.submitBloodRequest = submitBloodRequest;

window.openDashboard = openDashboard;

window.loadDashboard = loadDashboard;

window.toggleAvailability = toggleAvailability;

window.addDonation = addDonation;

window.openAdminDashboard = openAdminDashboard;

window.switchAdminTab = switchAdminTab;

window.verifyRequest = verifyRequest;

window.rejectRequest = rejectRequest;

window.cancelRequest = cancelRequest;

window.requireLogin = requireLogin;

window.scrollToSection = scrollToSection;


/* ============================================================
   BLOODCONNECT APP READY
   ============================================================ */

console.log(
    "🩸 BloodConnect application loaded successfully."
);