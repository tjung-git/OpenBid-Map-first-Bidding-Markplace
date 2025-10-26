// Checks that Nav shows the right breadcrumbs for real contractor/bidder sessions.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Nav from "../components/Nav.jsx";
import { logout, setSession } from "../services/session";

function renderWithPath(path = "/jobs") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Nav />
    </MemoryRouter>
  );
}

describe("Nav", () => {
  beforeEach(() => {
    logout();
    window.localStorage.clear();
  });

  it("shows contractor breadcrumbs when creating a new job", () => {
    // Contractor should see Jobs > New Job
    setSession({ user: { userType: "contractor" } });
    renderWithPath("/new-job");

    expect(screen.getByRole("link", { name: /jobs/i })).toBeInTheDocument();
    expect(screen.getByText("New Job")).toBeInTheDocument();
  });

  it("renders My Bids trail when viewing a bid detail", () => {
    // Bidder should see My Bids > Bid Detail
    setSession({ user: { userType: "bidder" } });
    renderWithPath("/jobs/myBids/bidDetails/abc123");

    expect(screen.getByRole("link", { name: "My Bids" })).toBeInTheDocument();
    expect(screen.getByText("Bid Detail")).toBeInTheDocument();
  });
});
