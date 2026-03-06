import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Signin from "./pages/Signin";
import SignUp from "./pages/SignUp";

import Dashboard from "./pages/Dashboard";

import Users from "./pages/Users";

import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Types from "./pages/Types";
import SizesColors from "./pages/Sizescolors";

import Rentals from "./pages/Rentals";
import Returns from "./pages/Returns";

import Invoices from "./pages/Invoices";
import Reservations from "./pages/Reservations";

import Payments from "./pages/Payments";
import Promotions from "./pages/Promotions";

import Reports from "./pages/Reports";
import AuditLogs from "./pages/AuditLogs";

import AuthGuard from "./components/AuthGuard";
import BaseLayout from "./layouts/BaseLayout";

const router = createBrowserRouter([
  { path: "/", element: <Signin /> },
  { path: "/signup", element: <SignUp /> },

  {
    element: (
      <AuthGuard>
        <BaseLayout />
      </AuthGuard>
    ),
    children: [
      { path: "/dashboard", element: <Dashboard /> },

      { path: "/users", element: <Users /> },

      { path: "/products", element: <Products /> },
      { path: "/categories", element: <Categories /> },
      { path: "/types", element: <Types /> },
      { path: "/sizes-colors", element: <SizesColors /> },

      { path: "/rentals", element: <Rentals /> },
      { path: "/returns", element: <Returns /> },

      { path: "/invoices", element: <Invoices /> },
      { path: "/reservations", element: <Reservations /> },

      { path: "/payments", element: <Payments /> },
      { path: "/promotions", element: <Promotions /> },

      { path: "/reports", element: <Reports /> },
      { path: "/audit", element: <AuditLogs /> },
    ],
  },

  {
    path: "*",
    element: <div>404 Page Not Found</div>,
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
