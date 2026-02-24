import React, { useMemo, useState } from "react";
import { api } from "../services/api";
import {
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
  Tabs,
  TabList,
  Tab,
  TabPanel,
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
import {
  UserAvatar,
  Task,
  Money,
  Logout,
  View,
  TrashCan,
} from "@carbon/icons-react";
import { useNavigate } from "react-router-dom";
import "../styles/pages/admin-dashboard.css";

const dummyUsers = [
  {
    uid: "u_admin",
    firstName: "OpenBid",
    lastName: "Admin",
    email: "openbidadmin@gmail.com",
    userType: "admin",
    emailVerification: "verified",
    kycStatus: "pending",
    kycSessionId: null,
    createdAt: new Date(Date.now() - 7 * 864e5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    uid: "u_openbid123",
    firstName: "OpenBid",
    lastName: "Developer",
    email: "openbid123@gmail.com",
    userType: "bidder",
    emailVerification: "verified",
    kycStatus: "pending",
    kycSessionId: null,
    createdAt: new Date(Date.now() - 22 * 864e5).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
  },
  {
    uid: "u_poster777",
    firstName: "Sam",
    lastName: "Poster",
    email: "sam.poster@example.com",
    userType: "poster",
    emailVerification: "pending",
    kycStatus: "pending",
    kycSessionId: null,
    createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 864e5).toISOString(),
  },
];

const dummyJobs = [
  {
    id: "job_1",
    posterId: "u_poster777",
    title: "Fix kitchen sink leak",
    description:
      "Leak under the sink. Need someone to replace seal and inspect pipes.",
    budgetAmount: 250,
    location: "Toronto, ON",
    status: "open",
    createdAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 864e5).toISOString(),
  },
  {
    id: "job_2",
    posterId: "u_poster777",
    title: "Paint backyard fence",
    description: "Fence needs sanding and repainting. Materials provided.",
    budgetAmount: 400,
    location: "Mississauga, ON",
    status: "open",
    createdAt: new Date(Date.now() - 6 * 864e5).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 864e5).toISOString(),
  },
  {
    id: "job_3",
    posterId: "u_openbid123",
    title: "Install smart thermostat",
    description:
      "Install Nest thermostat; wiring present but needs setup and testing.",
    budgetAmount: 180,
    location: "Milton, ON",
    status: "closed",
    createdAt: new Date(Date.now() - 15 * 864e5).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 864e5).toISOString(),
  },
];

const dummyBids = [
  {
    id: "bid_1",
    jobId: "job_1",
    providerId: "u_openbid123",
    bidderName: "OpenBid Developer",
    contractorId: "u_poster777",
    contractorName: "Sam Poster",
    jobTitle: "Fix kitchen sink leak",
    jobDescription:
      "Leak under the sink. Need someone to replace seal and inspect pipes.",
    jobBudgetAmount: 250,
    jobLocation: "Toronto, ON",
    amount: 225,
    note: "Can come tomorrow morning. Includes parts if needed (basic).",
    status: "active",
    bidCreatedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
  },
  {
    id: "bid_2",
    jobId: "job_2",
    providerId: "u_openbid123",
    bidderName: "OpenBid Developer",
    contractorId: "u_poster777",
    contractorName: "Sam Poster",
    jobTitle: "Paint backyard fence",
    jobDescription: "Fence needs sanding and repainting. Materials provided.",
    jobBudgetAmount: 400,
    jobLocation: "Mississauga, ON",
    amount: 360,
    note: "Two-day job. Prep + paint. Weather permitting.",
    status: "active",
    bidCreatedAt: new Date(Date.now() - 5 * 864e5).toISOString(),
  },
  {
    id: "bid_3",
    jobId: "job_3",
    providerId: "u_poster777",
    bidderName: "Sam Poster",
    contractorId: "u_openbid123",
    contractorName: "OpenBid Developer",
    jobTitle: "Install smart thermostat",
    jobDescription:
      "Install Nest thermostat; wiring present but needs setup and testing.",
    jobBudgetAmount: 180,
    jobLocation: "Milton, ON",
    amount: 190,
    note: "Includes setup + testing + app pairing.",
    status: "closed",
    bidCreatedAt: new Date(Date.now() - 12 * 864e5).toISOString(),
  },
];

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
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {subtitle ? (
          <p style={{ margin: "0.25rem 0 0 0", opacity: 0.8 }}>{subtitle}</p>
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
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
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
  const [users, setUsers] = useState(dummyUsers);
  const [jobs, setJobs] = useState(dummyJobs);
  const [bids, setBids] = useState(dummyBids);
  const [activeTab, setActiveTab] = useState(0);

  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState({
    open: false,
    title: "",
    body: "",
    onConfirm: null,
  });
  const [view, setView] = useState({ open: false, title: "", body: "" });

  const sideNavWidth = 220;
  const nav = useNavigate();

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

  const onDelete = (entityName, row) => {
    if (!row) return;

    setModal({
      open: true,
      title: `Delete ${entityName}?`,
      body: `This is a dummy action. It will remove the record from local state only.\n\nID: ${row.id ?? row.uid ?? "(unknown)"}`,
      onConfirm: () => {
        setModal((m) => ({ ...m, open: false }));

        if (entityName === "User") {
          setUsers((prev) =>
            prev.filter((u) => u.uid !== row.uid && u.uid !== row.id),
          );
        }
        if (entityName === "Job") {
          setJobs((prev) => prev.filter((j) => j.id !== row.id));
          // also delete related bids (nice for realism)
          setBids((prev) => prev.filter((b) => b.jobId !== row.id));
        }
        if (entityName === "Bid") {
          setBids((prev) => prev.filter((b) => b.id !== row.id));
        }

        setToast({
          kind: "success",
          title: "Deleted",
          subtitle: `${entityName} removed (dummy).`,
        });

        window.setTimeout(() => setToast(null), 2500);
      },
    });
  };

  return (
    <>
      {/* Top header */}
      {/* <Header aria-label="OpenBid Admin">
        <HeaderName prefix="OpenBid">Admin</HeaderName>

        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label="Logout"
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            <Logout />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header> */}

      {/* Sidebar + content layout */}
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <SideNav
          aria-label="Admin navigation"
          expanded
          style={{
            position: "relative",
            width: sideNavWidth,
            borderRight: "1px solid rgba(0,0,0,0.08)",
          }}
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

        <Content
          className="admin-content"
          style={{ padding: "1.5rem", flex: 1 }}
        >
          {toast ? (
            <div style={{ marginBottom: "1rem" }}>
              <ToastNotification
                kind={toast.kind}
                title={toast.title}
                subtitle={toast.subtitle}
                timeout={2500}
                onCloseButtonClick={() => setToast(null)}
              />
            </div>
          ) : null}

          <Tabs
            selectedIndex={activeTab}
            onChange={(event, { selectedIndex }) => setActiveTab(selectedIndex)}
          >
            <TabList aria-label="Admin sections">
              <Tab>Users</Tab>
              <Tab>Jobs</Tab>
              <Tab>Bids</Tab>
            </TabList>
          </Tabs>

          {activeTab === 0 && (
            <SimpleTable
              title="Users"
              subtitle="Manage accounts (dummy data)."
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
              subtitle="Moderate job posts (dummy data)."
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
              subtitle="Review bids and activity (dummy data)."
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
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{view.body}</pre>
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
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{modal.body}</pre>
      </Modal>
    </>
  );
}
