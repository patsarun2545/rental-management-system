import { useLocation } from "react-router-dom";

export default function Wrapper({ children }) {
  const location = useLocation();

  const pageName = location.pathname.replaceAll("/", " ").trim() || "Home";

  // Capitalize first letter of each word
  const pageTitle = pageName
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <main className="app-main">
      {/*begin::App Content Header*/}
      <div className="app-content-header">
        <div className="container-fluid"></div>
      </div>
      {/*end::App Content Header*/}

      {/*begin::App Content*/}
      <div className="app-content">
        <div className="container-fluid">{children}</div>
      </div>
      {/*end::App Content*/}
    </main>
  );
}
