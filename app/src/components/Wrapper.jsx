export default function Wrapper({ children }) {
  return (
    <main className="app-main">
      <div className="app-content-header">
        <div className="container-fluid"></div>
      </div>
      <div className="app-content">
        <div className="container-fluid">{children}</div>
      </div>
    </main>
  );
}