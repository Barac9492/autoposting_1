import "./globals.css";

export const metadata = {
    title: "Contrarian Brief",
    description: "LP Quarterly Brief generator for TheVentures",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
