// AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
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
import "../styles/pages/admin-dashboard.css";

/* -----------------------------
 * Helpers
 * ----------------------------- */

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

function contains(haystack, needle) {
  return String(haystack ?? "")
    .toLowerCase()
    .includes(String(needle ?? "").toLowerCase());
}

function filterRows(rows, q, fields) {
  if (!q) return rows;
  return rows.filter((r) => fields.some((f) => contains(r[f], q)));
}

/* -----------------------------
 * Generic Table
 * ----------------------------- */

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
    // Carbon DataTable expects each row object to have an `id` string.
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

/* -----------------------------
 * AdminDashboard
 * ----------------------------- */

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
  const [view, setView] = useState({ open: false, title: "", body: "" });

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
      { key: "emailVerification", header: "Email" },
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
        location: j.location,
        status: j.status,
        createdAt: fmtDate(j.createdAt),
      })),
    [jobs],
  );

  const bidsHeaders = useMemo(
    () => [
      { key: "id", header: "Bid ID" },
      { key: "jobId", header: "Job ID" },
      { key: "providerId", header: "Provider UID" },
      { key: "bidderName", header: "Bidder" },
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
        providerId: b.providerId,
        bidderName: b.bidderName,
        amount: fmtMoney(b.amount),
        status: b.status,
        bidCreatedAt: fmtDate(b.bidCreatedAt),
      })),
    [bids],
  );

  const onView = (entityName, row) => {
    if (!row) return;
    setView({
      open: true,
      title: `View ${entityName}`,
      body: JSON.stringify(row, null, 2),
    });
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
      body: `This will delete the record.\n\nID: ${row.id ?? row.uid ?? "(unknown)"}`,
      onConfirm: async () => {
        setModal((m) => ({ ...m, open: false }));
        await doDelete(entityName, row);
      },
    });
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
              onViewRow={(row) => onView("User", row)}
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
              onViewRow={(row) => onView("Job", row)}
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
                "providerId",
                "bidderName",
                "status",
              ]}
              onViewRow={(row) => onView("Bid", row)}
              onDeleteRow={(row) => onDelete("Bid", row)}
            />
          )}
        </Content>
      </div>

      {/* View modal */}
      <Modal
        open={view.open}
        modalHeading={view.title}
        primaryButtonText="Close"
        onRequestClose={() => setView({ open: false, title: "", body: "" })}
        onRequestSubmit={() => setView({ open: false, title: "", body: "" })}
        secondaryButtonText={null}
      >
        <pre className="admin-modal-pre">{view.body}</pre>
      </Modal>

      {/* Delete confirm modal */}
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
