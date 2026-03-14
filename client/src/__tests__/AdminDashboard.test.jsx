import React from "react";
import { describe, it, beforeEach, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const apiMock = vi.hoisted(() => ({
  adminUsersList: vi.fn(),
  adminJobsList: vi.fn(),
  adminBidsList: vi.fn(),
  adminUserGet: vi.fn(),
  adminJobGet: vi.fn(),
  adminBidGet: vi.fn(),
  adminUserUpdate: vi.fn(),
  adminJobUpdate: vi.fn(),
  adminBidUpdate: vi.fn(),
  adminUserDelete: vi.fn(),
  adminJobDelete: vi.fn(),
  adminBidDelete: vi.fn(),
}));

vi.mock("../services/api", () => ({
  api: apiMock,
}));

vi.mock("../services/config", () => ({
  cfg: { prototype: true },
}));

vi.mock("../components/admin/EditorModal", () => {
  return {
    default: (props) => {
      if (!props.open) return null;
      return (
        <div role="dialog" aria-label={props.title || "Editor"}>
          <div>loading:{String(props.loading)}</div>
          <div>saving:{String(props.saving)}</div>
          {props.error ? <div>error:{props.error}</div> : null}
          <button onClick={props.onClose}>Close</button>
          <button onClick={props.onSubmit}>Submit</button>
          <div data-testid="editor-children">{props.children}</div>
        </div>
      );
    },
  };
});

vi.mock("../components/admin/UserEditForm", () => ({
  default: () => <div data-testid="user-form">UserEditForm</div>,
}));
vi.mock("../components/admin/JobEditForm", () => ({
  default: () => <div data-testid="job-form">JobEditForm</div>,
}));
vi.mock("../components/admin/BidEditForm", () => ({
  default: () => <div data-testid="bid-form">BidEditForm</div>,
}));

function seedApi() {
  apiMock.adminUsersList.mockResolvedValue({
    users: [
      {
        uid: "u1",
        email: "u1@test.com",
        firstName: "A",
        lastName: "User",
        userType: "admin",
        emailVerification: "verified",
        kycStatus: "verified",
        createdAt: "2026-02-25T12:00:00.000Z",
      },
    ],
  });

  apiMock.adminJobsList.mockResolvedValue({
    jobs: [
      {
        id: "j1",
        title: "Job One",
        posterId: "u1",
        budgetAmount: 100,
        location: "Toronto",
        status: "open",
        createdAt: "2026-02-25T12:00:00.000Z",
      },
    ],
  });

  apiMock.adminBidsList.mockResolvedValue({
    bids: [
      {
        id: "b1",
        jobId: "j1",
        contractorId: "c1",
        providerId: "p1",
        amount: 50,
        status: "active",
        bidCreatedAt: "2026-02-25T12:00:00.000Z",
      },
    ],
  });

  apiMock.adminUserGet.mockResolvedValue({
    user: {
      uid: "u1",
      email: "u1@test.com",
      firstName: "A",
      lastName: "User",
      userType: "admin",
      emailVerification: "verified",
      kycStatus: "verified",
    },
  });

  apiMock.adminJobGet.mockResolvedValue({
    job: {
      id: "j1",
      title: "Job One",
      description: "Desc",
      budgetAmount: 100,
      status: "open",
      posterId: "u1",
      location: { address: "Toronto", lat: 43.7, lng: -79.4 },
    },
  });

  apiMock.adminBidGet.mockResolvedValue({
    bid: {
      id: "b1",
      amount: 50,
      status: "active",
      note: "note",
      providerId: "p1",
      contractorId: "c1",
      jobId: "j1",
      bidClosedAt: null,
    },
  });

  apiMock.adminUserUpdate.mockResolvedValue({
    user: {
      uid: "u1",
      email: "u1+updated@test.com",
      firstName: "A",
      lastName: "User",
      userType: "admin",
      emailVerification: "verified",
      kycStatus: "verified",
    },
  });

  apiMock.adminJobUpdate.mockResolvedValue({
    job: {
      id: "j1",
      title: "Job One Updated",
      description: "Desc",
      budgetAmount: 100,
      status: "open",
      posterId: "u1",
      location: { address: "Toronto", lat: 43.7, lng: -79.4 },
    },
  });

  apiMock.adminBidUpdate.mockResolvedValue({
    bid: {
      id: "b1",
      amount: 55,
      status: "active",
      note: "note",
      providerId: "p1",
      contractorId: "c1",
      jobId: "j1",
      bidClosedAt: null,
    },
  });

  apiMock.adminUserDelete.mockResolvedValue(true);
  apiMock.adminJobDelete.mockResolvedValue(true);
  apiMock.adminBidDelete.mockResolvedValue(true);
}

// --- helpers (defined once, reused everywhere) ---
async function clickTab(name) {
  // Carbon Tabs sometimes don’t expose role="tab" reliably; try a few ways.
  const tab = screen.queryByRole("tab", { name });
  if (tab) return userEvent.click(tab);

  const btn = screen.queryByRole("button", { name });
  if (btn) return userEvent.click(btn);

  return userEvent.click(screen.getByText(name));
}

function getSectionByHeading(name) {
  const heading = screen.getByRole("heading", { name });
  return heading.closest(".admin-section") ?? document.body;
}

import AdminDashboard from "../pages/AdminDashboard";

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedApi();
  });

  it("loads users/jobs/bids on mount and shows Users by default", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(apiMock.adminUsersList).toHaveBeenCalledTimes(1);
      expect(apiMock.adminJobsList).toHaveBeenCalledTimes(1);
      expect(apiMock.adminBidsList).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByRole("heading", { name: "Users" }),
    ).toBeInTheDocument();

    expect(screen.getByText("u1")).toBeInTheDocument();
  });

  it("tab switching shows Jobs and Bids sections", async () => {
    render(<AdminDashboard />);

    await screen.findByRole("heading", { name: "Users" });

    await clickTab("Jobs");
    expect(
      await screen.findByRole("heading", { name: "Jobs" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Job One")).toBeInTheDocument();

    await clickTab("Bids");
    expect(
      await screen.findByRole("heading", { name: "Bids" }),
    ).toBeInTheDocument();
    expect(screen.getByText("b1")).toBeInTheDocument();
  });

  it("clicking View on a user opens editor modal and fetches latest user", async () => {
    render(<AdminDashboard />);

    await screen.findByRole("heading", { name: "Users" });

    const usersSection = getSectionByHeading("Users");
    const viewButtons = within(usersSection).getAllByRole("button", {
      name: "View",
    });
    await userEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(apiMock.adminUserGet).toHaveBeenCalledWith("u1");
    });

    expect(
      screen.getByRole("dialog", { name: "Edit User" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("user-form")).toBeInTheDocument();
  });

  it("clicking View on a job opens editor modal and fetches job details", async () => {
    render(<AdminDashboard />);

    await screen.findByRole("heading", { name: "Users" });

    await clickTab("Jobs");
    await screen.findByRole("heading", { name: "Jobs" });

    const jobsSection = getSectionByHeading("Jobs");
    const viewButtons = within(jobsSection).getAllByRole("button", {
      name: "View",
    });
    await userEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(apiMock.adminJobGet).toHaveBeenCalledWith("j1");
    });

    expect(
      screen.getByRole("dialog", { name: "Edit Job" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("job-form")).toBeInTheDocument();
  });

  it("clicking View on a bid opens editor modal and fetches bid details", async () => {
    render(<AdminDashboard />);

    await screen.findByRole("heading", { name: "Users" });

    await clickTab("Bids");
    await screen.findByRole("heading", { name: "Bids" });

    const bidsSection = getSectionByHeading("Bids");
    const viewButtons = within(bidsSection).getAllByRole("button", {
      name: "View",
    });
    await userEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(apiMock.adminBidGet).toHaveBeenCalledWith("b1");
    });

    expect(
      screen.getByRole("dialog", { name: "Edit Bid" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("bid-form")).toBeInTheDocument();
  });
});
