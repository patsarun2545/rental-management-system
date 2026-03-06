import { useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  const pathName = location.pathname
    .replaceAll("/", " ")
    .trim()
    .toUpperCase() || "HOME";

  return (
    <nav className="app-header navbar navbar-expand bg-body">
      <div className="container-fluid">
        {/*begin::Start Navbar Links*/}
        <ul className="navbar-nav">
          <li className="nav-item">
            <a
              className="nav-link"
              data-lte-toggle="sidebar"
              href="#"
              role="button"
            >
              <i className="bi bi-list"></i>
            </a>
          </li>
          <li className="nav-item d-none d-md-block">
            <span className="nav-link">{pathName}</span>
          </li>
        </ul>
        {/*end::Start Navbar Links*/}

        {/*begin::End Navbar Links*/}
        <ul className="navbar-nav ms-auto">
          {/*begin::Fullscreen Toggle*/}
          <li className="nav-item">
            <a className="nav-link" href="#" data-lte-toggle="fullscreen">
              <i data-lte-icon="maximize" className="bi bi-arrows-fullscreen"></i>
              <i data-lte-icon="minimize" className="bi bi-fullscreen-exit" style={{ display: "none" }}></i>
            </a>
          </li>
          {/*end::Fullscreen Toggle*/}
        </ul>
        {/*end::End Navbar Links*/}
      </div>
    </nav>
  );
}