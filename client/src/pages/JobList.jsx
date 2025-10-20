import { useEffect, useState } from "react";
import { DataTable, Button, InlineNotification, FlexGrid, Column, TextInput, Row, NumberInput } from "@carbon/react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import MapView from "../components/MapView";
import SearchAutocomplete from "../components/SearchAutcomplete";
import { Text } from "@carbon/react/lib/components/Text";
import { haversineFormulaKm } from "../util/locationHelpers";
import { cfg } from "../services/config";

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [err, setErr] = useState("");
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(1000000);
  const [center, setCenter] = useState({ lat: 43.6532, lng: -79.3832 });
  const [selectedAddress, setSelectedAddress] = useState("Toronto, ON, Canada");
  const [radius, setRadius] = useState(1000000); //In metres
  const nav = useNavigate();

  const handlePlaceSelection = (placeData) => {
    console.log('Selected Place:', placeData);
    const {address, latLng} = placeData;
    setCenter(latLng);
    setSelectedAddress(address);
  };

  useEffect(() => {
    api
      .jobsList()
      .then((d) => setJobs(d.jobs || []))
      .catch(() => setErr("Failed to load jobs"));
    
    setFilteredJobs(jobs);
  }, []);

  useEffect(() => {
    setFilteredJobs(jobs.filter((j) => j.location?.lat && j.location?.lng && ((j.budgetAmount >= minBudget && j.budgetAmount <= maxBudget) || j.budgetAmount ==="-") 
            && haversineFormulaKm(center.lat, center.lng, j.location?.lat, j.location?.lng) <= radius));
  }, [radius, minBudget, maxBudget, jobs, center]);

  const headers = [
    { key: "title", header: "Title" },
    { key: "budgetAmount", header: "Budget" },
    { key: "status", header: "Status" },
  ];

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
      {!cfg.prototype &&<FlexGrid>
        <Row>
          <Column>
            <SearchAutocomplete onSelectPlace={handlePlaceSelection}/>
          </Column>
          <Column>
            <Text>Current Location: {selectedAddress}</Text>
          </Column>
        </Row>
        <Row style={{marginTop: 16}}>
          <Column>
            <NumberInput 
              size="md"
              id="radius" 
              label="Radius (km)" 
              min={5} 
              max={1000000} 
              onChange={(event) => setRadius(Number(event.target.value))} 
              value={radius}
              hideSteppers
              helperText="Radius is set to 1000000 by default, radius should be altered after the location is selected to limit results."
            />
          </Column>
        </Row>
      </FlexGrid>}
      <MapView
        markers={filteredJobs
          .map((j) => j.location)}
        center={center}
      />
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => nav("/new-job")}>Post a Job</Button>
      </div>
      <FlexGrid style={{marginTop: 16}}>
        <Row>
          <Column>
            <Text>Budget Filter</Text>
          </Column>
        </Row>
        <Row>
          <Column>
            <NumberInput 
              size="md"
              id="minBudget" label="Min budget" 
              min={0} 
              max={1000000} 
              onChange={(event) => setMinBudget(Number(event.target.value))} 
              value={minBudget}
              hideSteppers
            >
            </NumberInput>
          </Column>
          <Column>
            <NumberInput
              size="md" 
              id="maxBudget" 
              label="Max budget" 
              min={0} max={1000000} 
              onChange={(event) => setMaxBudget(Number(event.target.value))} 
              value={maxBudget}
              hideSteppers
            >
            </NumberInput>
          </Column>
        </Row>
      </FlexGrid>
      <DataTable rows={filteredJobs
        .map((j) => ({
          id: j.id,
          title: j.title,
          budgetAmount: j.budgetAmount ?? "-",
          status: j.status,
        }))} headers={headers}>
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
