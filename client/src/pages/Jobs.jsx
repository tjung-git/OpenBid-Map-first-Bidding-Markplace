import React from "react";
import { DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@carbon/react";

const headers = [
  { key: "id", header: "ID" },
  { key: "title", header: "Title" },
  { key: "location", header: "Location" },
  { key: "status", header: "Status" },
];

const rows = [
  { id: "1", title: "Fix Plumbing", location: "Toronto", status: "Open" },
  { id: "2", title: "Paint Fence", location: "Mississauga", status: "Closed" },
];

export default function JobsPage() {
  return (
    <>
      <h2>Jobs</h2>
      <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getHeaderProps, getRowProps }) => (
          <Table>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} {...getRowProps({ row })}>
                  {row.cells.map((cell) => (
                    <TableCell key={cell.id}>{cell.value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </>
  );
}
