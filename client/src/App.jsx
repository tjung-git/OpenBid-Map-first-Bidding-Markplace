import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/global.scss";
import Nav from "./components/Nav";
import JobList from "./pages/JobList";
import NewJob from "./pages/NewJob";
import JobDetail from "./pages/JobDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<JobList />} />
        <Route path="/new" element={<NewJob />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
