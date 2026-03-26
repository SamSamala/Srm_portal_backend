// Next.js custom Document — sets HTML shell, lang, and viewport meta
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <title>SRM Portal – Works on WiFi &amp; Mobile Data</title>
        <meta name="description" content="Track attendance, marks &amp; timetable instantly — works both on SRM WiFi and mobile network." />
        <meta name="keywords" content="SRM portal, SRM attendance, SRM marks, SRM timetable, SRM student dashboard, SRM WiFi mobile access" />
        <meta name="author" content="SRM Portal" />
        <meta name="robots" content="index, follow" />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="theme-color" content="#4f46e5" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://srm-campus-hub.vercel.app" />
        <meta property="og:site_name" content="SRM Portal" />
        <meta property="og:title" content="SRM Portal – Works on WiFi &amp; Mobile Data" />
        <meta property="og:description" content="Track attendance, marks &amp; timetable instantly — works both on SRM WiFi and mobile network." />
        <meta property="og:image" content="https://srm-campus-hub.vercel.app/og.svg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="SRM Portal – Works on WiFi &amp; Mobile Data" />
        <meta property="og:locale" content="en_IN" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SRM Portal – Works on WiFi &amp; Mobile Data" />
        <meta name="twitter:description" content="Attendance, marks &amp; timetable — accessible on SRM WiFi and mobile network." />
        <meta name="twitter:image" content="https://srm-campus-hub.vercel.app/og.svg" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
