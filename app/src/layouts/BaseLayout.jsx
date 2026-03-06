import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Wrapper from "../components/Wrapper";
import Footer from "../components/Footer";

export default function BaseLayout() {
  useEffect(() => {
    const sidebarWrapper = document.querySelector(".sidebar-wrapper");
    if (sidebarWrapper && window.OverlayScrollbarsGlobal?.OverlayScrollbars) {
      window.OverlayScrollbarsGlobal.OverlayScrollbars(sidebarWrapper, {
        scrollbars: {
          theme: "os-theme-light",
          autoHide: "leave",
          clickScroll: true,
        },
      });
    }

    const sidebarToggle = document.querySelector("[data-lte-toggle='sidebar']");
    const handleSidebarToggle = (e) => {
      e.preventDefault();
      document.body.classList.toggle("sidebar-open");
      document.body.classList.toggle("sidebar-collapse");
    };

    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", handleSidebarToggle);
    }

    // ✅ ปิด sidebar เมื่อกดพื้นที่ว่างนอก sidebar (จอเล็ก)
    const handleOverlayClick = (e) => {
      const isSmallScreen = window.innerWidth < 992; // breakpoint ของ AdminLTE
      if (!isSmallScreen) return;

      const sidebar = document.querySelector(".app-sidebar");
      const toggleBtn = document.querySelector("[data-lte-toggle='sidebar']");

      if (
        sidebar &&
        !sidebar.contains(e.target) &&
        toggleBtn &&
        !toggleBtn.contains(e.target) &&
        document.body.classList.contains("sidebar-open")
      ) {
        document.body.classList.remove("sidebar-open");
        document.body.classList.add("sidebar-collapse");
      }
    };

    document.addEventListener("click", handleOverlayClick);

    return () => {
      if (sidebarToggle) {
        sidebarToggle.removeEventListener("click", handleSidebarToggle);
      }
      document.removeEventListener("click", handleOverlayClick);
    };
  }, []);

  return (
    <div className="app-wrapper">
      <Navbar />
      <Sidebar />
      <Wrapper>
        <Outlet />
      </Wrapper>
      <Footer />
    </div>
  );
}
