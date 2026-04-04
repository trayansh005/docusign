import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			// Local development
			{
				protocol: "http",
				hostname: "localhost",
				port: "5002",
				pathname: "/uploads/**",
			},
			// Production VPS
			{
				protocol: "https",
				hostname: "api.fomiqsign.com",
				pathname: "/uploads/**",
			},
		],
	},
};

export default nextConfig;
