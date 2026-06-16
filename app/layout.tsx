import './globals.css';

export const metadata = {
  title: "NovaMeta AI",
  description: "Next-Gen Microstock Companion",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}