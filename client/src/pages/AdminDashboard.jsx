import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { cfg } from "../services/config";
import {
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
  Tabs,
  TabList,
  Tab,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Button,
  Modal,
  ToastNotification,
  InlineNotification,
  Form,
  TextInput,
  Select,
  SelectItem,
  NumberInput,
} from "@carbon/react";
import { UserAvatar, Task, Money, View, TrashCan } from "@carbon/icons-react";
import SearchAutocomplete from "../components/SearchAutocomplete";
import "../styles/pages/admin-dashboard.css";

function fmtMoney(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "";
  return `$${Number(v).toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function fmtLocation(loc) {
  if (!loc) return "";
  if (typeof loc === "string") return loc;

  const address = loc.address ? String(loc.address) : "";
  const lat = typeof loc.lat === "number" ? loc.lat.toFixed(4) : "";
  const lng = typeof loc.lng === "number" ? loc.lng.toFixed(4) : "";

  if (address && (lat || lng)) return `${address} (${lat}, ${lng})`;
  return address || (lat || lng ? `${lat}, ${lng}` : "");
}

function contains(haystack, needle) {
  return String(haystack ?? "")
    .toLowerCase()
    .includes(String(needle ?? "").toLowerCase());
}

function filterRows(rows, q, fields) {
  if (!q) return rows;
  return rows.filter((r) => fields.some((f) => contains(r[f], q)));
}

function SimpleTable({
  title,
  subtitle,
  headers,
  rawRows,
  searchFields,
  onViewRow,
  onDeleteRow,
}) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const filtered = filterRows(rawRows, query, searchFields);
    return filtered.map((r) => ({ ...r, id: String(r.id) }));
  }, [rawRows, query, searchFields]);

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2 className="admin-section__title">{title}</h2>
        {subtitle ? (
          <p className="admin-section__subtitle">{subtitle}</p>
        ) : null}
      </div>

      <DataTable rows={rows} headers={headers} isSortable>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getTableContainerProps,
        }) => (
          <div {...getTableContainerProps()}>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                />
              </TableToolbarContent>
            </TableToolbar>

            <Table {...getTableProps()} size="lg" useZebraStyles>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader
                      key={header.key}
                      {...getHeaderProps({ header })}
                    >
                      {header.header}
                    </TableHeader>
                  ))}
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}

                    <TableCell>
                      <div className="admin-table-actions">
                        <Button
                          kind="ghost"
                          size="sm"
                          renderIcon={View}
                          onClick={() =>
                            onViewRow?.(
                              rawRows.find(
                                (r) => String(r.id) === String(row.id),
                              ),
                            )
                          }
                        >
                          View
                        </Button>
                        <Button
                          kind="danger--ghost"
                          size="sm"
                          renderIcon={TrashCan}
                          onClick={() =>
                            onDeleteRow?.(
                              rawRows.find(
                                (r) => String(r.id) === String(row.id),
                              ),
                            )
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length + 1}>
                      <InlineNotification
                        kind="info"
                        title="No results"
                        subtitle="Try a different search query."
                        lowContrast
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTable>
    </div>
  );
}

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [bids, setBids] = useState([]);
  const [activeTab, setActiveTab] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState({
    open: false,
    title: "",
    body: "",
    onConfirm: null,
  });

  const [view, setView] = useState({
    open: false,
    title: "",
    entity: null,
    id: null,
    loading: false,
    saving: false,
    error: "",
    form: {
      uid: "",
      email: "",
      firstName: "",
      lastName: "",
      userType: "",
      emailVerification: "",
      kycStatus: "",
      jobId: "",
      jobTitle: "",
      jobDescription: "",
      jobBudget: "",
      jobStatus: "",
      jobPosterId: "",
      jobAddress: "",
      jobLat: 0,
      jobLng: 0,
      bidId: "",
      bidAmount: "",
      bidStatus: "",
      bidNote: "",
      bidStatusNote: "",
      bidProviderId: "",
      bidContractorId: "",
      bidJobId: "",
      bidClosedAt: "",
    },
    raw: null,
  });

  const sideNavWidth = 220;

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setLoadError("");

        const [u, j, b] = await Promise.all([
          api.adminUsersList(),
          api.adminJobsList(),
          api.adminBidsList(),
        ]);

        if (!alive) return;

        setUsers(u?.users || []);
        setJobs(j?.jobs || []);
        setBids(b?.bids || []);
      } catch (e) {
        if (!alive) return;
        setLoadError(
          e?.data?.error ||
            e?.data?.detail ||
            e?.message ||
            "Failed to load admin data.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const refreshActiveTab = async () => {
    try {
      setLoading(true);
      setLoadError("");

      if (activeTab === 0) {
        const u = await api.adminUsersList();
        setUsers(u?.users || []);
      } else if (activeTab === 1) {
        const j = await api.adminJobsList();
        setJobs(j?.jobs || []);
      } else if (activeTab === 2) {
        const b = await api.adminBidsList();
        setBids(b?.bids || []);
      }
    } catch (e) {
      setLoadError(
        e?.data?.error ||
          e?.data?.detail ||
          e?.message ||
          "Failed to refresh data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const usersHeaders = useMemo(
    () => [
      { key: "uid", header: "UID" },
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "userType", header: "Role" },
      { key: "emailVerification", header: "Email Verification" },
      { key: "kycStatus", header: "KYC" },
      { key: "createdAt", header: "Created" },
    ],
    [],
  );

  const usersRows = useMemo(
    () =>
      users.map((u) => ({
        id: u.uid,
        uid: u.uid,
        name:
          [u.firstName, u.lastName].filter(Boolean).join(" ") || "(no name)",
        email: u.email,
        userType: u.userType,
        emailVerification: u.emailVerification,
        kycStatus: u.kycStatus,
        createdAt: fmtDate(u.createdAt),
      })),
    [users],
  );

  const jobsHeaders = useMemo(
    () => [
      { key: "id", header: "Job ID" },
      { key: "title", header: "Title" },
      { key: "posterId", header: "Poster UID" },
      { key: "budgetAmount", header: "Budget" },
      { key: "location", header: "Location" },
      { key: "status", header: "Status" },
      { key: "createdAt", header: "Created" },
    ],
    [],
  );

  const jobsRows = useMemo(
    () =>
      jobs.map((j) => ({
        id: j.id,
        title: j.title,
        posterId: j.posterId,
        budgetAmount: fmtMoney(j.budgetAmount),
        location: fmtLocation(j.location),
        status: j.status,
        createdAt: fmtDate(j.createdAt),
      })),
    [jobs],
  );

  const bidsHeaders = useMemo(
    () => [
      { key: "id", header: "Bid ID" },
      { key: "jobId", header: "Job ID" },
      { key: "contractorId", header: "Contractor UID" },
      { key: "providerId", header: "Bidder UID" },
      { key: "amount", header: "Amount" },
      { key: "status", header: "Status" },
      { key: "bidCreatedAt", header: "Created" },
    ],
    [],
  );

  const bidsRows = useMemo(
    () =>
      bids.map((b) => ({
        id: b.id,
        jobId: b.jobId,
        contractorId: b.contractorId,
        providerId: b.providerId,
        amount: fmtMoney(b.amount),
        status: b.status,
        bidCreatedAt: fmtDate(b.bidCreatedAt),
      })),
    [bids],
  );

  const openUserEditor = async (row) => {
    if (!row) return;
    const uid = row.uid ?? row.id;
    if (!uid) return;

    setView((v) => ({
      ...v,
      open: true,
      title: "Edit User",
      entity: "User",
      id: uid,
      loading: true,
      saving: false,
      error: "",
      raw: row,
      form: {
        ...v.form,
        uid: String(uid),
        email: row.email ?? "",
        firstName: "",
        lastName: "",
        userType: row.userType ?? "",
        emailVerification: row.emailVerification ?? "",
        kycStatus: row.kycStatus ?? "",
      },
    }));

    try {
      const res = await api.adminUserGet(uid);
      const u = res?.user || {};
      setView((v) => ({
        ...v,
        loading: false,
        raw: u,
        form: {
          ...v.form,
          uid: String(u.uid ?? uid),
          email: u.email ?? "",
          firstName: u.firstName ?? "",
          lastName: u.lastName ?? "",
          userType: u.userType ?? "",
          emailVerification: u.emailVerification ?? "",
          kycStatus: u.kycStatus ?? "",
        },
      }));
    } catch (e) {
      setView((v) => ({
        ...v,
        loading: false,
        error:
          e?.data?.error ||
          e?.data?.detail ||
          e?.message ||
          "Failed to load user.",
      }));
    }
  };

  const openJobEditor = async (row) => {
    if (!row) return;
    const jobId = row.id;
    if (!jobId) return;

    setView((v) => ({
      ...v,
      open: true,
      title: "Edit Job",
      entity: "Job",
      id: jobId,
      loading: true,
      saving: false,
      error: "",
      raw: row,
      form: {
        ...v.form,
        jobId: String(jobId),
        jobTitle: row.title ?? "",
        jobDescription: "",
        jobBudget: String(row.budgetAmount ?? "").replace(/[^0-9.]/g, ""),
        jobStatus: row.status ?? "",
        jobPosterId: row.posterId ?? "",
        jobAddress: "",
        jobLat: 0,
        jobLng: 0,
      },
    }));

    try {
      const res = await api.adminJobGet(jobId);
      const j = res?.job || {};
      const loc = j.location || {};
      setView((v) => ({
        ...v,
        loading: false,
        raw: j,
        form: {
          ...v.form,
          jobId: String(j.id ?? jobId),
          jobTitle: j.title ?? "",
          jobDescription: j.description ?? "",
          jobBudget:
            j.budgetAmount === null || j.budgetAmount === undefined
              ? ""
              : String(j.budgetAmount),
          jobStatus: j.status ?? "",
          jobPosterId: j.posterId ?? "",
          jobAddress: typeof loc === "string" ? loc : (loc.address ?? ""),
          jobLat:
            typeof loc === "object" && typeof loc.lat === "number"
              ? loc.lat
              : 0,
          jobLng:
            typeof loc === "object" && typeof loc.lng === "number"
              ? loc.lng
              : 0,
        },
      }));
    } catch (e) {
      setView((v) => ({
        ...v,
        loading: false,
        error:
          e?.data?.error ||
          e?.data?.detail ||
          e?.message ||
          "Failed to load job.",
      }));
    }
  };

  const openBidEditor = async (row) => {
    if (!row) return;
    const bidId = row.id;
    if (!bidId) return;

    setView((v) => ({
      ...v,
      open: true,
      title: "Edit Bid",
      entity: "Bid",
      id: bidId,
      loading: true,
      saving: false,
      error: "",
      raw: row,
      form: {
        ...v.form,
        bidId: String(bidId),
        bidAmount:
          row.amount === null || row.amount === undefined
            ? ""
            : String(row.amount).replace(/[^0-9.]/g, ""),
        bidStatus: row.status ?? "",
        bidNote: "",
        bidStatusNote: "",
        bidProviderId: row.providerId ?? "",
        bidContractorId: row.contractorId ?? "",
        bidJobId: row.jobId ?? "",
        bidClosedAt: row.bidClosedAt ?? "",
      },
    }));

    try {
      const res = await api.adminBidGet(bidId);
      const b = res?.bid || {};
      setView((v) => ({
        ...v,
        loading: false,
        raw: b,
        form: {
          ...v.form,
          bidId: String(b.id ?? bidId),
          bidAmount:
            b.amount === null || b.amount === undefined ? "" : String(b.amount),
          bidStatus: b.status ?? "",
          bidNote: b.note ?? "",
          bidStatusNote: b.statusNote ?? "",
          bidProviderId: b.providerId ?? "",
          bidContractorId: b.contractorId ?? "",
          bidJobId: b.jobId ?? "",
          bidClosedAt: b.bidClosedAt ?? "",
        },
      }));
    } catch (e) {
      setView((v) => ({
        ...v,
        loading: false,
        error:
          e?.data?.error ||
          e?.data?.detail ||
          e?.message ||
          "Failed to load bid.",
      }));
    }
  };

  const saveUserEdits = async () => {
    if (view.entity !== "User" || !view.id) return;
    try {
      setView((v) => ({ ...v, saving: true, error: "" }));

      const payload = {
        email: view.form.email,
        firstName: view.form.firstName,
        lastName: view.form.lastName,
        userType: view.form.userType,
        emailVerification: view.form.emailVerification,
        kycStatus: view.form.kycStatus,
      };

      const res = await api.adminUserUpdate(view.id, payload);
      const updated = res?.user || {};

      setUsers((prev) =>
        prev.map((u) => (u.uid === view.id ? { ...u, ...updated } : u)),
      );

      setToast({ kind: "success", title: "Updated", subtitle: "User saved." });
      window.setTimeout(() => setToast(null), 2500);

      setView((v) => ({ ...v, saving: false, open: false }));
    } catch (e) {
      setView((v) => ({
        ...v,
        saving: false,
        error:
          e?.data?.error ||
          e?.data?.detail ||
          e?.message ||
          "Failed to update user.",
      }));
    }
  };

  const saveJobEdits = async () => {
    if (view.entity !== "Job" || !view.id) return;
    try {
      setView((v) => ({ ...v, saving: true, error: "" }));

      const budgetNum =
        view.form.jobBudget === "" ? null : Number(view.form.jobBudget);

      const payload = {
        title: view.form.jobTitle,
        description: view.form.jobDescription,
        budgetAmount: Number.isFinite(budgetNum) ? budgetNum : null,
        status: view.form.jobStatus,
        posterId: view.form.jobPosterId,
      };

      if (cfg.prototype) {
        payload.location = {
          address: view.form.jobAddress || "",
          lat: Number(view.form.jobLat) || 0,
          lng: Number(view.form.jobLng) || 0,
        };
      } else {
        payload.location =
          view.form.jobAddress ||
          (view.raw?.location ? fmtLocation(view.raw.location) : "");
      }

      const res = await api.adminJobUpdate(view.id, payload);
      const updated = res?.job || {};

      setJobs((prev) => prev.map((j) => (j.id === view.id ? updated : j)));

      setToast({ kind: "success", title: "Updated", subtitle: "Job saved." });
      window.setTimeout(() => setToast(null), 2500);

      setView((v) => ({ ...v, saving: false, open: false }));
    } catch (e) {
      setView((v) => ({
        ...v,
        saving: false,
        error:
          e?.data?.error ||
          e?.data?.detail ||
          e?.message ||
          "Failed to update job.",
      }));
    }
  };

  const saveBidEdits = async () => {
    if (view.entity !== "Bid" || !view.id) return;
    try {
      setView((v) => ({ ...v, saving: true, error: "" }));

      const amountNum =
        view.form.bidAmount === "" ? null : Number(view.form.bidAmount);

      const payload = {
        amount: Number.isFinite(amountNum) ? amountNum : null,
        status: view.form.bidStatus,
        note: view.form.bidNote,
        statusNote: view.form.bidStatusNote,
        providerId: view.form.bidProviderId,
        contractorId: view.form.bidContractorId,
        jobId: view.form.bidJobId,
        bidClosedAt: view.form.bidClosedAt || null,
      };

      const res = await api.adminBidUpdate(view.id, payload);
      const updated = res?.bid || {};

      setBids((prev) => prev.map((b) => (b.id === view.id ? updated : b)));

      setToast({ kind: "success", title: "Updated", subtitle: "Bid saved." });
      window.setTimeout(() => setToast(null), 2500);

      setView((v) => ({ ...v, saving: false, open: false }));
    } catch (e) {
      setView((v) => ({
        ...v,
        saving: false,
        error:
          e?.data?.error ||
          e?.data?.detail ||
          e?.message ||
          "Failed to update bid.",
      }));
    }
  };

  const doDelete = async (entityName, row) => {
    if (!row) return;

    try {
      if (entityName === "User") {
        await api.adminUserDelete(row.uid ?? row.id);
        setUsers((prev) => prev.filter((u) => u.uid !== (row.uid ?? row.id)));
      } else if (entityName === "Job") {
        await api.adminJobDelete(row.id);
        setJobs((prev) => prev.filter((j) => j.id !== row.id));
        setBids((prev) => prev.filter((b) => b.jobId !== row.id));
      } else if (entityName === "Bid") {
        await api.adminBidDelete(row.id);
        setBids((prev) => prev.filter((b) => b.id !== row.id));
      }

      setToast({
        kind: "success",
        title: "Deleted",
        subtitle: `${entityName} removed.`,
      });
      window.setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast({
        kind: "error",
        title: "Delete failed",
        subtitle:
          e?.data?.error || e?.data?.detail || e?.message || "Unknown error",
      });
      window.setTimeout(() => setToast(null), 3500);
    }
  };

  const onDelete = (entityName, row) => {
    if (!row) return;

    setModal({
      open: true,
      title: `Delete ${entityName}?`,
      body: `This will delete the record.\n\nID: ${
        row.id ?? row.uid ?? "(unknown)"
      }`,
      onConfirm: async () => {
        setModal((m) => ({ ...m, open: false }));
        await doDelete(entityName, row);
      },
    });
  };

  const handlePlaceSelection = (place) => {
    if (!place) return;
    setView((v) => ({
      ...v,
      form: {
        ...v.form,
        jobAddress: place.address || place.formatted_address || "",
        jobLat: typeof place.lat === "number" ? place.lat : v.form.jobLat,
        jobLng: typeof place.lng === "number" ? place.lng : v.form.jobLng,
      },
    }));
  };

  return (
    <>
      <div className="admin-layout">
        <SideNav
          aria-label="Admin navigation"
          expanded
          className="admin-sidenav"
          style={{ width: sideNavWidth }}
        >
          <SideNavItems>
            <SideNavLink
              renderIcon={UserAvatar}
              onClick={() => setActiveTab(0)}
            >
              Users
            </SideNavLink>
            <SideNavLink renderIcon={Task} onClick={() => setActiveTab(1)}>
              Jobs
            </SideNavLink>
            <SideNavLink renderIcon={Money} onClick={() => setActiveTab(2)}>
              Bids
            </SideNavLink>
          </SideNavItems>
        </SideNav>

        <Content className="admin-content">
          {toast ? (
            <div className="admin-toast">
              <ToastNotification
                kind={toast.kind}
                title={toast.title}
                subtitle={toast.subtitle}
                timeout={2500}
                onCloseButtonClick={() => setToast(null)}
              />
            </div>
          ) : null}

          {loadError ? (
            <div className="admin-inline-error">
              <InlineNotification
                kind="error"
                title="Admin load failed"
                subtitle={loadError}
                lowContrast
              />
            </div>
          ) : null}

          <div className="admin-tabs-row">
            <Tabs
              selectedIndex={activeTab}
              onChange={(event, { selectedIndex }) =>
                setActiveTab(selectedIndex)
              }
            >
              <TabList aria-label="Admin sections">
                <Tab>Users</Tab>
                <Tab>Jobs</Tab>
                <Tab>Bids</Tab>
              </TabList>
            </Tabs>

            <Button
              kind="secondary"
              size="sm"
              className="admin-refresh-btn"
              disabled={loading}
              onClick={refreshActiveTab}
            >
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>

          {activeTab === 0 && (
            <SimpleTable
              title="Users"
              subtitle="Manage accounts."
              headers={usersHeaders}
              rawRows={usersRows}
              searchFields={[
                "uid",
                "name",
                "email",
                "userType",
                "emailVerification",
                "kycStatus",
              ]}
              onViewRow={(row) => openUserEditor(row)}
              onDeleteRow={(row) => onDelete("User", row)}
            />
          )}

          {activeTab === 1 && (
            <SimpleTable
              title="Jobs"
              subtitle="Moderate job posts."
              headers={jobsHeaders}
              rawRows={jobsRows}
              searchFields={["id", "title", "posterId", "location", "status"]}
              onViewRow={(row) => openJobEditor(row)}
              onDeleteRow={(row) => onDelete("Job", row)}
            />
          )}

          {activeTab === 2 && (
            <SimpleTable
              title="Bids"
              subtitle="Review bids and activity."
              headers={bidsHeaders}
              rawRows={bidsRows}
              searchFields={[
                "id",
                "jobId",
                "contractorId",
                "providerId",
                "status",
              ]}
              onViewRow={(row) => openBidEditor(row)}
              onDeleteRow={(row) => onDelete("Bid", row)}
            />
          )}
        </Content>
      </div>

      <Modal
        open={view.open}
        modalHeading={view.title}
        primaryButtonText={view.entity ? "Save" : "Close"}
        secondaryButtonText="Cancel"
        onRequestClose={() =>
          setView((v) => ({
            ...v,
            open: false,
            error: "",
            saving: false,
            loading: false,
          }))
        }
        onRequestSubmit={() => {
          if (view.entity === "User") return saveUserEdits();
          if (view.entity === "Job") return saveJobEdits();
          if (view.entity === "Bid") return saveBidEdits();
          setView((v) => ({ ...v, open: false }));
        }}
        primaryButtonDisabled={view.loading || view.saving}
      >
        {view.error ? (
          <InlineNotification
            kind="error"
            title="Save failed"
            subtitle={view.error}
            lowContrast
          />
        ) : null}

        {view.loading ? (
          <InlineNotification
            kind="info"
            title="Loading…"
            subtitle="Fetching latest details."
            lowContrast
          />
        ) : view.entity === "User" ? (
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              saveUserEdits();
            }}
          >
            <TextInput
              id="admin-user-uid"
              labelText="UID"
              value={view.form.uid}
              disabled
            />

            <TextInput
              id="admin-user-email"
              labelText="Email"
              value={view.form.email}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, email: e.target.value },
                }))
              }
            />

            <div className="job-form-grid">
              <TextInput
                id="admin-user-first"
                labelText="First name"
                value={view.form.firstName}
                onChange={(e) =>
                  setView((v) => ({
                    ...v,
                    form: { ...v.form, firstName: e.target.value },
                  }))
                }
              />
              <TextInput
                id="admin-user-last"
                labelText="Last name"
                value={view.form.lastName}
                onChange={(e) =>
                  setView((v) => ({
                    ...v,
                    form: { ...v.form, lastName: e.target.value },
                  }))
                }
              />
            </div>

            <Select
              id="admin-user-role"
              labelText="Role"
              value={view.form.userType || ""}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, userType: e.target.value },
                }))
              }
            >
              <SelectItem value="admin" text="admin" />
              <SelectItem value="contractor" text="contractor" />
              <SelectItem value="bidder" text="bidder" />
            </Select>

            <Select
              id="admin-user-email-verification"
              labelText="Email verification"
              value={view.form.emailVerification || ""}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, emailVerification: e.target.value },
                }))
              }
            >
              <SelectItem value="verified" text="verified" />
              <SelectItem value="pending" text="pending" />
            </Select>

            <Select
              id="admin-user-kyc"
              labelText="KYC status"
              value={view.form.kycStatus || ""}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, kycStatus: e.target.value },
                }))
              }
            >
              <SelectItem value="pending" text="pending" />
              <SelectItem value="verified" text="verified" />
              <SelectItem value="rejected" text="rejected" />
            </Select>

            <button type="submit" style={{ display: "none" }} />
          </Form>
        ) : view.entity === "Job" ? (
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              saveJobEdits();
            }}
          >
            <TextInput
              id="admin-job-id"
              labelText="Job ID"
              value={view.form.jobId}
              disabled
            />

            <TextInput
              id="admin-job-title"
              labelText="Title"
              value={view.form.jobTitle}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, jobTitle: e.target.value },
                }))
              }
              required
            />

            <TextInput
              id="admin-job-desc"
              labelText="Description"
              value={view.form.jobDescription}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, jobDescription: e.target.value },
                }))
              }
            />

            <TextInput
              id="admin-job-budget"
              type="text"
              labelText="Budget"
              value={view.form.jobBudget}
              onChange={(e) => {
                const raw = e.target.value;
                const cleaned = raw.replace(/[^0-9.]/g, "");
                const normalized = cleaned.replace(/^0+(?=\d)/, "");
                setView((v) => ({
                  ...v,
                  form: { ...v.form, jobBudget: normalized },
                }));
              }}
            />

            <TextInput
              id="admin-job-poster"
              labelText="Poster UID"
              value={view.form.jobPosterId}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, jobPosterId: e.target.value },
                }))
              }
            />

            <Select
              id="admin-job-status"
              labelText="Status"
              value={view.form.jobStatus || ""}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, jobStatus: e.target.value },
                }))
              }
            >
              <SelectItem value="open" text="open" />
              <SelectItem value="closed" text="closed" />
              <SelectItem value="awarded" text="awarded" />
              <SelectItem value="cancelled" text="cancelled" />
            </Select>

            {cfg.prototype ? (
              <div className="job-form-grid">
                <NumberInput
                  id="admin-job-lat"
                  label="Latitude"
                  value={view.form.jobLat}
                  onChange={(_, { value }) =>
                    setView((v) => ({
                      ...v,
                      form: { ...v.form, jobLat: Number(value) },
                    }))
                  }
                />
                <NumberInput
                  id="admin-job-lng"
                  label="Longitude"
                  value={view.form.jobLng}
                  onChange={(_, { value }) =>
                    setView((v) => ({
                      ...v,
                      form: { ...v.form, jobLng: Number(value) },
                    }))
                  }
                />
              </div>
            ) : (
              <div className="job-location-search-container">
                <SearchAutocomplete onSelectPlace={handlePlaceSelection} />
                <div>Selected location: {view.form.jobAddress}</div>
              </div>
            )}

            <button type="submit" style={{ display: "none" }} />
          </Form>
        ) : view.entity === "Bid" ? (
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              saveBidEdits();
            }}
          >
            <TextInput
              id="admin-bid-id"
              labelText="Bid ID"
              value={view.form.bidId}
              disabled
            />

            <TextInput
              id="admin-bid-amount"
              type="text"
              labelText="Amount"
              value={view.form.bidAmount}
              onChange={(e) => {
                const raw = e.target.value;
                const cleaned = raw.replace(/[^0-9.]/g, "");
                const normalized = cleaned.replace(/^0+(?=\d)/, "");
                setView((v) => ({
                  ...v,
                  form: { ...v.form, bidAmount: normalized },
                }));
              }}
            />

            <Select
              id="admin-bid-status"
              labelText="Status"
              value={view.form.bidStatus || ""}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, bidStatus: e.target.value },
                }))
              }
            >
              <SelectItem value="declined" text="declined" />
              <SelectItem value="accepted" text="accepted" />
              <SelectItem value="cancelled" text="cancelled" />
              <SelectItem value="active" text="active" />
            </Select>

            <TextInput
              id="admin-bid-note"
              labelText="Note"
              value={view.form.bidNote}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, bidNote: e.target.value },
                }))
              }
            />

            <TextInput
              id="admin-bid-provider"
              labelText="Bidder UID"
              value={view.form.bidProviderId}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, bidProviderId: e.target.value },
                }))
              }
            />

            <TextInput
              id="admin-bid-contractor"
              labelText="Contractor UID"
              value={view.form.bidContractorId}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, bidContractorId: e.target.value },
                }))
              }
            />

            <TextInput
              id="admin-bid-job"
              labelText="Job ID"
              value={view.form.bidJobId}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, bidJobId: e.target.value },
                }))
              }
            />

            <TextInput
              id="admin-bid-closedAt"
              labelText="Bid closed at (ISO)"
              value={view.form.bidClosedAt || ""}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  form: { ...v.form, bidClosedAt: e.target.value },
                }))
              }
              placeholder="2026-02-25T12:34:56.000Z"
            />

            <button type="submit" style={{ display: "none" }} />
          </Form>
        ) : null}
      </Modal>

      <Modal
        open={modal.open}
        danger
        modalHeading={modal.title}
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        onRequestClose={() => setModal((m) => ({ ...m, open: false }))}
        onRequestSubmit={() => modal.onConfirm?.()}
      >
        <pre className="admin-modal-pre">{modal.body}</pre>
      </Modal>
    </>
  );
}
