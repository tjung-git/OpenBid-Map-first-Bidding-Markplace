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
} from "@carbon/react";
import { UserAvatar, Task, Money, View, TrashCan } from "@carbon/icons-react";
import EditorModal from "../components/admin/EditorModal";
import UserEditForm from "../components/admin/UserEditForm";
import JobEditForm from "../components/admin/JobEditForm";
import BidEditForm from "../components/admin/BidEditForm";
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
                  {headers.map((header) => {
                    const headerProps = getHeaderProps({ header });
                    const { key, ...restHeaderProps } = headerProps;

                    return (
                      <TableHeader key={key ?? header.key} {...restHeaderProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}

                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.map((row) => {
                  const rowProps = getRowProps({ row });
                  const { key, ...restRowProps } = rowProps;
                  return (
                    <TableRow key={key ?? row.id} {...restRowProps}>
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
                  );
                })}

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

  const [editor, setEditor] = useState({
    open: false,
    entity: null, // "User" | "Job" | "Bid"
    id: null,
    loading: false,
    saving: false,
    error: "",
    raw: null,

    formUser: {
      uid: "",
      email: "",
      firstName: "",
      lastName: "",
      userType: "",
      emailVerification: "",
      kycStatus: "",
    },
    formJob: {
      jobId: "",
      title: "",
      description: "",
      budget: "",
      status: "",
      posterId: "",
      address: "",
      lat: 0,
      lng: 0,
    },
    formBid: {
      bidId: "",
      amount: "",
      status: "",
      note: "",
      providerId: "",
      contractorId: "",
      jobId: "",
      bidClosedAt: "",
    },
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

    setEditor((e) => ({
      ...e,
      open: true,
      entity: "User",
      id: uid,
      loading: true,
      saving: false,
      error: "",
      raw: row,
      formUser: {
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
      setEditor((e) => ({
        ...e,
        loading: false,
        raw: u,
        formUser: {
          uid: String(u.uid ?? uid),
          email: u.email ?? "",
          firstName: u.firstName ?? "",
          lastName: u.lastName ?? "",
          userType: u.userType ?? "",
          emailVerification: u.emailVerification ?? "",
          kycStatus: u.kycStatus ?? "",
        },
      }));
    } catch (err) {
      setEditor((e) => ({
        ...e,
        loading: false,
        error:
          err?.data?.error ||
          err?.data?.detail ||
          err?.message ||
          "Failed to load user.",
      }));
    }
  };

  const openJobEditor = async (row) => {
    if (!row) return;
    const jobId = row.id;
    if (!jobId) return;

    setEditor((e) => ({
      ...e,
      open: true,
      entity: "Job",
      id: jobId,
      loading: true,
      saving: false,
      error: "",
      raw: row,
      formJob: {
        jobId: String(jobId),
        title: row.title ?? "",
        description: "",
        budget: String(row.budgetAmount ?? "").replace(/[^0-9.]/g, ""),
        status: row.status ?? "",
        posterId: row.posterId ?? "",
        address: "",
        lat: 0,
        lng: 0,
      },
    }));

    try {
      const res = await api.adminJobGet(jobId);
      const j = res?.job || {};
      const loc = j.location || {};

      setEditor((e) => ({
        ...e,
        loading: false,
        raw: j,
        formJob: {
          jobId: String(j.id ?? jobId),
          title: j.title ?? "",
          description: j.description ?? "",
          budget:
            j.budgetAmount === null || j.budgetAmount === undefined
              ? ""
              : String(j.budgetAmount),
          status: j.status ?? "",
          posterId: j.posterId ?? "",
          address: typeof loc === "string" ? loc : (loc.address ?? ""),
          lat:
            typeof loc === "object" && typeof loc.lat === "number"
              ? loc.lat
              : 0,
          lng:
            typeof loc === "object" && typeof loc.lng === "number"
              ? loc.lng
              : 0,
        },
      }));
    } catch (err) {
      setEditor((e) => ({
        ...e,
        loading: false,
        error:
          err?.data?.error ||
          err?.data?.detail ||
          err?.message ||
          "Failed to load job.",
      }));
    }
  };

  const openBidEditor = async (row) => {
    if (!row) return;
    const bidId = row.id;
    if (!bidId) return;

    setEditor((e) => ({
      ...e,
      open: true,
      entity: "Bid",
      id: bidId,
      loading: true,
      saving: false,
      error: "",
      raw: row,
      formBid: {
        bidId: String(bidId),
        amount:
          row.amount === null || row.amount === undefined
            ? ""
            : String(row.amount).replace(/[^0-9.]/g, ""),
        status: row.status ?? "",
        note: "",
        providerId: row.providerId ?? "",
        contractorId: row.contractorId ?? "",
        jobId: row.jobId ?? "",
        bidClosedAt: row.bidClosedAt ?? "",
      },
    }));

    try {
      const res = await api.adminBidGet(bidId);
      const b = res?.bid || {};
      setEditor((e) => ({
        ...e,
        loading: false,
        raw: b,
        formBid: {
          bidId: String(b.id ?? bidId),
          amount:
            b.amount === null || b.amount === undefined ? "" : String(b.amount),
          status: b.status ?? "",
          note: b.note ?? "",
          providerId: b.providerId ?? "",
          contractorId: b.contractorId ?? "",
          jobId: b.jobId ?? "",
          bidClosedAt: b.bidClosedAt ?? "",
        },
      }));
    } catch (err) {
      setEditor((e) => ({
        ...e,
        loading: false,
        error:
          err?.data?.error ||
          err?.data?.detail ||
          err?.message ||
          "Failed to load bid.",
      }));
    }
  };

  const saveUserEdits = async () => {
    if (editor.entity !== "User" || !editor.id) return;

    try {
      setEditor((e) => ({ ...e, saving: true, error: "" }));

      const payload = {
        email: editor.formUser.email,
        firstName: editor.formUser.firstName,
        lastName: editor.formUser.lastName,
        userType: editor.formUser.userType,
        emailVerification: editor.formUser.emailVerification,
        kycStatus: editor.formUser.kycStatus,
      };

      const res = await api.adminUserUpdate(editor.id, payload);
      const updated = res?.user || {};

      setUsers((prev) =>
        prev.map((u) => (u.uid === editor.id ? { ...u, ...updated } : u)),
      );

      setToast({ kind: "success", title: "Updated", subtitle: "User saved." });
      window.setTimeout(() => setToast(null), 2500);

      setEditor((e) => ({ ...e, saving: false, open: false }));
    } catch (err) {
      setEditor((e) => ({
        ...e,
        saving: false,
        error:
          err?.data?.error ||
          err?.data?.detail ||
          err?.message ||
          "Failed to update user.",
      }));
    }
  };

  const saveJobEdits = async () => {
    if (editor.entity !== "Job" || !editor.id) return;

    try {
      setEditor((e) => ({ ...e, saving: true, error: "" }));

      const budgetNum =
        editor.formJob.budget === "" ? null : Number(editor.formJob.budget);

      const payload = {
        title: editor.formJob.title,
        description: editor.formJob.description,
        budgetAmount: Number.isFinite(budgetNum) ? budgetNum : null,
        status: editor.formJob.status,
        posterId: editor.formJob.posterId,
      };

      if (cfg.prototype) {
        payload.location = {
          address: editor.formJob.address || "",
          lat: Number(editor.formJob.lat) || 0,
          lng: Number(editor.formJob.lng) || 0,
        };
      } else {
        payload.location =
          editor.formJob.address ||
          (editor.raw?.location ? fmtLocation(editor.raw.location) : "");
      }

      const res = await api.adminJobUpdate(editor.id, payload);
      const updated = res?.job || {};

      setJobs((prev) => prev.map((j) => (j.id === editor.id ? updated : j)));

      setToast({ kind: "success", title: "Updated", subtitle: "Job saved." });
      window.setTimeout(() => setToast(null), 2500);

      setEditor((e) => ({ ...e, saving: false, open: false }));
    } catch (err) {
      setEditor((e) => ({
        ...e,
        saving: false,
        error:
          err?.data?.error ||
          err?.data?.detail ||
          err?.message ||
          "Failed to update job.",
      }));
    }
  };

  const saveBidEdits = async () => {
    if (editor.entity !== "Bid" || !editor.id) return;

    try {
      setEditor((e) => ({ ...e, saving: true, error: "" }));

      const amountNum =
        editor.formBid.amount === "" ? null : Number(editor.formBid.amount);

      const payload = {
        amount: Number.isFinite(amountNum) ? amountNum : null,
        status: editor.formBid.status,
        note: editor.formBid.note,
        providerId: editor.formBid.providerId,
        contractorId: editor.formBid.contractorId,
        jobId: editor.formBid.jobId,
        bidClosedAt: editor.formBid.bidClosedAt || null,
      };

      const res = await api.adminBidUpdate(editor.id, payload);
      const updated = res?.bid || {};

      setBids((prev) => prev.map((b) => (b.id === editor.id ? updated : b)));

      setToast({ kind: "success", title: "Updated", subtitle: "Bid saved." });
      window.setTimeout(() => setToast(null), 2500);

      setEditor((e) => ({ ...e, saving: false, open: false }));
    } catch (err) {
      setEditor((e) => ({
        ...e,
        saving: false,
        error:
          err?.data?.error ||
          err?.data?.detail ||
          err?.message ||
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
    } catch (err) {
      setToast({
        kind: "error",
        title: "Delete failed",
        subtitle:
          err?.data?.error ||
          err?.data?.detail ||
          err?.message ||
          "Unknown error",
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

    setEditor((e) => ({
      ...e,
      formJob: {
        ...e.formJob,
        address: place.address || place.formatted_address || "",
        lat: typeof place.lat === "number" ? place.lat : e.formJob.lat,
        lng: typeof place.lng === "number" ? place.lng : e.formJob.lng,
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
              onViewRow={openUserEditor}
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
              onViewRow={openJobEditor}
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
              onViewRow={openBidEditor}
              onDeleteRow={(row) => onDelete("Bid", row)}
            />
          )}
        </Content>
      </div>

      <EditorModal
        open={editor.open}
        title={
          editor.entity === "User"
            ? "Edit User"
            : editor.entity === "Job"
              ? "Edit Job"
              : editor.entity === "Bid"
                ? "Edit Bid"
                : "Edit"
        }
        loading={editor.loading}
        saving={editor.saving}
        error={editor.error}
        onClose={() =>
          setEditor((e) => ({
            ...e,
            open: false,
            error: "",
            saving: false,
            loading: false,
          }))
        }
        onSubmit={() => {
          if (editor.entity === "User") return saveUserEdits();
          if (editor.entity === "Job") return saveJobEdits();
          if (editor.entity === "Bid") return saveBidEdits();
        }}
      >
        {editor.entity === "User" ? (
          <UserEditForm
            value={editor.formUser}
            onChange={(next) => setEditor((e) => ({ ...e, formUser: next }))}
            onSubmit={saveUserEdits}
          />
        ) : editor.entity === "Job" ? (
          <JobEditForm
            prototype={cfg.prototype}
            value={editor.formJob}
            onChange={(next) => setEditor((e) => ({ ...e, formJob: next }))}
            onSubmit={saveJobEdits}
            onPlaceSelect={handlePlaceSelection}
          />
        ) : editor.entity === "Bid" ? (
          <BidEditForm
            value={editor.formBid}
            onChange={(next) => setEditor((e) => ({ ...e, formBid: next }))}
            onSubmit={saveBidEdits}
          />
        ) : null}
      </EditorModal>

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
