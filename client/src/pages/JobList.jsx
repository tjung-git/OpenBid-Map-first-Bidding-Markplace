import { useEffect, useState } from "react";
import { DataTable, Button, InlineNotification, FlexGrid, Column, TextInput, Row, NumberInput } from "@carbon/react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import MapView from "../components/MapView";
import { Text } from "@carbon/react/lib/components/Text";

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [err, setErr] = useState("");
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(1000000);
  const nav = useNavigate();

  useEffect(() => {
    api
      .jobsList()
      .then((d) => setJobs(d.jobs || []))
      .catch(() => setErr("Failed to load jobs"));
  }, []);

  const headers = [
    { key: "title", header: "Title" },
    { key: "budgetAmount", header: "Budget" },
    { key: "status", header: "Status" },
  ];

  const rows = jobs
    .filter((j) => (j.budgetAmount >= minBudget && j.budgetAmount <= maxBudget) || j.budgetAmount === "-")
    .map((j) => ({
      id: j.id,
      title: j.title,
      budgetAmount: j.budgetAmount ?? "-",
      status: j.status,
    }));

  return (
    <div>
      <h2>Nearby Jobs</h2>
      {err && (
        <InlineNotification
          title="Error"
          subtitle={err}
          kind="error"
          lowContrast
        />
      )}
      <FlexGrid>
        <Column>
          <p>Location</p>
        </Column>
        <Column>
        
        </Column>
      </FlexGrid>
      <MapView
        markers={jobs
          .filter((j) => j.location?.lat && j.location?.lng && j.budgetAmount >= minBudget && j.budgetAmount <= maxBudget)
          .map((j) => j.location)}
      />
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => nav("/new-job")}>Post a Job</Button>
      </div>
      <FlexGrid style={{marginTop: 16}}>
        <Row>
          <Column>
            <Text>Budget Filter</Text>
          </Column>
          <Column>
            <NumberInput min={0} max={1000000} onChange={(event) => setMinBudget(Number(event.target.value))} value={minBudget}></NumberInput>
          </Column>
          <Column>
            <NumberInput min={0} max={1000000} onChange={(event) => setMaxBudget(Number(event.target.value))} value={maxBudget}></NumberInput>
          </Column>
          <Column>
            <Button style={{backgroundColor: "red"}} onClick={()=>{setMinBudget(0); setMaxBudget(1000000)}}>Reset Budget Filter</Button>
          </Column>
        </Row>
      </FlexGrid>
      <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getHeaderProps, getRowProps }) => (
          <table
            className="cds--data-table cds--data-table--zebra"
            style={{ marginTop: 16 }}
          >
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h.key} {...getHeaderProps({ header: h })}>
                    {h.header}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} {...getRowProps({ row: r })}>
                  {r.cells.map((c) => (
                    <td key={c.id}>{c.value}</td>
                  ))}
                  <td>
                    <Button size="sm" onClick={() => nav(`/jobs/${r.id}`)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataTable>
    </div>
  );
}
