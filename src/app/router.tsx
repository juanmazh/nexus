import { createBrowserRouter } from "react-router";
import { HealthPage } from "@/features/health/health-page";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <HealthPage />,
	},
]);
