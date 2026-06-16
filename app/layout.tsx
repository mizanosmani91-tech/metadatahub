import "./globals.css";

export const metadata = {
  title: "MetaDataTECH AI",
  description: "Next-Gen Batch Metadata Generator for Stock Contributors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}