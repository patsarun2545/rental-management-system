import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Home from "./pages/Home";

import AuthGuard from "./components/AuthGuard";
import BaseLayout from "./layouts/BaseLayout";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },

  {
    element: (
      <AuthGuard>
        <BaseLayout />
      </AuthGuard>
    ),
    children: [],
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
