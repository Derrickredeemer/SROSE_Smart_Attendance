/* S-ROSE Smart Attendance Scanner
   Browser-based frontend prototype. Data remains in this browser/device.
*/
(() => {
  "use strict";
  const KEY = "srose_smart_attendance_v1";
  const $ = (id) => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  const monthNow = () => today().slice(0, 7);
  const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const blank = () => ({
    teachers: [],
    records: [],
    statuses: [],
    scans: [],
    years: [],
    events: [],
    settings: {
      schoolName: "Selula Royal School of Excellence",
      lateThreshold: "07:20",
    },
  });
  let db = load();
  function load() {
    try {
      return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch (e) {
      return blank();
    }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(db));
    refreshAll();
  }
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2600);
  }
  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  function dateLabel(d) {
    return d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";
  }
  function isLate(time) {
    return !!time && time > (db.settings.lateThreshold || "07:20");
  }
  function statusFor(r) {
    return isLate(r.arrivalTime) ? "Late" : "Present";
  }
  function activeTeachers() {
    return db.teachers.filter((t) => t.status === "Active");
  }
  function teacherName(id) {
    return db.teachers.find((t) => t.id === id)?.name || "Unknown teacher";
  }
  function ensureDefaultYear() {
    if (!db.years.length) {
      const y = {
        id: "2026/2027",
        name: "2026/2027",
        startDate: "2026-09-01",
        endDate: "2027-08-31",
        active: true,
        terms: [
          {
            name: "First Term",
            startDate: "",
            endDate: "",
            midtermStart: "2026-10-23",
            midtermEnd: "2026-10-26",
            reopenDate: "2026-10-27",
          },
          {
            name: "Second Term",
            startDate: "",
            endDate: "",
            midtermStart: "",
            midtermEnd: "",
            reopenDate: "",
          },
          {
            name: "Third Term",
            startDate: "",
            endDate: "",
            midtermStart: "",
            midtermEnd: "",
            reopenDate: "",
          },
        ],
      };
      db.years.push(y);
      addMidtermEvents(y);
      localStorage.setItem(KEY, JSON.stringify(db));
    }
  }
  function addMidtermEvents(y) {
    (y.terms || []).forEach((term) => {
      if (!term.midtermStart || !term.midtermEnd) return;
      let d = new Date(term.midtermStart + "T00:00:00"),
        end = new Date(term.midtermEnd + "T00:00:00");
      while (d <= end) {
        const ds = d.toISOString().slice(0, 10);
        if (!db.events.some((e) => e.date === ds)) {
          db.events.push({
            id: ds,
            date: ds,
            yearId: y.id,
            type: "School Closed",
            title: term.name + " Midterm Break",
            reason: "Midterm break",
          });
        }
        d.setDate(d.getDate() + 1);
      }
    });
  }
  ensureDefaultYear();
  function showView(name) {
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    document
      .querySelectorAll(".nav-link")
      .forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    const labels = {
      dashboard: ["Dashboard", "School attendance overview"],
      teachers: ["Teacher Management", "Manage registered teaching staff"],
      scan: ["Register Scanning", "Upload handwritten register pages"],
      review: ["Review & Verification", "Confirm register entries"],
      records: ["Attendance Records", "Verified attendance history"],
      individual: ["Individual Reports", "Monthly teacher report"],
      schoolreport: ["School Reports", "Whole-school attendance report"],
      absence: ["Absence & Leave", "Manage non-attendance statuses"],
      calculator: ["Attendance Calculator", "Calculate attendance rates"],
      calendar: ["School Calendar", "Academic years and school dates"],
      settings: ["Settings & Backup", "Manage local data and backups"],
    };
    $("pageTitle").textContent = labels[name][0];
    $("pageSubtitle").textContent = labels[name][1];
    $("sidebar").classList.remove("menu-open");
    refreshAll();
  }
  document
    .querySelectorAll("[data-view]")
    .forEach((b) =>
      b.addEventListener("click", () => showView(b.dataset.view)),
    );
  document
    .querySelectorAll("[data-go]")
    .forEach((b) => b.addEventListener("click", () => showView(b.dataset.go)));
  $("menuToggle").addEventListener("click", () =>
    $("sidebar").classList.toggle("menu-open"),
  );

  function fillTeacherSelect(id, includeAll = false) {
    const el = $(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML =
      (includeAll
        ? '<option value="">All active teachers</option>'
        : '<option value="">Select teacher</option>') +
      activeTeachers()
        .map((t) => `<option value="${t.id}">${esc(t.name)}</option>`)
        .join("");
    if ([...el.options].some((o) => o.value === current)) el.value = current;
  }
  function renderTeachers() {
    const q = ($("teacherSearch").value || "").toLowerCase();
    const rows = db.teachers.filter((t) =>
      (t.name + " " + t.position + " " + t.className).toLowerCase().includes(q),
    );
    $("teacherCount").textContent = `${db.teachers.length} teacher(s)`;
    $("teacherTable").innerHTML =
      rows
        .map(
          (t) =>
            `<tr><td><strong>${esc(t.name)}</strong></td><td>${esc(t.position || "—")}</td><td>${esc(t.className || "—")}</td><td>${esc(t.phone || "—")}</td><td><span class="badge ${t.status === "Active" ? "" : "neutral"}">${esc(t.status)}</span></td><td><div class="action-group"><button data-edit-teacher="${t.id}">Edit</button><button class="btn-danger" data-delete-teacher="${t.id}">Delete</button></div></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="6" class="empty-state">No teachers found.</td></tr>';
    document
      .querySelectorAll("[data-edit-teacher]")
      .forEach((b) => (b.onclick = () => editTeacher(b.dataset.editTeacher)));
    document
      .querySelectorAll("[data-delete-teacher]")
      .forEach(
        (b) => (b.onclick = () => deleteTeacher(b.dataset.deleteTeacher)),
      );
  }
  function editTeacher(id) {
    const t = db.teachers.find((x) => x.id === id);
    if (!t) return;
    $("teacherId").value = t.id;
    $("teacherName").value = t.name;
    $("teacherPosition").value = t.position || "";
    $("teacherClass").value = t.className || "";
    $("teacherPhone").value = t.phone || "";
    $("teacherStatus").value = t.status;
    $("teacherSubmit").textContent = "Update Teacher";
    showView("teachers");
  }
  function deleteTeacher(id) {
    if (
      !confirm(
        "Delete this teacher from the staff list? Existing attendance history will be preserved.",
      )
    )
      return;
    db.teachers = db.teachers.filter((t) => t.id !== id);
    save();
    toast("Teacher deleted.");
  }
  $("teacherForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("teacherId").value;
    const obj = {
      id: id || uid(),
      name: $("teacherName").value.trim(),
      position: $("teacherPosition").value.trim(),
      className: $("teacherClass").value.trim(),
      phone: $("teacherPhone").value.trim(),
      status: $("teacherStatus").value,
    };
    if (!obj.name) return;
    const i = db.teachers.findIndex((t) => t.id === id);
    if (i >= 0) db.teachers[i] = obj;
    else db.teachers.push(obj);
    $("teacherForm").reset();
    $("teacherId").value = "";
    $("teacherSubmit").textContent = "Save Teacher";
    save();
    toast("Teacher saved.");
  });
  $("teacherCancel").addEventListener("click", () => {
    $("teacherId").value = "";
    $("teacherSubmit").textContent = "Save Teacher";
  });
  $("teacherSearch").addEventListener("input", renderTeachers);

  let stagedFiles = [];
  $("scanDate").value = today();
  $("reviewDate").value = today();
  $("absenceDate").value = today();
  $("individualMonth").value = monthNow();
  $("schoolReportMonth").value = monthNow();
  $("recordMonth").value = monthNow();
  $("scanFiles").addEventListener("change", (e) => {
    stagedFiles = [...e.target.files];
    $("scanPreview").innerHTML = "";
    stagedFiles.forEach((f) => {
      const u = URL.createObjectURL(f);
      $("scanPreview").insertAdjacentHTML(
        "beforeend",
        `<img src="${u}" alt="Register page preview">`,
      );
    });
  });
  $("scanForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!stagedFiles.length) return;
    const batch = {
      id: uid(),
      date: $("scanDate").value,
      description: $("scanDescription").value.trim(),
      pages: stagedFiles.map((f) => ({
        name: f.name,
        type: f.type,
        dataUrl: "",
      })),
      createdAt: new Date().toISOString(),
    };
    const promises = stagedFiles.map(
      (f) =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(f);
        }),
    );
    Promise.all(promises)
      .then((urls) => {
        batch.pages.forEach((p, i) => (p.dataUrl = urls[i]));
        db.scans.unshift(batch);
        save();
        $("scanForm").reset();
        $("scanDate").value = today();
        $("scanPreview").innerHTML = "";
        stagedFiles = [];
        toast("Scan batch saved. Open Review & Verification.");
      })
      .catch(() => toast("Could not read one or more images."));
  });
  function renderScans() {
    $("scanBatchList").innerHTML =
      db.scans
        .map(
          (b) =>
            `<div class="batch-item"><div><strong>${esc(b.description || "Register scan")}</strong><small>${dateLabel(b.date)} · ${b.pages.length} page(s)</small></div><div class="action-group"><button data-open-batch="${b.id}">Review</button><button class="btn-danger" data-delete-batch="${b.id}">Delete</button></div></div>`,
        )
        .join("") ||
      '<p class="empty-state">No scanned batches uploaded yet.</p>';
    $("reviewBatch").innerHTML =
      '<option value="">Select a scan batch</option>' +
      db.scans
        .map(
          (b) =>
            `<option value="${b.id}">${dateLabel(b.date)} — ${esc(b.description || "Register scan")}</option>`,
        )
        .join("");
    document.querySelectorAll("[data-open-batch]").forEach(
      (b) =>
        (b.onclick = () => {
          showView("review");
          $("reviewBatch").value = b.dataset.openBatch;
          renderSelectedBatch();
        }),
    );
    document.querySelectorAll("[data-delete-batch]").forEach(
      (b) =>
        (b.onclick = () => {
          if (
            confirm(
              "Delete this scanned batch? Verified attendance records will remain.",
            )
          ) {
            db.scans = db.scans.filter((x) => x.id !== b.dataset.deleteBatch);
            save();
          }
        }),
    );
  }
  function renderSelectedBatch() {
    const b = db.scans.find((x) => x.id === $("reviewBatch").value);
    $("reviewImages").innerHTML = b
      ? b.pages
          .map(
            (p) =>
              `<figure><img src="${p.dataUrl}" alt="${esc(p.name)}"><figcaption>${esc(p.name)}</figcaption></figure>`,
          )
          .join("")
      : "";
    if (b) $("reviewDate").value = b.date;
  }
  $("reviewBatch").addEventListener("change", renderSelectedBatch);
  $("reviewForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const teacherId = $("reviewTeacher").value,
      date = $("reviewDate").value;
    if (db.records.some((r) => r.teacherId === teacherId && r.date === date)) {
      toast("An attendance record already exists for this teacher and date.");
      return;
    }
    if ($("reviewDeparture").value < $("reviewArrival").value) {
      toast("Departure time cannot be earlier than arrival time.");
      return;
    }
    db.records.push({
      id: uid(),
      batchId: $("reviewBatch").value || null,
      date,
      teacherId,
      arrivalTime: $("reviewArrival").value,
      departureTime: $("reviewDeparture").value,
      timesSigned: Number($("reviewTimes").value),
      signature: $("reviewSignature").checked,
      notes: $("reviewNotes").value.trim(),
      createdAt: new Date().toISOString(),
    });
    save();
    $("reviewForm").reset();
    $("reviewDate").value = today();
    $("reviewTimes").value = 1;
    $("reviewSignature").checked = true;
    toast("Attendance verified and saved.");
  });

  function renderRecords() {
    const q = ($("recordSearch").value || "").toLowerCase(),
      m = $("recordMonth").value,
      s = $("recordStatus").value;
    const rows = db.records
      .filter(
        (r) =>
          teacherName(r.teacherId).toLowerCase().includes(q) &&
          (!m || r.date.startsWith(m)) &&
          (!s || statusFor(r) === s),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    $("recordTotal").textContent = rows.length;
    $("recordLate").textContent = rows.filter((r) =>
      isLate(r.arrivalTime),
    ).length;
    $("recordMissing").textContent = rows.filter((r) => !r.signature).length;
    $("recordTable").innerHTML =
      rows
        .map(
          (r) =>
            `<tr><td>${dateLabel(r.date)}</td><td>${esc(teacherName(r.teacherId))}</td><td>${esc(r.arrivalTime)}</td><td><span class="badge ${isLate(r.arrivalTime) ? "late" : ""}">${statusFor(r)}</span></td><td>${r.timesSigned}</td><td>${r.signature ? "Present" : "Missing"}</td><td>${esc(r.departureTime || "—")}</td><td><div class="action-group"><button data-edit-record="${r.id}">Edit</button><button class="btn-danger" data-delete-record="${r.id}">Delete</button></div></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="8" class="empty-state">No attendance records found.</td></tr>';
    document.querySelectorAll("[data-delete-record]").forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("Delete this attendance record?")) {
            db.records = db.records.filter(
              (r) => r.id !== b.dataset.deleteRecord,
            );
            save();
          }
        }),
    );
    document
      .querySelectorAll("[data-edit-record]")
      .forEach((b) => (b.onclick = () => editRecord(b.dataset.editRecord)));
  }
  function editRecord(id) {
    const r = db.records.find((x) => x.id === id);
    if (!r) return;
    const arrival = prompt("Arrival time (HH:MM)", r.arrivalTime);
    if (arrival === null) return;
    const departure = prompt("Departure time (HH:MM)", r.departureTime);
    if (departure === null) return;
    const n = Number(prompt("Number of times signed", r.timesSigned));
    if (
      !arrival ||
      !departure ||
      departure < arrival ||
      !Number.isInteger(n) ||
      n < 1
    ) {
      toast("Invalid details. Record was not changed.");
      return;
    }
    r.arrivalTime = arrival;
    r.departureTime = departure;
    r.timesSigned = n;
    save();
    toast("Record updated.");
  }
  $("recordSearch").addEventListener("input", renderRecords);
  $("recordMonth").addEventListener("change", renderRecords);
  $("recordStatus").addEventListener("change", renderRecords);
  function csvDownload(name, rows) {
    const csv = rows
      .map((row) =>
        row
          .map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"')
          .join(","),
      )
      .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  $("exportRecords").onclick = () =>
    csvDownload("srose-attendance-records.csv", [
      [
        "Date",
        "Teacher",
        "Arrival",
        "Status",
        "Times Signed",
        "Signature",
        "Departure",
      ],
      ...db.records.map((r) => [
        r.date,
        teacherName(r.teacherId),
        r.arrivalTime,
        statusFor(r),
        r.timesSigned,
        r.signature ? "Present" : "Missing",
        r.departureTime,
      ]),
    ]);

  $("absenceForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const teacherId = $("absenceTeacher").value,
      date = $("absenceDate").value;
    if (db.records.some((r) => r.teacherId === teacherId && r.date === date)) {
      toast("Verified attendance already exists for this teacher and date.");
      return;
    }
    const existing = db.statuses.find(
      (s) => s.teacherId === teacherId && s.date === date,
    );
    if (existing) {
      existing.status = $("absenceStatus").value;
      existing.reason = $("absenceReason").value.trim();
    } else
      db.statuses.push({
        id: uid(),
        teacherId,
        date,
        status: $("absenceStatus").value,
        reason: $("absenceReason").value.trim(),
      });
    save();
    $("absenceForm").reset();
    $("absenceDate").value = today();
    toast("Attendance status saved.");
  });
  function renderAbsences() {
    $("absenceTable").innerHTML =
      db.statuses
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (s) =>
            `<tr><td>${dateLabel(s.date)}</td><td>${esc(teacherName(s.teacherId))}</td><td><span class="badge neutral">${esc(s.status)}</span></td><td>${esc(s.reason || "—")}</td><td><button class="btn btn-danger" data-del-status="${s.id}">Delete</button></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="5" class="empty-state">No absence or leave statuses recorded.</td></tr>';
    document.querySelectorAll("[data-del-status]").forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("Delete this status?")) {
            db.statuses = db.statuses.filter(
              (x) => x.id !== b.dataset.delStatus,
            );
            save();
          }
        }),
    );
  }

  function renderIndividual() {
    const id = $("individualTeacher").value,
      m = $("individualMonth").value;
    if (!id || !m) {
      $("individualReport").innerHTML =
        '<p class="empty-state">Choose a teacher and month to view the report.</p>';
      return;
    }
    const rows = db.records
      .filter((r) => r.teacherId === id && r.date.startsWith(m))
      .sort((a, b) => a.date.localeCompare(b.date));
    const sts = db.statuses.filter(
      (s) => s.teacherId === id && s.date.startsWith(m),
    );
    const late = rows.filter((r) => isLate(r.arrivalTime)).length;
    $("individualReport").innerHTML =
      `<div class="report-header"><h3>${esc(db.settings.schoolName)}</h3><p>The Lord is Our Shepherd</p><h3>Individual Attendance Report</h3><p>${esc(teacherName(id))} · ${m}</p></div><div class="report-metrics"><span>Verified days: <b>${rows.length}</b></span><span>Late arrivals: <b>${late}</b></span><span>Missing signatures: <b>${rows.filter((r) => !r.signature).length}</b></span><span>Other statuses: <b>${sts.length}</b></span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Arrival</th><th>Status</th><th>Times Signed</th><th>Signature</th><th>Departure</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${dateLabel(r.date)}</td><td>${r.arrivalTime}</td><td>${statusFor(r)}</td><td>${r.timesSigned}</td><td>${r.signature ? "Present" : "Missing"}</td><td>${r.departureTime || "—"}</td></tr>`).join("")}${sts.map((s) => `<tr><td>${dateLabel(s.date)}</td><td>—</td><td>${esc(s.status)}</td><td>—</td><td>—</td><td>—</td></tr>`).join("")}</tbody></table></div>`;
  }
  $("individualTeacher").addEventListener("change", renderIndividual);
  $("individualMonth").addEventListener("change", renderIndividual);
  $("printIndividual").onclick = () => window.print();
  function renderSchoolReport() {
    const m = $("schoolReportMonth").value,
      q = $("schoolReportSearch").value.toLowerCase();
    const rows = db.records
      .filter(
        (r) =>
          (!m || r.date.startsWith(m)) &&
          teacherName(r.teacherId).toLowerCase().includes(q),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    $("schoolReport").innerHTML =
      `<div class="report-header"><h3>${esc(db.settings.schoolName)}</h3><p>The Lord is Our Shepherd</p><h3>Whole-School Attendance Report</h3><p>${m || "All dates"}</p></div><div class="report-metrics"><span>Verified entries: <b>${rows.length}</b></span><span>Late arrivals: <b>${rows.filter((r) => isLate(r.arrivalTime)).length}</b></span><span>Missing signatures: <b>${rows.filter((r) => !r.signature).length}</b></span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Teacher</th><th>Arrival</th><th>Status</th><th>Times Signed</th><th>Signature</th><th>Departure</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${dateLabel(r.date)}</td><td>${esc(teacherName(r.teacherId))}</td><td>${r.arrivalTime}</td><td>${statusFor(r)}</td><td>${r.timesSigned}</td><td>${r.signature ? "Present" : "Missing"}</td><td>${r.departureTime || "—"}</td></tr>`).join("") || '<tr><td colspan="7" class="empty-state">No records for this selection.</td></tr>'}</tbody></table></div><div class="report-metrics"><span>Curriculum Leader signature: ____________________</span><span>Headteacher signature: ____________________</span></div>`;
  }
  $("schoolReportMonth").addEventListener("change", renderSchoolReport);
  $("schoolReportSearch").addEventListener("input", renderSchoolReport);
  $("printSchool").onclick = () => window.print();

  function renderYears() {
    const active = db.years.find((y) => y.active) || db.years[0];
    const options = db.years
      .map((y) => `<option value="${esc(y.id)}">${esc(y.name)}</option>`)
      .join("");
    ["calcYear", "eventYear", "calendarYearFilter"].forEach((id) => {
      const el = $(id),
        old = el.value;
      el.innerHTML = options || '<option value="">No academic years</option>';
      if ([...el.options].some((o) => o.value === old)) el.value = old;
      else if (active) el.value = active.id;
    });
    $("yearList").innerHTML = db.years
      .map(
        (y) =>
          `<div class="year-item"><div><strong>${esc(y.name)} ${y.active ? '<span class="badge">Active</span>' : ""}</strong><p>${dateLabel(y.startDate)} – ${dateLabel(y.endDate)} · ${y.terms.length} terms</p></div><div class="action-group"><button data-edit-year="${esc(y.id)}">Edit</button><button data-activate-year="${esc(y.id)}">Set Active</button><button class="btn-danger" data-delete-year="${esc(y.id)}">Delete</button></div></div>`,
      )
      .join("");
    document
      .querySelectorAll("[data-edit-year]")
      .forEach((b) => (b.onclick = () => editYear(b.dataset.editYear)));
    document.querySelectorAll("[data-activate-year]").forEach(
      (b) =>
        (b.onclick = () => {
          db.years.forEach((y) => (y.active = y.id === b.dataset.activateYear));
          save();
          toast("Active academic year updated.");
        }),
    );
    document.querySelectorAll("[data-delete-year]").forEach(
      (b) =>
        (b.onclick = () => {
          if (db.years.length === 1) {
            toast("At least one academic year must remain.");
            return;
          }
          if (
            confirm(
              "Delete this academic year? Calendar entries assigned to it will also be deleted.",
            )
          ) {
            db.years = db.years.filter((y) => y.id !== b.dataset.deleteYear);
            db.events = db.events.filter(
              (ev) => ev.yearId !== b.dataset.deleteYear,
            );
            if (!db.years.some((y) => y.active)) db.years[0].active = true;
            save();
          }
        }),
    );
    renderEvents();
  }
  function editYear(id) {
    const y = db.years.find((x) => x.id === id);
    if (!y) return;
    $("yearOriginalId").value = y.id;
    $("yearName").value = y.name;
    $("yearStart").value = y.startDate || "";
    $("yearEnd").value = y.endDate || "";
    $("yearActive").checked = !!y.active;
    for (let i = 1; i <= 3; i++) {
      const t = y.terms[i - 1] || {};
      $(`t${i}Start`).value = t.startDate || "";
      $(`t${i}End`).value = t.endDate || "";
      $(`t${i}MidStart`).value = t.midtermStart || "";
      $(`t${i}MidEnd`).value = t.midtermEnd || "";
      $(`t${i}Reopen`).value = t.reopenDate || "";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("yearForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const old = $("yearOriginalId").value,
      name = $("yearName").value.trim();
    if (!name) {
      toast("Enter an academic year name.");
      return;
    }
    const terms = [];
    for (let i = 1; i <= 3; i++)
      terms.push({
        name: ["First Term", "Second Term", "Third Term"][i - 1],
        startDate: $(`t${i}Start`).value,
        endDate: $(`t${i}End`).value,
        midtermStart: $(`t${i}MidStart`).value,
        midtermEnd: $(`t${i}MidEnd`).value,
        reopenDate: $(`t${i}Reopen`).value,
      });
    if (
      terms.some(
        (t) => t.midtermStart && t.midtermEnd && t.midtermEnd < t.midtermStart,
      )
    ) {
      toast("A midterm end date cannot be before its start date.");
      return;
    }
    const y = {
      id: old || name,
      name,
      startDate: $("yearStart").value,
      endDate: $("yearEnd").value,
      active: $("yearActive").checked,
      terms,
    };
    if (
      db.years.some(
        (x) => x.id !== old && x.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      toast("That academic year already exists.");
      return;
    }
    if (y.active) db.years.forEach((x) => (x.active = false));
    const ix = db.years.findIndex((x) => x.id === old);
    if (ix >= 0) {
      if (old !== name) {
        db.events.forEach((ev) => {
          if (ev.yearId === old) ev.yearId = name;
        });
      }
      db.years[ix] = y;
    } else db.years.push(y);
    addMidtermEvents(y);
    save();
    $("yearForm").reset();
    $("yearOriginalId").value = "";
    $("yearActive").checked = true;
    toast("Academic year saved.");
  });
  $("eventForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = $("eventDate").value,
      yearId = $("eventYear").value;
    if (
      db.events.some(
        (ev) => ev.date === date && ev.id !== $("eventForm").dataset.editId,
      )
    ) {
      toast("A calendar entry already exists for this date.");
      return;
    }
    const editId = $("eventForm").dataset.editId;
    const ev = {
      id: editId || date,
      date,
      yearId,
      type: $("eventType").value,
      title: $("eventTitle").value.trim(),
      reason: $("eventReason").value.trim(),
    };
    if (editId) {
      const ix = db.events.findIndex((x) => x.id === editId);
      if (ix >= 0) db.events[ix] = ev;
      delete $("eventForm").dataset.editId;
    } else db.events.push(ev);
    save();
    $("eventForm").reset();
    toast("Calendar entry saved.");
  });
  function renderEvents() {
    const yearId =
      $("calendarYearFilter").value || db.years.find((y) => y.active)?.id;
    const rows = db.events
      .filter((e) => !yearId || e.yearId === yearId)
      .sort((a, b) => a.date.localeCompare(b.date));
    $("eventTable").innerHTML =
      rows
        .map(
          (ev) =>
            `<tr><td>${dateLabel(ev.date)}</td><td>${esc(ev.type)}</td><td>${esc(ev.title)}</td><td>${esc(ev.reason || "—")}</td><td><div class="action-group"><button data-edit-event="${ev.id}">Edit</button><button class="btn-danger" data-del-event="${ev.id}">Delete</button></div></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="5" class="empty-state">No calendar entries for this academic year.</td></tr>';
    document.querySelectorAll("[data-del-event]").forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("Delete this calendar entry?")) {
            db.events = db.events.filter((x) => x.id !== b.dataset.delEvent);
            save();
          }
        }),
    );
    document.querySelectorAll("[data-edit-event]").forEach(
      (b) =>
        (b.onclick = () => {
          const ev = db.events.find((x) => x.id === b.dataset.editEvent);
          if (!ev) return;
          $("eventDate").value = ev.date;
          $("eventYear").value = ev.yearId;
          $("eventType").value = ev.type;
          $("eventTitle").value = ev.title;
          $("eventReason").value = ev.reason || "";
          $("eventForm").dataset.editId = ev.id;
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
          });
        }),
    );
  }
  $("calendarYearFilter").addEventListener("change", renderEvents);

  function inTerm(date, year, termName) {
    const term = year.terms.find((t) => t.name === termName);
    if (!term || !term.startDate || !term.endDate) return true;
    return date >= term.startDate && date <= term.endDate;
  }
  function isWorkingDate(date, year) {
    const day = new Date(date + "T00:00:00").getDay();
    let working = day !== 0 && day !== 6;
    const ev = db.events.find((e) => e.date === date);
    if (ev) {
      working = ev.type === "Special Working Day";
    }
    return working;
  }
  function datesBetween(start, end) {
    const out = [];
    if (!start || !end) return out;
    let d = new Date(start + "T00:00:00"),
      last = new Date(end + "T00:00:00");
    while (d <= last) {
      out.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function calculate() {
    const year = db.years.find((y) => y.id === $("calcYear").value);
    if (!year) {
      $("calcTable").innerHTML =
        '<tr><td colspan="10" class="empty-state">Create or select an academic year.</td></tr>';
      return;
    }
    let dates = datesBetween(year.startDate, year.endDate);
    if (!dates.length) {
      dates = db.events.filter((e) => e.yearId === year.id).map((e) => e.date);
      db.records.forEach((r) => {
        if (r.date.startsWith(year.name.slice(0, 4))) dates.push(r.date);
      });
      dates = [...new Set(dates)].sort();
    }
    const term = $("calcTerm").value;
    if (term) dates = dates.filter((d) => inTerm(d, year, term));
    const working = dates.filter((d) => isWorkingDate(d, year));
    let teachers = activeTeachers();
    const only = $("calcTeacher").value;
    if (only) teachers = teachers.filter((t) => t.id === only);
    let totalPresent = 0,
      totalLate = 0,
      totalAbsent = 0,
      totalUnrecorded = 0,
      teacherRows = [];
    teachers.forEach((t) => {
      let p = 0,
        l = 0,
        a = 0,
        perm = 0,
        sick = 0,
        duty = 0,
        u = 0;
      working.forEach((d) => {
        const r = db.records.find((x) => x.teacherId === t.id && x.date === d);
        const s = db.statuses.find((x) => x.teacherId === t.id && x.date === d);
        if (r) {
          if (isLate(r.arrivalTime)) l++;
          else p++;
        } else if (s) {
          if (s.status === "Absent") a++;
          else if (s.status === "Permission") perm++;
          else if (s.status === "Sick Leave") sick++;
          else if (s.status === "Official Duty") duty++;
        } else u++;
      });
      const expected = working.length;
      const pct = expected ? ((p + l) / expected) * 100 : 0;
      totalPresent += p;
      totalLate += l;
      totalAbsent += a;
      totalUnrecorded += u;
      teacherRows.push({
        name: t.name,
        expected,
        p,
        l,
        a,
        perm,
        sick,
        duty,
        u,
        pct,
      });
    });
    $("calculatorSummary").innerHTML = [
      ["Expected teacher-days", working.length * teachers.length],
      ["Present", totalPresent],
      ["Late", totalLate],
      ["Absent", totalAbsent],
    ]
      .map(
        ([k, v]) =>
          `<article class="stat-card"><span>${k}</span><strong>${v}</strong></article>`,
      )
      .join("");
    $("calcTable").innerHTML =
      teacherRows
        .map(
          (r) =>
            `<tr><td>${esc(r.name)}</td><td>${r.expected}</td><td>${r.p}</td><td>${r.l}</td><td>${r.a}</td><td>${r.perm}</td><td>${r.sick}</td><td>${r.duty}</td><td>${r.u}</td><td><strong>${r.pct.toFixed(1)}%</strong></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="10" class="empty-state">No active teachers registered.</td></tr>';
  }
  ["calcYear", "calcTerm", "calcTeacher"].forEach((id) =>
    $(id).addEventListener("change", calculate),
  );

  function refreshDashboard() {
    const active = activeTeachers(),
      t = today(),
      todayRows = db.records.filter((r) => r.date === t);
    $("dashTeachers").textContent = active.length;
    $("dashToday").textContent = todayRows.length;
    $("dashLate").textContent = todayRows.filter((r) =>
      isLate(r.arrivalTime),
    ).length;
    $("dashPending").textContent = db.scans.length;
    $("dashRecent").innerHTML =
      db.records
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6)
        .map(
          (r) =>
            `<tr><td>${dateLabel(r.date)}</td><td>${esc(teacherName(r.teacherId))}</td><td>${r.arrivalTime}</td><td>${statusFor(r)}</td><td>${r.departureTime || "—"}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="5" class="empty-state">No attendance records yet.</td></tr>';
  }
  function refreshAll() {
    fillTeacherSelect("reviewTeacher");
    fillTeacherSelect("absenceTeacher");
    fillTeacherSelect("individualTeacher");
    fillTeacherSelect("calcTeacher", true);
    renderTeachers();
    renderScans();
    renderRecords();
    renderAbsences();
    renderYears();
    refreshDashboard();
    renderIndividual();
    renderSchoolReport();
    calculate();
  }
  $("backupBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "SROSE-attendance-backup-" + today() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Backup downloaded.");
  };
  $("restoreFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const imported = JSON.parse(r.result);
        if (
          !imported ||
          !Array.isArray(imported.teachers) ||
          !Array.isArray(imported.records)
        )
          throw Error();
        if (
          !confirm(
            "Restore this backup? Current browser data will be replaced.",
          )
        )
          return;
        db = { ...blank(), ...imported };
        save();
        toast("Backup restored.");
      } catch (err) {
        toast("Invalid backup file.");
      }
    };
    r.readAsText(f);
  });
  $("saveSettings").onclick = () => {
    db.settings.schoolName =
      $("settingSchool").value.trim() || blank().settings.schoolName;
    db.settings.lateThreshold = $("settingLate").value || "07:20";
    save();
    toast("Settings saved.");
  };
  $("settingSchool").value = db.settings.schoolName;
  $("settingLate").value = db.settings.lateThreshold;
  function refreshAll() {
    fillTeacherSelect("reviewTeacher");
    fillTeacherSelect("absenceTeacher");
    fillTeacherSelect("individualTeacher");
    fillTeacherSelect("calcTeacher", true);
    renderTeachers();
    renderScans();
    renderRecords();
    renderAbsences();
    renderYears();
    refreshDashboard();
    renderIndividual();
    renderSchoolReport();
    calculate();
  }
  refreshAll();
})();




// MOBILE NAVIGATION TOGGLE
document.addEventListener("DOMContentLoaded", function () {
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.querySelector(".sidebar");

    if (!menuToggle || !sidebar) return;

    menuToggle.addEventListener("click", function () {
        sidebar.classList.toggle("open");

        menuToggle.setAttribute(
            "aria-expanded",
            sidebar.classList.contains("open")
        );
    });

    document.addEventListener("click", function (event) {
        if (
            window.innerWidth <= 800 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            sidebar.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
        }
    });
});
