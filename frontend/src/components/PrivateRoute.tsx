// components/PrivateRoute.tsx
import { Navigate } from "react-router-dom";

interface PrivateRouteProps {
  children: JSX.Element;
  userIsLoggedIn: boolean;
}

export default function PrivateRoute({ children, userIsLoggedIn }: PrivateRouteProps) {
  if (!userIsLoggedIn) {
    // Only redirect for pages that require login
    return <Navigate to="/login" replace />;
  }
  return children;
}
